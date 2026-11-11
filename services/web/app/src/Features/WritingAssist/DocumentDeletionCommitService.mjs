import { db, ObjectId } from '../../infrastructure/mongodb.mjs'
import { DocumentDeletionReservation } from '../../models/DocumentDeletionReservation.mjs'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import { createDocumentDeletionReservations } from './DocumentDeletionReservations.mjs'
import { createDocumentDeletionProjectCommit } from './DocumentDeletionProjectCommit.mjs'
import { confirmDeletionHistory } from './DocumentDeletionHistoryService.mjs'

const reservations = createDocumentDeletionReservations(DocumentDeletionReservation.collection)
const commitFiletree = createDocumentDeletionProjectCommit({
  projects: db.projects, reservations, objectId: id => new ObjectId(id),
})

// Internal coordinator adapters. Authorization/project lock belong to the caller.
export async function commitDeletion(input, reservation) {
  const receipt = await commitFiletree(input, reservation.operationId)
  await confirmDeletionHistory(input, reservation.operationId)
  await DocstoreManager.promises.deleteDoc(input.projectId, input.docId, receipt.name, receipt.removedAt)
  await DocumentUpdaterHandler.promises.cleanupDocumentDeletion(input.projectId, input.docId, reservation.operationId)
}

export async function inspectDeletion(input, reservation) {
  const current = await reservations.read(input)
  if (current.operationId !== reservation.operationId || !['committing', 'committed'].includes(current.state)) return false
  const project = await db.projects.findOne({ _id: new ObjectId(input.projectId) }, {
    projection: { rootFolder: 1, [`deletionReceipts.${current.operationId}`]: 1 }, readPreference: 'primary',
  })
  const receipt = project?.deletionReceipts?.[current.operationId]
  if (!receipt || receipt.operationId !== current.operationId || receipt.docId !== input.docId ||
      receipt.path !== input.path || receipt.userId !== input.userId ||
      receipt.baseHash !== input.baseHash || receipt.expectedVersion !== input.expectedVersion ||
      !Number.isSafeInteger(receipt.projectVersion) || receipt.projectVersion < 1 ||
      typeof receipt.projectHistoryId !== 'string' || !receipt.projectHistoryId ||
      receipt.historyConfirmed?.projectStructureVersion !== `${receipt.projectVersion}.0` ||
      receipt.historyConfirmed?.projectHistoryId !== receipt.projectHistoryId ||
      !Number.isSafeInteger(receipt.historyConfirmed?.version) || receipt.historyConfirmed.version < 0) return false
  const containsDoc = folder => (folder.docs || []).some(doc => String(doc._id) === input.docId) ||
    (folder.folders || []).some(containsDoc)
  if ((project.rootFolder || []).some(containsDoc)) return false
  const meta = await db.docs.findOne({ _id: new ObjectId(input.docId), project_id: new ObjectId(input.projectId) }, {
    projection: { deleted: 1 }, readPreference: 'primary',
  })
  if (meta?.deleted !== true) return false
  // Re-run idempotent eviction to verify live cache state, rather than trusting
  // a past HTTP acknowledgement or a stale cacheCleared timestamp.
  await DocumentUpdaterHandler.promises.cleanupDocumentDeletion(input.projectId, input.docId, current.operationId)
  return true
}

export async function notifyDeletionCommitted(input) {
  await EditorRealTimeController.emitToRoom(input.projectId, 'removeEntity', input.docId, 'writing-assist')
}
