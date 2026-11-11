import { createHash } from 'node:crypto'
import { DeletionReservationError } from './DocumentDeletionReservations.mjs'

export function createDeletionAdmissionSettlement({ readTask, projectDeletionAdmission, reservations }) {
// Called only by the authenticated acceptance path after its task has settled.
// Finish ticket cleanup BEFORE restoring the task TTL, so recovery evidence is
// retained if this read/CAS fails or a service response is lost.
return async function settleDeletionAdmission(taskId, proposalId) {
  const task = await readTask(taskId)
  const proposal = task?.proposals?.find(item => item.id === proposalId)
  if (proposal?.mode !== 'delete-document' || !['accepted', 'conflict'].includes(proposal.status)) return
  const project = await projectDeletionAdmission.read(task.projectId)
  const ticket = project.documentDeletionAdmissions?.[proposal.docId]
  if (!ticket) return // Legacy operation, or an already acknowledged cleanup.
  const input = {
    projectId: task.projectId, docId: proposal.docId, userId: task.userId,
    taskId, proposalId, expectedVersion: proposal.version, path: proposal.path,
    baseHash: createHash('sha256').update(proposal.before).digest('hex'),
  }
  await projectDeletionAdmission.readAccepted(input, ticket.operationId)
  const receipt = await reservations.find(input)
  const finished = proposal.status === 'accepted'
    ? receipt?.state === 'committed' && receipt.operationId === ticket.operationId
    : !receipt
  if (!finished) throw new DeletionReservationError(409, 'Deletion settlement has no matching terminal outcome')
  await projectDeletionAdmission.releaseAfterSettlement(input, ticket.operationId)
}
}
