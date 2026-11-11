import { DeletionReservationError } from './DocumentDeletionReservations.mjs'

// Read-only checks before fencing. Never resync documents during deletion recovery.
export function createDeletionHistoryPreflight({ getProject, getResyncState, getLatestVersion }) {
  return async projectId => {
    const project = await getProject(projectId)
    const history = project?.overleaf?.history
    if (!history?.id) {
      throw new DeletionReservationError(409, 'Project history is unavailable')
    }
    if (history.rangesSupportEnabled !== true) {
      throw new DeletionReservationError(409, 'Project history requires native migration before deletion')
    }
    if (project.deletionHistoryPending) {
      throw new DeletionReservationError(409, 'Another document deletion is awaiting history confirmation')
    }
    const state = await getResyncState(projectId)
    if (state?.resyncPending !== false) {
      throw new DeletionReservationError(409, 'Project history is not ready for deletion')
    }
    const latest = await getLatestVersion(projectId)
    if (latest?.projectHistoryId !== history.id ||
        !Number.isSafeInteger(latest?.version) || latest.version < 0) {
      throw new DeletionReservationError(409, 'Project history identity or revision is unavailable')
    }
  }
}
