import { DeletionReservationError } from './DocumentDeletionReservations.mjs'

// Internal: invoke under the project lock after acceptance/authorization. This
// confirms history only; document storage/cache cleanup is a separate stage.
export function createDocumentDeletionHistoryConfirmation({
  projects, reservations, objectId, queueHistory, getLatestVersion,
}) {
  const conflict = message => new DeletionReservationError(409, message)
  return async function confirm(input, operationId) {
    const reservation = await reservations.read(input)
    if (reservation.operationId !== operationId || !['committing', 'committed'].includes(reservation.state) ||
        typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
      throw conflict('Deletion history operation conflicts')
    }
    const id = objectId(input.projectId)
    const key = `deletionReceipts.${operationId}`
    const read = () => projects.findOne({ _id: id }, {
      projection: { [key]: 1, deletionHistoryPending: 1, version: 1, overleaf: 1 }, readPreference: 'primary',
    })
    function receiptFrom(project) {
      const receipt = project?.deletionReceipts?.[operationId]
      if (!receipt || receipt.operationId !== operationId || receipt.docId !== input.docId ||
          receipt.userId !== input.userId || receipt.path !== input.path ||
          receipt.expectedVersion !== input.expectedVersion || receipt.baseHash !== input.baseHash ||
          typeof receipt.projectHistoryId !== 'string' || !receipt.projectHistoryId ||
          !Number.isSafeInteger(receipt.projectVersion) || receipt.projectVersion < 1) {
        throw conflict('Deletion history receipt conflicts')
      }
      return receipt
    }
    function confirmed(receipt) {
      const result = receipt.historyConfirmed
      return result?.projectStructureVersion === `${receipt.projectVersion}.0` &&
        result?.projectHistoryId === receipt.projectHistoryId &&
        Number.isSafeInteger(result?.version) && result.version >= 0
    }
    const project = await read()
    const receipt = receiptFrom(project)
    if (confirmed(receipt)) return receipt.historyConfirmed
    if (project.deletionHistoryPending !== operationId || project.version !== receipt.projectVersion ||
        project.overleaf?.history?.id !== receipt.projectHistoryId) {
      throw conflict('Deletion history ordering changed')
    }
    await queueHistory(input.projectId, input.docId, operationId)
    const latest = await getLatestVersion(input.projectId)
    if (latest?.projectStructureVersion !== `${receipt.projectVersion}.0` ||
        String(latest?.projectHistoryId) !== receipt.projectHistoryId ||
        !Number.isSafeInteger(latest?.version) || latest.version < 0) {
      throw new DeletionReservationError(502, 'Deletion history persistence is not confirmed')
    }
    const proof = { projectHistoryId: receipt.projectHistoryId,
      projectStructureVersion: latest.projectStructureVersion, version: latest.version, confirmedAt: new Date() }
    await projects.updateOne({ _id: id, deletionHistoryPending: operationId,
      version: receipt.projectVersion, 'overleaf.history.id': receipt.projectHistoryId,
      [`${key}.operationId`]: operationId }, {
      $set: { [`${key}.historyConfirmed`]: proof }, $unset: { deletionHistoryPending: 1 },
    })
    const persisted = receiptFrom(await read())
    if (!confirmed(persisted)) throw conflict('Deletion history acknowledgement conflicts')
    return persisted.historyConfirmed
  }
}
