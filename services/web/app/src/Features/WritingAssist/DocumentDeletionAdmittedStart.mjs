import { createHash } from 'node:crypto'
import { createDocumentDeletionReservations, validateDeletionBinding, DeletionReservationError } from './DocumentDeletionReservations.mjs'

// All three collections must belong to the same Mongo client/session. Writes to
// task and project force a transaction conflict with settlement/admission cleanup;
// read-only checks would allow a late worker to commit after either changed.
export function createAdmittedReservationStart({ withTransaction, projects, tasks, reservations, objectId }) {
  return async (input, operationId) => {
    const binding = validateDeletionBinding(input)
    if (typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
      throw new DeletionReservationError(400, 'Invalid admitted deletion operation')
    }
    return withTransaction(async session => {
      const task = await tasks.findOne({ _id: input.taskId, projectId: input.projectId, userId: input.userId }, { session })
      const proposal = task?.proposals?.find(p => p.id === input.proposalId)
      if (task?.status !== 'completed' || proposal?.status !== 'applying' || proposal.mode !== 'delete-document' ||
          proposal.docId !== input.docId || proposal.path !== input.path || proposal.version !== input.expectedVersion ||
          typeof proposal.before !== 'string' || createHash('sha256').update(proposal.before).digest('hex') !== input.baseHash) {
        throw new DeletionReservationError(409, 'Accepted deletion changed before reservation creation')
      }
      const claimed = await tasks.updateOne({ _id: input.taskId, projectId: input.projectId, userId: input.userId,
        status: 'completed', proposals: { $elemMatch: { id: input.proposalId, status: 'applying', before: proposal.before } },
      }, { $inc: { deletionReservationStarts: 1 } }, { session })
      if (claimed.matchedCount !== 1) throw new DeletionReservationError(409, 'Deletion task is no longer applying')
      const field = `documentDeletionAdmissions.${input.docId}`
      const query = { _id: objectId(input.projectId), [`${field}.operationId`]: operationId }
      for (const [key, value] of Object.entries(binding)) query[`${field}.${key}`] = value
      const admitted = await projects.updateOne(query, { $inc: { [`${field}.reservationStarts`]: 1 } }, { session })
      if (admitted.matchedCount !== 1) throw new DeletionReservationError(409, 'Deletion admission is no longer available')
      const store = createDocumentDeletionReservations({
        findOne: query => reservations.findOne(query, { session }),
        updateOne: (query, update, options) => reservations.updateOne(query, update, { ...options, session }),
      })
      return store.begin(input, { operationId })
    })
  }
}
