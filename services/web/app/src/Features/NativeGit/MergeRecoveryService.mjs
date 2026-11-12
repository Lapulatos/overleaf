import { acceptsMergeRecoveryEpoch } from './MergeSessionRecovery.mjs'
import Path from 'node:path'
import { taskId } from './CollaborationTaskStore.mjs'
import { createHash } from 'node:crypto'
import { snapshotIdentity, publicMergeTask } from './MergeDraftService.mjs'
import { readWorktree, writeWorktree, fileChanges } from './WorktreeFiles.mjs'
import { writeRecoverySnapshot, readRecoverySnapshot } from './RecoverySnapshots.mjs'

const refuse = message => Object.assign(new Error(message), { status: 409 })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export class MergeRecoveryService {
  constructor({ drafts, readEpoch, advanceEpoch }) {
    Object.assign(this, { drafts, readEpoch, advanceEpoch })
  }
  async inspectLocked(task, snapshot) {
    if (!task.application || !['applying', 'recovery-required', 'resolved', 'cancelled'].includes(task.state)) {
      throw refuse('This task has no pending application to recover')
    }
    const binding = await this.drafts.workspace.store.read()
    if (binding.mutationTaskId !== task.id || binding.branch !== task.targetBranch) throw refuse('Workspace recovery ownership changed')
    const current = await this.drafts.workspace.current(binding)
    const head = await current.head()
    const index = (await current.git.raw(['write-tree'])).trim()
    const epoch = await this.readEpoch()
    const identity = snapshotIdentity(snapshot)
    const expected = task.application.after || task.application.checkpoint
    const canResume = task.state !== 'cancelled' && same(identity, expected) &&
      [task.localOid, task.application.commit].includes(head) &&
      [task.indexTree, task.application.tree].includes(index) &&
      acceptsMergeRecoveryEpoch(task, epoch)
    return { current, head, index, epoch, canResume,
      fingerprint: hash({ revision: task.revision, identity, head, index, epoch, mutationTaskId: binding.mutationTaskId }) }
  }
  async preview(id) {
    return this.drafts.workspace.withLock(async () => {
      const task = await this.drafts.scoped(id)
      const info = await this.inspectLocked(task, await this.drafts.workspace.project.read())
      return { task: publicMergeTask(task), fingerprint: info.fingerprint, canResume: info.canResume,
        head: info.head, epoch: info.epoch,
        explanation: info.canResume ? 'The saved checkpoint still matches; the interrupted transaction can resume.' :
          'Current documents, epoch or Git state differ from the saved checkpoint. Preserve current content and review the retained merge draft.' }
    })
  }
  async recover(id, { revision, fingerprint, mode, operationId }) {
    operationId = taskId(operationId)
    if (!['resume', 'preserve-current'].includes(mode)) throw refuse('Choose an explicit recovery action')
    const { drafts } = this, { workspace } = drafts
    return workspace.withLock(async () => {
      let task = await drafts.scoped(id)
      if (task.recovery?.operationId === operationId) {
        if (task.recovery.mode !== mode || task.recovery.actorId !== drafts.actorId) throw refuse('Recovery identity was used for another request')
        if (task.recovery.completedAt) {
          const binding = await workspace.store.read()
          if (binding.pending || (binding.mutationTaskId && binding.mutationTaskId !== task.id)) throw refuse('Workspace recovery ownership changed')
          // Completion was durable before the mutation block was released.
          // A retry of this operation only finishes that release.
          if (binding.mutationTaskId === task.id) await workspace.store.finishMutation(task.id)
          return task
        }
      }
      drafts.assertRevision(task, revision)
      // Recovery may start after the original attempt already advanced the
      // epoch. Prepare the currently authoritative generation, then recheck
      // the preview fingerprint inside the protected transaction.
      const recoveryEpoch = await this.readEpoch()
      await workspace.project.transaction(async tx => {
        const live = await tx.read()
        const info = await this.inspectLocked(task, live)
        if (info.fingerprint !== fingerprint) throw refuse('Recovery preview is stale; inspect current content again')
        if (mode === 'resume' && !info.canResume) throw refuse('The saved checkpoint no longer matches; automatic resumption would risk overwriting edits')
        const save = async updates => {
          await tx.assertActive()
          task = await drafts.save(task, { application: { ...task.application, ...updates } })
        }
        try {
          task = await drafts.save(task, { recovery: { operationId, mode, actorId: drafts.actorId } })
          if (mode === 'preserve-current') {
            // User explicitly chooses to keep the present collaborative text,
            // including partial application/new edits. Do not reset HEAD/index.
            const disk = await readWorktree(info.current.directory)
            const retained = Path.join(task.application.directory, `preserved-disk-${task.revision}`)
            const diskManifest = await writeRecoverySnapshot(retained, disk)
            const documents = Path.join(task.application.directory, `preserved-documents-${task.revision}`)
            const documentManifest = await writeRecoverySnapshot(documents, live.files)
            await save({ phase: 'preserving-current', retained, diskManifest, documents, documentManifest,
              preservedHead: info.head, preservedIndex: info.index, checkpoint: snapshotIdentity(live) })
            await tx.assertActive()
            await writeWorktree(info.current.directory, live.files)
            await save({ phase: 'current-preserved' })
          } else {
            const after = await readRecoverySnapshot(Path.join(task.application.directory, 'after'), task.application.afterManifest)
            const changes = fileChanges(live.files, after)
            await tx.apply(changes, live, async event => {
              await save({ phase: event.phase === 'before' ? 'writing-document' : 'document-written',
                step: event.step, path: event.path,
                ...(event.phase === 'after' ? { checkpoint: snapshotIdentity(await tx.read()) } : {}) })
            })
            await save({ phase: 'documents-applied', after: snapshotIdentity(await tx.read()) })
            if (info.epoch === task.workspaceEpoch) {
              await tx.assertActive()
              if (typeof tx.advanceEpoch !== 'function') throw refuse('Prepared recovery epoch advancement is required')
              await tx.advanceEpoch()
            }
            await save({ phase: 'epoch-advanced' })
            await tx.assertActive()
            // Compare-and-swap even if an earlier attempt already advanced HEAD.
            await info.current.git.raw(['update-ref', `refs/heads/${task.targetBranch}`, task.application.commit, info.head])
            await save({ phase: 'ref-updated' })
            await info.current.git.raw(['read-tree', '--reset', task.application.tree])
            await tx.assertActive()
            await writeWorktree(info.current.directory, after)
            await save({ phase: 'worktree-updated' })
          }
        } catch (error) {
          task = await drafts.save(task, { state: 'recovery-required', failure: 'Recovery stopped; snapshots and journal are retained.' })
          throw error
        }
      }, { prepare: true, epoch: recoveryEpoch }).catch(async error => {
        // Also handles failure of the transaction's final lease check.
        if (task.state !== 'recovery-required') task = await drafts.save(task, { state: 'recovery-required', failure: 'Recovery transaction did not finish.' })
        throw error
      })
      task = await drafts.save(task, { state: mode === 'resume' ? 'resolved' : 'cancelled', lease: null,
        failure: null, resolutionCommit: mode === 'resume' ? task.application.commit : null,
        recovery: { operationId, mode, actorId: drafts.actorId, completedAt: drafts.clock() },
        application: { ...task.application, phase: mode === 'resume' ? 'complete' : 'current-preserved' } })
      await workspace.store.finishMutation(task.id)
      return task
    })
  }
}
