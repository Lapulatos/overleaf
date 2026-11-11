import settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import { db, ObjectId } from '../../infrastructure/mongodb.mjs'
import { DocumentDeletionReservation } from '../../models/DocumentDeletionReservation.mjs'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import { createDeletionRecoveryReader } from './DocumentDeletionRecovery.mjs'

const read = createDeletionRecoveryReader({
  getReservation: (projectId, docId, operationId) => DocumentDeletionReservation.collection.findOne(
    { _id: `${projectId}:${docId}`, projectId, docId, operationId }, { readPreference: 'primary' }
  ),
  getProject: projectId => db.projects.findOne(
    { _id: new ObjectId(projectId) },
    { projection: { rootFolder: 1, deletionReceipts: 1 }, readPreference: 'primary' }
  ),
  getDocument: (projectId, docId) => DocstoreManager.promises.getDoc(projectId, docId),
})

// Registered only on the authenticated private API; no generic reload bypass.
export default expressify(async (req, res) => {
  if (settings.documentupdater?.reviewedDeletionEnabled !== true) return res.sendStatus(404)
  const { Project_id: projectId, doc_id: docId, operation_id: operationId } = req.params
  res.json(await read(projectId, docId, operationId))
})
