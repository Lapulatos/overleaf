import { createHash } from 'node:crypto'
import { DeletionReservationError } from './DocumentDeletionReservations.mjs'

// Internal read-only proof. It never reloads a document into the collaboration cache.
export function createDeletionRecoveryReader({ getReservation, getProject, getDocument }) {
  const conflict = () => new DeletionReservationError(409, 'Deletion recovery snapshot is unavailable or changed')
  return async (projectId, docId, operationId) => {
    if (![projectId, docId].every(id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) ||
        typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
      throw new DeletionReservationError(400, 'Invalid deletion recovery identity')
    }
    const read = () => getReservation(projectId, docId, operationId)
    const row = await read()
    if (!row || row.projectId !== projectId || row.docId !== docId || row.operationId !== operationId || row.state !== 'fenced') throw conflict()
    function checkProject(project) {
      const paths = []
      function visit(folder, prefix) {
        for (const doc of folder.docs || []) if (String(doc._id) === docId) paths.push(prefix + doc.name)
        for (const child of folder.folders || []) visit(child, `${prefix}${child.name}/`)
      }
      for (const root of project?.rootFolder || []) visit(root, '')
      if (paths.length !== 1 || paths[0] !== row.path || project?.deletionReceipts?.[operationId]) throw conflict()
    }
    checkProject(await getProject(projectId))
    // Native docstore reads support archived content but do not pass include_deleted.
    const doc = await getDocument(projectId, docId)
    if (!Array.isArray(doc?.lines) || !doc.lines.every(line => typeof line === 'string') ||
        !Number.isSafeInteger(doc.version) || doc.version !== row.expectedVersion ||
        createHash('sha256').update(doc.lines.join('\n')).digest('hex') !== row.baseHash) throw conflict()
    const current = await read()
    if (!current || current.state !== 'fenced' ||
        ['projectId', 'docId', 'operationId', 'path', 'expectedVersion', 'baseHash', 'taskId', 'proposalId', 'userId', 'source', 'gitOperationId', 'gitAttemptId', 'gitWriteId', 'gitReviewRevision']
          .some(key => current[key] !== row[key])) throw conflict()
    checkProject(await getProject(projectId))
    return { projectId, docId, operationId, version: row.expectedVersion, pathname: row.path, baseHash: row.baseHash }
  }
}
