import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import Path from 'node:path'
import { taskId } from './CollaborationTaskStore.mjs'

const refuse = message => Object.assign(new Error(message), { status: 409 })
const editableStates = new Set(['conflicted', 'resolving', 'ready-to-apply'])

export function snapshotIdentity(snapshot) {
  return {
    files: [...snapshot.files].map(([path, bytes]) => ({ path,
      hash: createHash('sha256').update(bytes).digest('hex'), ...snapshot.entries.get(path) })).sort((a,b) => a.path.localeCompare(b.path)),
    folders: [...snapshot.folders].sort(([a],[b]) => a.localeCompare(b)),
  }
}

// HTTP responses omit disk paths, document manifests and recovery internals.
export function publicMergeTask(task) {
  const { id, kind, logicalProjectId, workspaceId, targetBranch, sourceRef,
    baseOid, localOid, remoteOid, state, revision, createdBy, createdAt, updatedAt,
    leaseGeneration, lease, conflictedPaths, remainingPaths, failure } = task
  return { id, kind, logicalProjectId, workspaceId, targetBranch, sourceRef,
    baseOid, localOid, remoteOid, state, revision, createdBy, createdAt, updatedAt,
    leaseGeneration, lease, conflictedPaths, remainingPaths, failure }
}

export class MergeDraftService {
  constructor({ workspace, repository, store, logicalProjectId, workspaceId, actorId, clock = Date.now, leaseMs = 90000, author, readEpoch, authorize = async () => {} }) {
    Object.assign(this, { workspace, repository, store, logicalProjectId, workspaceId, actorId, clock, leaseMs, author, readEpoch, authorize })
  }
  async scoped(id) {
    const task = await this.store.read(id)
    if (task.logicalProjectId !== this.logicalProjectId || task.workspaceId !== this.workspaceId) {
      throw Object.assign(new Error('Task does not belong to this workspace'), { status: 403 })
    }
    return task
  }
  async save(task, updates) {
    const next = { ...task, ...updates, revision: task.revision + 1, updatedAt: this.clock() }
    await this.store.write(next)
    return next
  }
  async list() {
    return this.workspace.withLock(async () => {
      await this.authorize()
      const tasks = await this.store.list()
      await this.authorize()
      return tasks.filter(task => task.logicalProjectId === this.logicalProjectId && task.workspaceId === this.workspaceId)
        .map(publicMergeTask)
    })
  }
  async get(id) {
    return this.workspace.withLock(async () => {
      await this.authorize()
      const task = await this.scoped(id)
      await this.authorize()
      return task
    })
  }
  async cancel(id, { revision, sessionId, generation }) {
    return this.workspace.withLock(async () => {
      const task = await this.scoped(id)
      this.assertRevision(task, revision)
      this.assertLease(task, sessionId, generation)
      if (!editableStates.has(task.state)) throw refuse('This task cannot be cancelled in its current state')
      // Retain the draft for recovery/retention policy; cancellation is not GC.
      return this.save(task, { state: 'cancelled', lease: null })
    })
  }
  async prepare({ operationId, ref, expectedSourceOid }) {
    const id = taskId(operationId)
    return this.workspace.withLock(async () => {
      try {
        const existing = await this.scoped(id)
        if (existing.sourceRef !== ref || existing.createdBy !== this.actorId || (existing.expectedSourceOid || null) !== (expectedSourceOid || null)) throw refuse('Operation identity was already used for a different request')
        // An interrupted preparation is inspected/recovered, never re-run as a
        // blind retry: native Git might already have modified the draft index.
        return existing
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      const binding = await this.workspace.store.read()
      if (expectedSourceOid) {
        const current = await this.workspace.current(binding)
        if (await current.resolve(ref) !== expectedSourceOid) throw refuse('The displayed remote commit changed; refresh remote updates before reviewing')
      }
      const { repository: target, snapshot } = await this.workspace.synchronize(binding)
      const status = await target.status()
      if (status.detached || status.operation || status.files.length) throw refuse('Commit or explicitly handle target workspace changes before preparing a merge')
      const localOid = await target.head()
      const remoteOid = await target.resolve(ref)
      if (expectedSourceOid && remoteOid !== expectedSourceOid) throw refuse('The displayed remote commit changed; refresh remote updates before reviewing')
      const baseOid = (await target.git.raw(['merge-base', localOid, remoteOid])).trim()
      if (!baseOid) throw refuse('No common ancestor for this merge')
      const directory = Path.join(this.repository.worktreeRoot, `merge-draft-${id}`)
      let task = { id, kind: 'merge', logicalProjectId: this.logicalProjectId, workspaceId: this.workspaceId,
        workspaceEpoch: this.readEpoch ? await this.readEpoch() : null,
        targetBranch: status.branch, sourceRef: ref, expectedSourceOid: expectedSourceOid || null, baseOid, localOid, remoteOid,
        baseline: snapshotIdentity(snapshot), indexTree: (await target.git.raw(['write-tree'])).trim(),
        directory, state: 'preparing', revision: 1, createdBy: this.actorId,
        createdAt: this.clock(), updatedAt: this.clock(), leaseGeneration: 0,
        conflictedPaths: [], remainingPaths: [] }
      await this.store.write(task)
      try {
        await mkdir(this.repository.worktreeRoot, { recursive: true, mode: 0o700 })
        await this.repository.git.raw(['worktree', 'add', '--detach', '--', directory, localOid])
        await this.repository.git.raw(['worktree', 'lock', '--reason', `Collaboration task ${id}`, directory])
        const draft = await this.repository.openWorktree(directory)
        let mergeError
        try {
          const identity = this.author ? ['-c', `user.name=${this.author.name}`, '-c', `user.email=${this.author.email}`] : []
          await draft.git.raw([...identity, 'merge', '--no-commit', '--no-ff', '--', remoteOid])
        } catch(error) { mergeError = error }
        const after = await draft.status()
        if (mergeError && !after.conflicted.length) throw mergeError
        task = await this.save(task, { state: after.conflicted.length ? 'conflicted' : 'ready-to-apply',
          conflictedPaths: after.conflicted, remainingPaths: after.conflicted })
        return task
      } catch(error) {
        await this.save(task, { state: 'recovery-required', failure: 'Draft preparation did not complete; inspect the retained draft before retrying.' })
        throw error
      }
    })
  }
  assertRevision(task, revision) {
    if (task.revision !== revision) throw refuse('The collaboration task changed; refresh before continuing')
  }
  assertLease(task, sessionId, generation) {
    if (!task.lease || task.lease.actorId !== this.actorId || task.lease.sessionId !== sessionId ||
        task.leaseGeneration !== generation || task.lease.expiresAt <= this.clock()) {
      throw refuse('The resolution lease expired or belongs to another session')
    }
  }
  async claim(id, revision, sessionId) {
    taskId(sessionId)
    return this.workspace.withLock(async () => {
      const task = await this.scoped(id)
      this.assertRevision(task, revision)
      if (!editableStates.has(task.state)) throw refuse('This task cannot be claimed in its current state')
      const active = task.lease?.expiresAt > this.clock()
      if (active && (task.lease.actorId !== this.actorId || task.lease.sessionId !== sessionId)) throw refuse('Another session is resolving this task')
      return this.save(task, { leaseGeneration: active ? task.leaseGeneration : task.leaseGeneration + 1,
        lease: { actorId: this.actorId, sessionId, expiresAt: this.clock() + this.leaseMs } })
    })
  }
  async conflict(id, path) {
    return this.workspace.withLock(async () => {
      const task = await this.scoped(id)
      if (!task.remainingPaths.includes(path)) throw refuse('File is not an unresolved conflict in this task')
      await this.authorize()
      const details = await (await this.repository.openWorktree(task.directory)).conflictDetails(path)
      await this.authorize()
      return details
    })
  }
  async resolve(id, { revision, sessionId, generation, path, fingerprint, choice, text }) {
    return this.workspace.withLock(async () => {
      let task = await this.scoped(id)
      this.assertRevision(task, revision)
      this.assertLease(task, sessionId, generation)
      if (!editableStates.has(task.state) || !task.remainingPaths.includes(path)) throw refuse('File is no longer awaiting resolution')
      const draft = await this.repository.openWorktree(task.directory)
      // Resolve only the isolated draft, using the existing exact-index/content
      // fingerprint check. No live document method is called in this service.
      const details = await draft.conflictDetails(path)
      if (details.fingerprint !== fingerprint) throw refuse('The conflicted file changed; refresh before resolving')
      task = await this.save(task, { state: 'resolving-file', resolvingPath: path })
      try {
        await draft.resolveConflict(path, fingerprint, choice, text)
      } catch (error) {
        await this.save(task, { state: 'recovery-required', failure: 'A draft resolution did not complete; inspect the retained draft before continuing.' })
        throw error
      }
      const status = await draft.status()
      task = await this.save(task, { state: status.conflicted.length ? 'resolving' : 'ready-to-apply', remainingPaths: status.conflicted, resolvingPath: null })
      return task
    })
  }
  async validateTarget(id) {
    return this.workspace.withLock(() => this.validateTargetLocked(id))
  }
  // Caller must hold the repository lock; used inside the application coordinator.
  async validateTargetLocked(id) {
      const task = await this.scoped(id)
      if (!editableStates.has(task.state)) throw refuse('Task is not ready for target validation')
      const binding = await this.workspace.store.read()
      if (binding.pending || binding.mutationTaskId || binding.branch !== task.targetBranch) throw refuse('Workspace binding changed')
      const current = await this.workspace.current(binding)
      const snapshot = await this.workspace.project.read()
      // A missing source invalidates the preview. Do not swallow repository,
      // permission or disk failures as though a ref had merely disappeared.
      const sourceOid = await current.resolve(task.sourceRef).catch(error => {
        if (/fatal: Needed a single revision/.test(error.message)) return null
        throw error
      })
      const unchanged = (await current.head()) === task.localOid &&
        sourceOid === task.remoteOid &&
        (await current.git.raw(['write-tree'])).trim() === task.indexTree &&
        JSON.stringify(snapshotIdentity(snapshot)) === JSON.stringify(task.baseline)
      if (!unchanged) {
        await this.save(task, { state: 'superseded', failure: 'Workspace, source ref or index changed; prepare a fresh merge. The previous draft is retained.' })
        throw refuse('The merge preview is stale; the draft has been retained')
      }
      return task
  }
}
