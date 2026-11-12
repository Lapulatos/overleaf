import { readRecoverySnapshot } from './RecoverySnapshots.mjs'
import { snapshotIdentity } from './MergeDraftService.mjs'
import { fileChanges } from './WorktreeFiles.mjs'
import { shellReviewFingerprint } from './ShellDraftReview.mjs'
const refuse = message => Object.assign(new Error(message), { status: 409 })

// Applies sealed scratch bytes as uncommitted collaborative edits. No Git ref
// moves, commits, or automatic rollback are performed. Recovery must reconcile
// the retained baseline/review and per-document journal before replay.
export class ShellApplicationService {
  constructor({ drafts, workspaceStore }) { Object.assign(this, { drafts, workspaceStore }) }
  async apply(id, { revision, fingerprint }) {
    const { drafts, workspaceStore } = this
    return drafts.withLock(async () => {
      await drafts.authorize()
      let task = await drafts.owned(id)
      if (task.state !== 'review-ready' || task.revision !== revision || shellReviewFingerprint(task) !== fingerprint) throw refuse('Shell review changed; refresh before applying')
      if (typeof drafts.project.transaction !== 'function' || !workspaceStore?.beginMutation || !workspaceStore?.finishMutation) throw refuse('Prepared workspace integration is required')
      const paths = drafts.paths(id)
      await readRecoverySnapshot(paths.baselineDirectory, task.baselineManifest)
      const desired = await readRecoverySnapshot(paths.reviewDirectory, task.reviewManifest)
      await drafts.project.transaction(async tx => {
        await drafts.authorize()
        if (typeof tx.advanceEpoch !== 'function') throw refuse('Prepared epoch advancement is required')
        const before = await tx.read()
        if (await drafts.readEpoch() !== task.workspaceEpoch || JSON.stringify(snapshotIdentity(before)) !== JSON.stringify(task.baseline)) throw refuse('Collaborative workspace changed; keep this draft and prepare a new review')
        const changes = fileChanges(before.files, desired)
        task = await drafts.save(task, { state: 'applying', application: { phase: 'prepared', expectedEpoch: task.workspaceEpoch,
          reviewFingerprint: fingerprint, steps: changes.length, completedSteps: 0, checkpoint: snapshotIdentity(before) } })
        await workspaceStore.beginMutation(task.id)
        const savePhase = async fields => {
          await tx.assertActive(); await drafts.authorize()
          task = await drafts.save(task, { application: { ...task.application, ...fields } })
        }
        await tx.apply(changes, before, async event => {
          await savePhase({ phase: event.phase === 'before' ? 'writing-document' : 'document-written',
            path: event.path, step: event.step, completedSteps: event.step + (event.phase === 'after' ? 1 : 0),
            ...(event.phase === 'after' ? { checkpoint: snapshotIdentity(await tx.read()) } : {}) })
        })
        await savePhase({ phase: 'documents-applied', after: snapshotIdentity(await tx.read()) })
        await tx.advanceEpoch()
        await savePhase({ phase: 'epoch-advanced' })
      }, { prepare: true, epoch: task.workspaceEpoch }).catch(async error => {
        if (task.application) await drafts.save(task, { state: 'recovery-required', failurePhase: 'apply', failure: 'Application outcome requires reconciliation; do not replay or restore automatically.' })
        throw error
      })
      try {
        task = await drafts.save(task, { state: 'applied', application: { ...task.application, phase: 'complete' } })
        await workspaceStore.finishMutation(task.id)
        return task
      } catch (error) {
        await drafts.save(task, { state: 'recovery-required', failurePhase: 'apply', failure: 'Application settlement requires reconciliation; do not replay.' })
        throw error
      }
    })
  }
}
