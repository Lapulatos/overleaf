import { deletionDrainInventory } from './DocumentDeletionDrainInventory.mjs'
import { createHash } from 'node:crypto'
import { projectDeletionAdmission, settleDeletionAdmission, beginAdmittedDeletion, settleAdmittedDeletion } from './DocumentDeletionAdmissionService.mjs'
import { DocumentDeletionReservation } from '../../models/DocumentDeletionReservation.mjs'
import { WritingAssistTask } from '../../models/WritingAssistTask.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import AsyncLocalStorage from '../../infrastructure/AsyncLocalStorage.mjs'
import LockManager from '../../infrastructure/LockManager.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import { createDocumentDeletionReservations, DeletionReservationError } from './DocumentDeletionReservations.mjs'
import { createDocumentDeletionCoordinator } from './DocumentDeletionCoordinator.mjs'
import { createDeletionTaskRetention } from './DocumentDeletionTaskRetention.mjs'
import { createDeletionTeardown } from './DocumentDeletionTeardown.mjs'
import { preflightDeletionHistory } from './DocumentDeletionHistoryService.mjs'
import { commitDeletion, inspectDeletion, notifyDeletionCommitted } from './DocumentDeletionCommitService.mjs'

// Internal adapter for an already authorized whole-project removal. There is no
// route exposing this as a way to accept another user's pending suggestions.
export async function recoverAcceptedDeletionsForProjectRemoval(projectId, actorId) {
  projectId = String(projectId)
  actorId = String(actorId)
  if (![projectId, actorId].every(id => /^[a-f0-9]{24}$/.test(id))) {
    throw new DeletionReservationError(400, 'Invalid project removal identity')
  }
  const reservations = createDocumentDeletionReservations(DocumentDeletionReservation.collection)
  const retention = createDeletionTaskRetention(WritingAssistTask.collection)
  const readTask = id => WritingAssistTask.findById(id).read('primary').lean().exec()
  const authorize = async () => {
    AsyncLocalStorage.removeItem(`projectAccess:${projectId}`)
    if (!(await AuthorizationManager.promises.canUserAdminProject(actorId, projectId))) {
      throw new DeletionReservationError(403, 'Whole-project removal permission required')
    }
  }
  const resume = createDocumentDeletionCoordinator({
    authorize,
    beginAdmittedDeletion,
    readAdmission: (input, operationId) => projectDeletionAdmission.readAccepted(input, operationId),
    verifyAcceptedProposal: async input => {
      const task = await readTask(input.taskId)
      const proposal = task?.proposals?.find(item => item.id === input.proposalId)
      if (task?.projectId !== projectId || task.userId !== input.userId || task.status !== 'completed' ||
          proposal?.status !== 'applying' || proposal.mode !== 'delete-document' ||
          proposal.docId !== input.docId || proposal.path !== input.path || proposal.version !== input.expectedVersion ||
          typeof proposal.before !== 'string' || createHash('sha256').update(proposal.before).digest('hex') !== input.baseHash ||
          !(await retention.holdApplying(input.taskId, input.proposalId))) {
        throw new DeletionReservationError(409, 'Accepted project-removal recovery snapshot changed')
      }
    },
    // The outer drain already holds the SAME project structure lock. Reacquiring
    // it here would deadlock; existing-only mode prevents replacement operations.
    withProjectLock: async (_projectId, action) => action(),
    reservations, preflightHistory: preflightDeletionHistory,
    prepareDocument: DocumentUpdaterHandler.promises.prepareDocumentDeletion,
    commitDeletion, inspectDeletion, notifyCommitted: notifyDeletionCommitted,
  })
  return createDeletionTeardown({
    withProjectLock: (id, action) => LockManager.promises.runWithLock('sequentialProjectStructureUpdateLock', id, action),
    authorizeTeardown: authorize,
    closeAdmission: (id, userId) => projectDeletionAdmission.close(id, userId),
    assertDrained: async id => {
      const project = await projectDeletionAdmission.read(id)
      if (Object.keys(project.documentDeletionAdmissions || {}).length) {
        throw new DeletionReservationError(409, 'Project deletion admissions remain unsettled')
      }
    },
    listReservations: async id => {
      const project = await projectDeletionAdmission.read(id)
      const receipts = await (await DocumentDeletionReservation.collection.find({ projectId: id }, { readPreference: 'primary' })).toArray()
      return deletionDrainInventory(id, receipts, Object.values(project.documentDeletionAdmissions || {}))
    },
    readReservation: (id, docId) => DocumentDeletionReservation.collection.findOne({ _id: `${id}:${docId}` }, { readPreference: 'primary' }),
    readTask,
    claimRetry: (id, proposalId) => retention.claim(id, proposalId, true),
    holdApplying: (id, proposalId) => retention.holdApplying(id, proposalId),
    resumeAdmitted: (input, operationId) => resume(input, { admittedOperationId: operationId }),
    resumeExisting: (input, operationId) => resume(input, { existingOperationId: operationId }),
    settle: async (id, proposalId, status) => {
      if (await settleAdmittedDeletion(id, proposalId, status)) {
        await retention.releaseCompleted(id)
        return
      }
      await WritingAssistTask.updateOne({ _id: id, projectId,
        proposals: { $elemMatch: { id: proposalId, status: 'applying' } },
      }, { $set: { 'proposals.$.status': status } }).exec()
      await settleDeletionAdmission(id, proposalId)
      await retention.releaseCompleted(id)
    },
  })(projectId, actorId)
}
