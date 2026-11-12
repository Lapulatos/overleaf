import Path from 'node:path'
import { createHash } from 'node:crypto'
import { taskId } from './CollaborationTaskStore.mjs'
import { snapshotIdentity } from './MergeDraftService.mjs'
import { publicShellDraft } from './ShellDraftService.mjs'
import { fileChanges } from './WorktreeFiles.mjs'
import { readRecoverySnapshot, writeRecoverySnapshot } from './RecoverySnapshots.mjs'
const refuse = message => Object.assign(new Error(message), { status: 409 })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export class ShellRecoveryService {
  constructor({ drafts, workspaceStore }) { Object.assign(this, { drafts, workspaceStore }) }
  async inspect(task, snapshot) {
    if (!task.application || !['applying', 'recovery-required', 'applied', 'preserved'].includes(task.state)) throw refuse('No shell application to recover')
    const binding = await this.workspaceStore.read()
    const acquireMutation = !binding.mutationTaskId && !binding.pending &&
      (task.application.phase === 'prepared' || task.application.phase === 'complete')
    if (binding.pending || (binding.mutationTaskId !== task.id && !acquireMutation)) throw refuse('Workspace recovery ownership changed')
    const identity = snapshotIdentity(snapshot), epoch = await this.drafts.readEpoch()
    const canResume = task.state !== 'preserved' && task.recovery?.mode !== 'preserve-current' && same(identity, task.application.after || task.application.checkpoint) &&
      (epoch === task.workspaceEpoch || epoch === task.workspaceEpoch + 1)
    const fingerprint = createHash('sha256').update(JSON.stringify({ id: task.id, revision: task.revision, identity, epoch, mutationTaskId: binding.mutationTaskId ?? null, acquireMutation })).digest('hex')
    return { fingerprint, canResume, epoch, acquireMutation }
  }
  async preview(id) {
    const { drafts } = this
    return drafts.withLock(async () => {
      await drafts.authorize()
      const task = await drafts.owned(id), info = await this.inspect(task, await drafts.project.read())
      await drafts.authorize()
      return { task: publicShellDraft(task), ...info }
    })
  }
  async recover(id, { revision, fingerprint, mode, operationId }) {
    operationId = taskId(operationId)
    if (!['resume', 'preserve-current'].includes(mode)) throw refuse('Choose an explicit recovery action')
    const { drafts, workspaceStore } = this
    return drafts.withLock(async () => {
      await drafts.authorize()
      let task = await drafts.owned(id)
      if (task.recovery?.operationId === operationId) {
        if (task.recovery.mode !== mode || task.recovery.actorId !== drafts.actorId) throw refuse('Recovery identity reused for another request')
        if (task.recovery.completedAt) {
          const binding = await workspaceStore.read()
          if (binding.pending || (binding.mutationTaskId && binding.mutationTaskId !== task.id)) throw refuse('Workspace recovery ownership changed')
          // The document transaction already completed. Retry only settlement,
          // never replay edits or advance the epoch after a lost response.
          const state = mode === 'resume' ? 'applied' : 'preserved'
          if (task.state !== state) task = await drafts.save(task, { state, failure: null, failurePhase: null })
          if (binding.mutationTaskId === task.id) await workspaceStore.finishMutation(task.id)
          return task
        }
      }
      if (task.revision !== revision) throw refuse('Recovery task changed; refresh')
      const epoch = await drafts.readEpoch()
      await drafts.project.transaction(async tx => {
        await drafts.authorize()
        const live = await tx.read(), info = await this.inspect(task, live)
        if (info.fingerprint !== fingerprint) throw refuse('Recovery preview is stale; inspect again')
        if (mode === 'resume' && !info.canResume) throw refuse('Current document identities or versions differ; resumption would risk overwriting edits')
        if (typeof tx.advanceEpoch !== 'function') throw refuse('Prepared epoch advancement is required')
        const save = async fields => {
          await tx.assertActive(); await drafts.authorize()
          task = await drafts.save(task, { application: { ...task.application, ...fields } })
        }
        if (info.acquireMutation) {
          await tx.assertActive(); await drafts.authorize()
          await workspaceStore.beginMutation(task.id)
        }
        task = await drafts.save(task, { recovery: { operationId, mode, actorId: drafts.actorId } })
        if (mode === 'preserve-current') {
          // Preserve newer edits and evidence; never replay an uncertain write.
          const directory = Path.join(drafts.paths(id).directory, `preserved-${task.revision}`)
          const manifest = await writeRecoverySnapshot(directory, live.files)
          await save({ phase: 'current-preserved', preservedDirectory: directory, preservedManifest: manifest, checkpoint: snapshotIdentity(live) })
        } else {
          const desired = await readRecoverySnapshot(drafts.paths(id).reviewDirectory, task.reviewManifest)
          await tx.apply(fileChanges(live.files, desired), live, async event => {
            await save({ phase: event.phase === 'before' ? 'writing-document' : 'document-written', path: event.path, step: event.step,
              ...(event.phase === 'after' ? { checkpoint: snapshotIdentity(await tx.read()) } : {}) })
          })
          await save({ phase: 'documents-applied', after: snapshotIdentity(await tx.read()) })
        }
        // Fence stale sessions even for preserve-current; no document is reset.
        await tx.advanceEpoch()
        await save({ phase: mode === 'resume' ? 'epoch-advanced' : 'current-preserved' })
      }, { prepare: true, epoch }).catch(async error => {
        if (task.recovery?.operationId === operationId) await drafts.save(task, { state: 'recovery-required', failurePhase: 'apply', failure: 'Recovery interrupted; inspect retained journal before another action.' })
        throw error
      })
      try {
        task = await drafts.save(task, { state: mode === 'resume' ? 'applied' : 'preserved', failure: null, failurePhase: null,
          recovery: { operationId, mode, actorId: drafts.actorId, completedAt: drafts.clock() } })
        await workspaceStore.finishMutation(id)
        return task
      } catch (error) {
        await drafts.save(task, { state: 'recovery-required', failurePhase: 'apply', failure: 'Recovery settlement requires reconciliation.' })
        throw error
      }
    })
  }
}
