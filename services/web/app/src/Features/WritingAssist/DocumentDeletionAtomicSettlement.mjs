import { createHash } from 'node:crypto'
import { validateDeletionBinding, DeletionReservationError } from './DocumentDeletionReservations.mjs'

export function createAtomicDeletionSettlement({ withTransaction, projects, tasks, reservations, objectId }) {
  const conflict = () => new DeletionReservationError(409, 'Deletion terminal outcome is not confirmed')
  return async (taskId, proposalId, status) => {
    if (!['accepted', 'conflict'].includes(status)) return false
    return withTransaction(async session => {
      const task = await tasks.findOne({ _id: taskId }, { session })
      const proposal = task?.proposals?.find(p => p.id === proposalId)
      if (proposal?.mode !== 'delete-document') return false
      const project = await projects.findOne({ _id: objectId(task.projectId) }, { session })
      const ticket = project?.documentDeletionAdmissions?.[proposal.docId]
      if (!ticket) return false // Legacy/already-settled operation uses existing path.
      if (task.status !== 'completed' || !['applying', status].includes(proposal.status) || typeof proposal.before !== 'string') throw conflict()
      const input = validateDeletionBinding({ taskId, proposalId, userId: task.userId, projectId: task.projectId,
        docId: proposal.docId, path: proposal.path, expectedVersion: proposal.version,
        baseHash: createHash('sha256').update(proposal.before).digest('hex'),
      })
      if (typeof ticket.operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ticket.operationId) ||
          Object.entries(input).some(([key, value]) => ticket[key] !== value)) throw conflict()
      const receipt = await reservations.findOne({ _id: `${input.projectId}:${input.docId}` }, { session })
      if (status === 'accepted' ? (!receipt || receipt.state !== 'committed' || receipt.operationId !== ticket.operationId ||
          Object.entries(input).some(([key, value]) => receipt[key] !== value)) : receipt !== null) throw conflict()
      const result = await tasks.updateOne({ _id: taskId, projectId: task.projectId, userId: task.userId, status: 'completed',
        proposals: { $elemMatch: { id: proposalId, status: proposal.status, before: proposal.before } },
      }, { $set: { 'proposals.$.status': status }, $inc: { deletionSettlementRevision: 1 } }, { session })
      if (result.matchedCount !== 1) throw conflict()
      const field = `documentDeletionAdmissions.${input.docId}`
      const query = { _id: objectId(input.projectId), [`${field}.operationId`]: ticket.operationId }
      for (const [key, value] of Object.entries(input)) query[`${field}.${key}`] = value
      const released = await projects.updateOne(query, { $unset: { [field]: 1 } }, { session })
      if (released.modifiedCount !== 1) throw conflict()
      return true
    })
  }
}
