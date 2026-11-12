import Path from 'node:path'
import { randomUUID } from 'node:crypto'
import { readWorktree, fileChanges } from './WorktreeFiles.mjs'
import { mkdir, statfs } from 'node:fs/promises'
import { taskId } from './CollaborationTaskStore.mjs'
import { writeRecoverySnapshot, readRecoverySnapshot } from './RecoverySnapshots.mjs'
import { snapshotIdentity } from './MergeDraftService.mjs'

const refuse = message => Object.assign(new Error(message), { status: 409 })
const epochMatches = (before, after) => JSON.stringify(before) === JSON.stringify(after)

export function publicShellDraft(task) {
  const { id, kind, logicalProjectId, workspaceId, workspaceEpoch, createdBy, state, revision, createdAt, updatedAt, failure, failurePhase } = task
  return { id, kind, logicalProjectId, workspaceId, workspaceEpoch, createdBy, state, revision, createdAt, updatedAt, failure, failurePhase }
}

// Terminal receives ONLY workingDirectory. Baseline bytes and control records
// are siblings outside that volume-subpath mount. No live worktree is touched.
export class ShellDraftService {
  constructor({ root, store, project, withLock, authorize, readEpoch, logicalProjectId, workspaceId, actorId, terminal, readPermissionMode, clock = Date.now, minFreeBytes = 300 * 1024 * 1024 }) {
    Object.assign(this, { root: Path.resolve(root), store, project, withLock, authorize, readEpoch, logicalProjectId, workspaceId, actorId, terminal, readPermissionMode, clock, minFreeBytes })
  }
  paths(id) {
    const directory = Path.join(this.root, taskId(id))
    return { directory, baselineDirectory: Path.join(directory, 'baseline'), workingDirectory: Path.join(directory, 'work'), reviewDirectory: Path.join(directory, 'review') }
  }
  async owned(id) {
    const task = await this.store.read(id)
    if (task.kind !== 'shell-draft' || task.logicalProjectId !== this.logicalProjectId || task.workspaceId !== this.workspaceId || task.createdBy !== this.actorId) {
      throw Object.assign(new Error('Shell draft does not belong to this user and workspace'), { status: 403 })
    }
    return task
  }
  async save(task, fields) {
    const next = { ...task, ...fields, revision: task.revision + 1, updatedAt: this.clock() }
    await this.store.write(next)
    return next
  }
  async prepare(operationId) {
    const id = taskId(operationId)
    return this.withLock(async () => {
      await this.authorize()
      try {
        const existing = await this.owned(id)
        await this.authorize()
        // Never regenerate files on retry: a terminal may have already edited
        // them, or a previous preparation may have stopped halfway through.
        return existing
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      const epoch = await this.readEpoch()
      if (!Number.isSafeInteger(epoch) || epoch < 1) throw refuse('A fenced workspace is required for a shell draft')
      const snapshot = await this.project.read()
      if (!epochMatches(epoch, await this.readEpoch())) throw refuse('Workspace changed while preparing shell draft')
      await this.authorize()
      await mkdir(this.root, { recursive: true, mode: 0o700 })
      const bytes = [...snapshot.files.values()].reduce((sum, value) => sum + value.length, 0)
      const space = await statfs(this.root)
      if (space.bavail * space.bsize < bytes * 2 + this.minFreeBytes) throw Object.assign(new Error('Insufficient storage for retained shell draft'), { status: 507 })
      let task = { id, kind: 'shell-draft', logicalProjectId: this.logicalProjectId, workspaceId: this.workspaceId,
        workspaceEpoch: epoch, createdBy: this.actorId, state: 'preparing', revision: 1,
        createdAt: this.clock(), updatedAt: this.clock(), baseline: snapshotIdentity(snapshot) }
      await this.store.write(task)
      try {
        const paths = this.paths(id)
        await mkdir(paths.directory, { mode: 0o700 })
        const manifest = await writeRecoverySnapshot(paths.baselineDirectory, snapshot.files)
        await writeRecoverySnapshot(paths.workingDirectory, snapshot.files)
        if (!epochMatches(epoch, await this.readEpoch())) throw refuse('Workspace changed before shell draft became ready')
        await this.authorize()
        task = await this.save(task, { state: 'ready', baselineManifest: manifest })
        return task
      } catch (error) {
        await this.save(task, { state: 'recovery-required', failure: 'Preparation did not finish; retained files must be inspected before use.' })
        throw error
      }
    })
  }
  async start(id, revision, mode) {
    return this.withLock(async () => {
      await this.authorize()
      let task = await this.owned(id)
      if (task.revision !== revision || task.state !== 'ready') throw refuse('Refresh the draft; it is not ready to start a shell')
      if (this.readPermissionMode && await this.readPermissionMode() !== mode) throw refuse('Shell permissions changed; refresh before starting')
      if (!['read-only', 'workspace-write', 'auto-review', 'full-access'].includes(mode)) throw refuse('Invalid shell permission mode')
      if (!this.terminal?.start) throw Object.assign(new Error('Draft terminal runner is not configured'), { status: 503 })
      if (!epochMatches(task.workspaceEpoch, await this.readEpoch())) throw refuse('Workspace changed; retain this draft and create a new one')
      await readRecoverySnapshot(this.paths(id).baselineDirectory, task.baselineManifest)
      await this.authorize()
      const attemptId = randomUUID()
      task = await this.save(task, { state: 'starting', sessionAttemptId: attemptId, permissionMode: mode })
      try {
        const session = await this.terminal.start({ attemptId, draftId: task.id, logicalProjectId: this.logicalProjectId,
          workspaceId: this.workspaceId, actorId: this.actorId, directory: this.paths(id).workingDirectory, mode })
        if (session?.attemptId !== attemptId || typeof session.sessionId !== 'string' || !session.sessionId) throw refuse('Runner did not confirm the persisted shell attempt')
        await this.authorize()
        if (!epochMatches(task.workspaceEpoch, await this.readEpoch())) throw refuse('Workspace changed during shell startup')
        return await this.save(task, { state: 'running', sessionId: session.sessionId })
      } catch (error) {
        await this.save(task, { state: 'recovery-required', failurePhase: 'start', failure: 'Shell startup outcome is uncertain. Stop this attempt before reviewing; do not start another shell.' })
        throw error
      }
    })
  }
  async session(id, action, payload = {}) {
    return this.withLock(async () => {
      await this.authorize()
      const task = await this.owned(id)
      if (task.state !== 'running' || !task.sessionId) throw refuse('This draft has no running shell; refresh or stop it for review')
      if (!['poll', 'input', 'run', 'resize'].includes(action)) throw refuse('Invalid shell session action')
      if (action !== 'poll') {
        if (!epochMatches(task.workspaceEpoch, await this.readEpoch())) throw refuse('Workspace changed; stop and review this draft before continuing')
        if (!this.readPermissionMode || await this.readPermissionMode() !== task.permissionMode) throw refuse('Shell permissions changed; stop this draft before continuing')
        if (action === 'input' && task.permissionMode === 'auto-review') throw refuse('Raw input is disabled in reviewed mode')
        if (action === 'run' && task.permissionMode !== 'auto-review') throw refuse('Reviewed session required')
      }
      if (!this.terminal?.session) throw Object.assign(new Error('Draft terminal runner is not configured'), { status: 503 })
      await this.authorize()
      // Resolve the runner session from the private record, never a browser id.
      const result = await this.terminal.session({ action, id: task.sessionId,
        logicalProjectId: this.logicalProjectId, actorId: this.actorId,
        ...(action === 'poll' ? { cursor: payload.cursor ?? 0 } : {}),
        ...(action === 'input' ? { input: payload.input } : {}),
        ...(action === 'run' ? { text: payload.text, approval: payload.approval } : {}),
        ...(action === 'resize' ? { cols: payload.cols, rows: payload.rows } : {}) })
      await this.authorize()
      return result
    })
  }
  async seal(id, revision) {
    return this.withLock(async () => {
      await this.authorize()
      let task = await this.owned(id)
      if (task.revision !== revision) throw refuse('The draft changed; refresh before stopping')
      if (task.state === 'review-ready') return task
      const stoppable = ['ready', 'running', 'starting', 'stopping'].includes(task.state) ||
        (task.state === 'recovery-required' && ['start', 'stop'].includes(task.failurePhase))
      if (!stoppable) throw refuse('This draft requires recovery inspection before review')
      task = await this.save(task, { state: 'stopping' })
      try {
        if (task.sessionAttemptId) {
          if (!this.terminal?.stop) throw refuse('Runner cannot confirm that this shell attempt stopped')
          const stopped = await this.terminal.stop({ attemptId: task.sessionAttemptId, draftId: task.id,
            logicalProjectId: this.logicalProjectId, workspaceId: this.workspaceId, actorId: this.actorId })
          if (stopped?.attemptId !== task.sessionAttemptId || stopped.quiescent !== true) throw refuse('Shell stop is not confirmed; review snapshot is unavailable')
        }
        await this.authorize()
      } catch (error) {
        await this.save(task, { state: 'recovery-required', failurePhase: 'stop', failure: 'Shell may still be writing. Confirm this attempt stopped before reading its draft.' })
        throw error
      }
      task = await this.save(task, { state: 'sealing', stoppedAt: this.clock() })
      try {
        const paths = this.paths(id)
        const baseline = await readRecoverySnapshot(paths.baselineDirectory, task.baselineManifest)
        const files = await readWorktree(paths.workingDirectory)
        const bytes = [...files.values()].reduce((sum, value) => sum + value.length, 0)
        const space = await statfs(this.root)
        if (space.bavail * space.bsize < bytes + this.minFreeBytes) throw Object.assign(new Error('Insufficient storage for sealed shell review'), { status: 507 })
        // Exclusive new directory: never overwrite a previous review after an
        // interrupted seal. It is retained for explicit recovery instead.
        await mkdir(paths.reviewDirectory, { mode: 0o700 })
        const manifest = await writeRecoverySnapshot(paths.reviewDirectory, files)
        await this.authorize()
        return await this.save(task, { state: 'review-ready', reviewManifest: manifest,
          reviewedEpoch: await this.readEpoch(), changedPaths: fileChanges(baseline, files).map(change => change.path), failure: null, failurePhase: null })
      } catch (error) {
        await this.save(task, { state: 'recovery-required', failurePhase: 'seal', failure: 'Review snapshot could not be completed. Preserve the draft and inspect recovery files.' })
        throw error
      }
    })
  }
  async review(id) {
    return this.withLock(async () => {
      await this.authorize()
      const task = await this.owned(id)
      if (task.state !== 'review-ready') throw refuse('A stopped and sealed draft is required for review')
      const paths = this.paths(id)
      const baseline = await readRecoverySnapshot(paths.baselineDirectory, task.baselineManifest)
      const files = await readRecoverySnapshot(paths.reviewDirectory, task.reviewManifest)
      await this.authorize()
      return { task, changes: fileChanges(baseline, files) }
    })
  }
  async get(id) {
    return this.withLock(async () => {
      await this.authorize()
      const task = await this.owned(id)
      await this.authorize()
      return task
    })
  }
  async list() {
    return this.withLock(async () => {
      await this.authorize()
      const tasks = await this.store.list()
      await this.authorize()
      return tasks.filter(t => t.kind === 'shell-draft' && t.logicalProjectId === this.logicalProjectId && t.workspaceId === this.workspaceId && t.createdBy === this.actorId).map(publicShellDraft)
    })
  }
  async baseline(id) {
    return this.withLock(async () => {
      await this.authorize()
      const task = await this.owned(id)
      if (!task.baselineManifest) throw refuse('Shell draft preparation is incomplete')
      const files = await readRecoverySnapshot(this.paths(id).baselineDirectory, task.baselineManifest)
      await this.authorize()
      return { task, files }
    })
  }
}
