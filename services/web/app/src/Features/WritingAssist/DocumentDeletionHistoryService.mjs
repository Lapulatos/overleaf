import settings from '@overleaf/settings'
import { fetchJson } from '@overleaf/fetch-utils'
import { db, ObjectId } from '../../infrastructure/mongodb.mjs'
import { DocumentDeletionReservation } from '../../models/DocumentDeletionReservation.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import { createDocumentDeletionReservations } from './DocumentDeletionReservations.mjs'
import { createDeletionHistoryPreflight } from './DocumentDeletionHistoryPreflight.mjs'
import { createDocumentDeletionHistoryConfirmation } from './DocumentDeletionHistoryConfirmation.mjs'

// Internal adapter, not a public route. The caller owns authorization/project lock.
export const confirmDeletionHistory = createDocumentDeletionHistoryConfirmation({
  projects: db.projects,
  reservations: createDocumentDeletionReservations(DocumentDeletionReservation.collection),
  objectId: id => new ObjectId(id),
  queueHistory: DocumentUpdaterHandler.promises.queueReviewedDeletionHistory,
  getLatestVersion: projectId => fetchJson(
    `${settings.apis.project_history.url}/project/${projectId}/version`,
    { signal: AbortSignal.timeout(30000) }
  ),
})

export const preflightDeletionHistory = createDeletionHistoryPreflight({
  getProject: projectId => db.projects.findOne(
    { _id: new ObjectId(projectId) },
    { projection: { overleaf: 1, deletionHistoryPending: 1 }, readPreference: 'primary' }
  ),
  getResyncState: projectId => fetchJson(
    `${settings.apis.project_history.url}/project/${projectId}/resync-pending`,
    { signal: AbortSignal.timeout(30000) }
  ),
  getLatestVersion: projectId => fetchJson(
    `${settings.apis.project_history.url}/project/${projectId}/version`,
    { signal: AbortSignal.timeout(30000) }
  ),
})
