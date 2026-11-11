// One-off recovery of this acceptance fixture only; not a general unlock tool.
// The deployed adapter rejects build.aux before executeDeletion or reservation.
import assert from 'node:assert/strict'
import mongoose from '/overleaf/services/web/app/src/infrastructure/Mongoose.mjs'
import LockManager from '/overleaf/services/web/app/src/infrastructure/LockManager.mjs'
import { readGitProjectSnapshot } from '/overleaf/services/web/app/src/Features/GitSync/GitNativeProjectSnapshot.mjs'
import { matchesTreeFingerprint } from '/overleaf/services/web/app/src/Features/GitSync/GitTreePreview.mjs'
import { validateDeletionBinding } from '/overleaf/services/web/app/src/Features/WritingAssist/DocumentDeletionReservations.mjs'
await mongoose.connectionPromise
const projectId = '6aee30c179c897758e370d23'
const operationId = '54b16f08-6eec-4fc3-9edf-aa9bcacdcd7d'
const attemptId = 'd760837d-8429-4473-bbce-db773d374853'
const writeId = 'a5d4f8e5-77e7-47a3-937e-a23ef9a447bc'
const db = mongoose.connection.db
await LockManager.promises.runWithLock('sequentialProjectStructureUpdateLock', projectId, async () => {
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const operations = db.collection('gitSyncOperations'), projects = db.collection('projects')
      const op = await operations.findOne({ _id: operationId, projectId }, { session })
      assert.equal(op.status, 'recovery-required')
      const a = op.application, step = a.plan.steps[0]
      assert.equal(a.attemptId, attemptId); assert.equal(a.nextIndex, 0); assert.deepEqual(a.receipts, [])
      assert.equal(a.inFlight.writeId, writeId); assert.equal(a.inFlight.index, 0)
      assert.equal(step.writeId, writeId); assert.equal(step.path, 'build.aux'); assert.equal(step.action, 'delete')
      assert.equal(op.deletionReservationStarts, undefined)
      const project = await projects.findOne({ _id: new mongoose.Types.ObjectId(projectId) }, { session })
      assert.equal(project.name, 'Git UX isolated acceptance 1cf56215-920a-4dac-8b85-ba1060293587')
      assert.equal(project.version, a.plan.expectedTreeVersion)
      assert.equal(project.gitSyncApplication.operationId, operationId)
      assert.equal(project.gitSyncApplication.attemptId, attemptId)
      assert.equal(project.gitSyncApplication.deletionReservationStarts, undefined)
      assert.equal(project.deletionReceipts?.[writeId], undefined)
      assert.equal(project.deletionHistoryPending, undefined)
      assert.equal(await db.collection('documentdeletionreservations').countDocuments({ projectId }, { session }), 0)
      assert.throws(() => validateDeletionBinding({ projectId, docId: step.docId,
        userId: project.gitSyncApplication.userId, source: 'git-sync', gitOperationId: operationId,
        gitAttemptId: attemptId, gitWriteId: writeId, gitReviewRevision: a.plan.reviewRevision,
        expectedVersion: step.expectedVersion, baseHash: step.beforeHash, path: step.path }), /Invalid deletion path/)
      const snapshot = await readGitProjectSnapshot(projectId)
      assert.equal(matchesTreeFingerprint(snapshot.files, a.plan.expectedWebFingerprint), true)
      assert.equal(snapshot.treeVersion, a.plan.expectedTreeVersion)
      const changed = await operations.updateOne({ _id: operationId, projectId, status: op.status,
        'application.attemptId': attemptId, 'application.nextIndex': 0, 'application.inFlight.writeId': writeId },
      { $set: { status: 'cancelled', fixtureRecovery: { at: new Date(), reason: 'Native validator rejected before deletion dispatch; unchanged snapshot and absent reservation verified under project lock.' } } }, { session })
      assert.equal(changed.matchedCount, 1)
      const released = await projects.updateOne({ _id: project._id, version: project.version,
        'gitSyncApplication.operationId': operationId, 'gitSyncApplication.attemptId': attemptId },
      { $unset: { gitSyncApplication: '' } }, { session })
      assert.equal(released.matchedCount, 1)
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' })
  } finally { await session.endSession() }
})
console.log(JSON.stringify({ projectId, operationId, status: 'cancelled', filesChanged: false, reservationCreated: false }))
process.exit(0)
