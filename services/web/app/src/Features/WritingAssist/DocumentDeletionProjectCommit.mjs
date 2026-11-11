import { DeletionReservationError } from './DocumentDeletionReservations.mjs'

// Internal file-tree commit only. Call under the project lock after authorization.
// The receipt and removal share one Mongo update; history/storage cleanup follows.
// No task/HTTP endpoint enables this primitive yet.
export function createDocumentDeletionProjectCommit({ projects, reservations, objectId }) {
  const conflict = message => new DeletionReservationError(409, message)

  function locate(project, docId) {
    const matches = []
    function visit(folder, mongoPath, parentPath) {
      for (const [index, doc] of (folder.docs || []).entries()) {
        if (String(doc._id) === docId) matches.push({ doc, mongoPath: `${mongoPath}.docs.${index}`, path: `${parentPath}${doc.name}` })
      }
      for (const [index, child] of (folder.folders || []).entries()) {
        visit(child, `${mongoPath}.folders.${index}`, `${parentPath}${child.name}/`)
      }
    }
    for (const [index, root] of (project.rootFolder || []).entries()) visit(root, `rootFolder.${index}`, '')
    if (matches.length !== 1) throw conflict('Deletion document missing or ambiguous')
    return matches[0]
  }

  return async function commit(input, operationId) {
    const reservation = await reservations.read(input)
    if (reservation.operationId !== operationId || !['committing', 'committed'].includes(reservation.state)) {
      throw conflict('Deletion is not prepared')
    }
    // Operation IDs are server-generated UUIDs; still validate before using a key.
    if (typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
      throw conflict('Invalid deletion operation')
    }
    const projectId = objectId(input.projectId)
    const receiptKey = `deletionReceipts.${operationId}`
    const projection = { rootFolder: 1, rootDoc_id: 1, version: 1, overleaf: 1, [receiptKey]: 1 }
    const read = () => projects.findOne({ _id: projectId }, { projection, readPreference: 'primary' })
    function existing(project) {
      const receipt = project?.deletionReceipts?.[operationId]
      if (!receipt) return null
      if (receipt.docId !== input.docId || receipt.path !== input.path ||
          receipt.operationId !== operationId || receipt.userId !== input.userId ||
          receipt.expectedVersion !== input.expectedVersion || receipt.baseHash !== input.baseHash) {
        throw conflict('Deletion commit receipt conflicts')
      }
      return receipt
    }
    const project = await read()
    if (!project) throw conflict('Deletion project missing')
    const prior = existing(project)
    if (prior) return prior
    if (reservation.state === 'committed') throw conflict('Completed deletion has no project receipt')
    if (!Number.isSafeInteger(project.version) || project.version < 0 || project.version >= Number.MAX_SAFE_INTEGER) throw conflict('Invalid project version')
    const found = locate(project, input.docId)
    if (found.path !== input.path) throw conflict('Deletion document path changed')
    const removedAt = new Date()
    const receipt = {
      operationId, docId: input.docId, userId: input.userId, path: found.path,
      name: found.doc.name, projectVersion: project.version + 1,
      projectHistoryId: project.overleaf?.history?.id ?? null,
      expectedVersion: input.expectedVersion, baseHash: input.baseHash, removedAt,
    }
    const arrayPath = found.mongoPath.slice(0, found.mongoPath.lastIndexOf('.'))
    const update = {
      $pull: { [arrayPath]: { _id: objectId(input.docId) } },
      $inc: { version: 1 },
      $set: { [receiptKey]: receipt, deletionHistoryPending: operationId, lastUpdated: removedAt, lastUpdatedBy: objectId(input.userId) },
    }
    if (String(project.rootDoc_id) === input.docId) update.$unset = { rootDoc_id: 1 }
    // Version CAS protects indexed paths against concurrent structural changes.
    await projects.updateOne({ _id: projectId, version: project.version, deletionHistoryPending: { $exists: false },
      [`${found.mongoPath}._id`]: objectId(input.docId), [receiptKey]: { $exists: false } }, update)
    // Also resolves lost/competing acknowledgements by the persisted operation.
    const committed = existing(await read())
    if (!committed) throw conflict('Project structure changed before deletion')
    return committed
  }
}
