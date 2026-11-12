import { createHash } from 'node:crypto'
import { taskId } from './CollaborationTaskStore.mjs'
import { snapshotIdentity } from './MergeDraftService.mjs'
import { inspectAutoCommitGit, executeAutoCommitGit } from './AutoCommitGit.mjs'
import { autoCommitJournal, inspectAutoCommitRecovery, recoverAutoCommitGit } from './AutoCommitRecovery.mjs'
const refuse = message => Object.assign(Error(message), { status: 409 })
const fingerprint = snapshot => createHash('sha256').update(JSON.stringify(snapshotIdentity(snapshot))).digest('hex')

// Public methods own the logical project operation lock. Locked methods are for
// the durable scheduler which already holds that same lock (never nest it).
export class AutoCommitService {
  constructor({ workspace, project, workspaceStore, taskStore, withLock, authorize, readEpoch, workspaceId, ownerId, hasPendingMerge = async () => false }) {
    Object.assign(this, { workspace, project, workspaceStore, taskStore, withLock, authorize, readEpoch, workspaceId, ownerId, hasPendingMerge })
    this.journal = autoCommitJournal({ store: taskStore, workspaceId, ownerId })
  }
  async binding() {
    const binding = await this.workspaceStore.read()
    if (binding.pending || binding.mutationTaskId || !binding.branch) throw refuse('Workspace is switching, detached or requires recovery')
    return binding
  }
  preview() { return this.withLock(() => this.previewLocked()) }
  async previewLocked() {
    await this.authorize()
    if (await this.hasPendingMerge()) return { conflicted: true, changed: false }
    const binding = await this.binding(), epoch = await this.readEpoch()
    return this.project.transaction(async tx => {
      const snapshot = await tx.read()
      const repo = await this.workspace.current(binding), git = await inspectAutoCommitGit(repo)
      if (git.branch !== `refs/heads/${binding.branch}`) throw refuse('Workspace branch binding changed')
      await tx.assertActive(); await this.authorize()
      if (await this.readEpoch() !== epoch) throw refuse('Workspace generation changed')
      return { ...git, epoch, directory: binding.directory, snapshotFingerprint: fingerprint(snapshot),
        conflicted: !!git.operation, recoveryRequired: false, changed: true }
    }, { prepare: true, epoch })
  }
  recoveryPreview(operationId) {
    return this.withLock(async () => {
      await this.authorize()
      const record = await this.journal.read(taskId(operationId)), binding = await this.workspaceStore.read()
      if (binding.pending || (binding.mutationTaskId && binding.mutationTaskId !== record.id)) throw refuse('Another workspace mutation is pending')
      const info = await inspectAutoCommitRecovery(await this.workspace.current(binding), record)
      return { operationId: record.id, revision: record.revision, fingerprint: info.fingerprint, action: info.action }
    })
  }
  recover({ operationId, revision, fingerprint: previewFingerprint }) {
    return this.withLock(async () => {
      operationId = taskId(operationId)
      await this.authorize()
      const record = await this.journal.read(operationId), binding = await this.workspaceStore.read()
      if (record.revision !== revision || binding.pending || (binding.mutationTaskId && binding.mutationTaskId !== operationId)) throw refuse('Recovery task or workspace changed')
      const repo = await this.workspace.current(binding), epoch = await this.readEpoch()
      const result = await this.project.transaction(async tx => {
        const guard = async () => {
          await tx.assertActive(); await this.authorize()
          const current = await this.workspaceStore.read()
          if (current.pending || current.directory !== binding.directory || current.branch !== binding.branch ||
              (current.mutationTaskId && current.mutationTaskId !== operationId) || await this.readEpoch() !== epoch) throw refuse('Recovery workspace ownership changed')
        }
        await guard()
        const info = await inspectAutoCommitRecovery(repo, record)
        if (info.fingerprint !== previewFingerprint || !info.action) throw refuse('Recovery preview is stale or requires manual reconciliation')
        if (!binding.mutationTaskId) await this.workspaceStore.beginMutation(operationId)
        return recoverAutoCommitGit({ repo, record, fingerprint: previewFingerprint, guard,
          journal: async checkpoint => { await guard(); return this.journal.write(checkpoint) } })
      }, { prepare: true, epoch })
      await this.authorize()
      await this.workspaceStore.finishMutation(operationId)
      return { operationId, state: result.state, commit: result.commit }
    })
  }
  execute(request) { return this.withLock(() => this.executeLocked(request)) }
  async executeLocked(request) {
    let recorded = false
    try { return await this.executeAttemptLocked(request, () => { recorded = true }) }
    catch (error) {
      // Before durable preparation is attempted there is no native executor,
      // binding mutation or Git publication. The scheduler may clear its ID.
      if (!recorded) error.autoCommitNotStarted = true
      throw error
    }
  }
  async executeAttemptLocked({ operationId, snapshot: expected }, markRecorded) {
    operationId = taskId(operationId)
    await this.authorize()
    if (await this.hasPendingMerge()) throw refuse('A shared merge task must be reviewed before automatic commits')
    const binding = await this.binding(), epoch = await this.readEpoch()
    if (!expected || expected.epoch !== epoch || expected.directory !== binding.directory || expected.branch !== `refs/heads/${binding.branch}`) throw refuse('Automatic commit preview is stale')
    const repo = await this.workspace.current(binding)
    // Persist the attempt before waiting for online clients to save. Failure to
    // enter the prepared transaction then has an explicit cancellable record.
    await this.journal.write({ operationId, state: 'requested', directory: binding.directory,
      branch: expected.branch, head: expected.head, indexFingerprint: expected.indexFingerprint })
    markRecorded()
    let acquired = false
    const result = await this.project.transaction(async tx => {
      const saved = await tx.read()
      if (fingerprint(saved) !== expected.snapshotFingerprint) throw refuse('Saved documents changed after automatic commit preview')
      const guard = async () => {
        await tx.assertActive(); await this.authorize()
        const current = await this.workspaceStore.read()
        if (current.pending || current.directory !== binding.directory || current.branch !== binding.branch ||
            current.mutationTaskId !== (acquired ? operationId : undefined) || await this.readEpoch() !== epoch) throw refuse('Automatic commit workspace ownership changed')
        if (fingerprint(await tx.read()) !== expected.snapshotFingerprint) throw refuse('Saved document identity or version changed')
        await tx.assertActive()
      }
      await guard()
      return executeAutoCommitGit({ repo, expected, files: saved.files, operationId, guard,
        journal: async checkpoint => {
          await guard()
          // Starting intent exists on disk before the binding can become blocked.
          // Failure afterwards is recoverable even before index.lock acquisition.
          await this.journal.write(checkpoint)
          if (!acquired) { await this.workspaceStore.beginMutation(operationId); acquired = true }
        } })
    }, { prepare: true, epoch })
    // A failed prepared-transaction exit retains ownership, even if Git published.
    // Only a fully completed transaction releases this task's persistent block.
    await this.authorize()
    const record = await this.journal.read(operationId)
    if (!['complete', 'cancelled'].includes(record.state)) throw refuse('Automatic commit outcome requires reconciliation')
    await this.workspaceStore.finishMutation(operationId)
    return result
  }
}
