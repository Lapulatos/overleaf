import { createAtomicDeletionSettlement } from './DocumentDeletionAtomicSettlement.mjs'
import mongoose from '../../infrastructure/Mongoose.mjs'
import { createAdmittedReservationStart } from './DocumentDeletionAdmittedStart.mjs'
import { createDeletionAdmissionSettlement } from './DocumentDeletionAdmissionSettlement.mjs'
import { db, ObjectId } from '../../infrastructure/mongodb.mjs'
import { WritingAssistTask } from '../../models/WritingAssistTask.mjs'
import { DocumentDeletionReservation } from '../../models/DocumentDeletionReservation.mjs'
import { createProjectDeletionAdmission } from './DocumentDeletionProjectAdmission.mjs'
import { createDocumentDeletionReservations } from './DocumentDeletionReservations.mjs'

export const projectDeletionAdmission = createProjectDeletionAdmission({
  projects: db.projects, objectId: value => new ObjectId(value),
})
const reservations = createDocumentDeletionReservations(DocumentDeletionReservation.collection)

export const settleDeletionAdmission = createDeletionAdmissionSettlement({
  readTask: id => WritingAssistTask.findById(id).read('primary').lean().exec(),
  projectDeletionAdmission, reservations,
})

// Use one client for every collection touched by the transaction.
async function transactionAdapters() {
  await mongoose.connectionPromise
  const database = mongoose.connection.db
  return {
    projects: database.collection('projects'),
    tasks: database.collection(WritingAssistTask.collection.name),
    reservations: database.collection(DocumentDeletionReservation.collection.name),
    objectId: value => new ObjectId(value),
    withTransaction: async action => {
      const session = await mongoose.startSession()
      try {
        let result
        await session.withTransaction(async () => { result = await action(session) }, {
          readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary',
        })
        return result
      } finally { await session.endSession() }
    },
  }
}
export async function beginAdmittedDeletion(input, operationId) {
  return createAdmittedReservationStart(await transactionAdapters())(input, operationId)
}
export async function settleAdmittedDeletion(taskId, proposalId, status) {
  return createAtomicDeletionSettlement(await transactionAdapters())(taskId, proposalId, status)
}
