import { applicationOutcomeFields } from './WritingAssistApplicationOutcome.mjs'
import { AgentError } from './WritingAssistErrors.mjs'
import { validatedApplicationAcknowledgement } from './WritingAssistApplicationAcknowledgement.mjs'

// Recovers bookkeeping only. No document mutation dependency is available here.
export function createApplicationRecovery({ canWrite, store, withApplicationLock }) {
  return async (userId, projectId, taskId, proposalId) => {
    const owned = async () => {
      if (!await canWrite(userId, projectId)) throw new AgentError(403, 'Project write access required')
      const task = await store.find(taskId, userId, projectId)
      if (!task) throw new AgentError(404, 'Task not found')
      return task
    }
    const initial = await owned()
    const logicalProjectId = initial.workspaceIdentity?.projectId || projectId
    return withApplicationLock(logicalProjectId, async () => {
      // Wait for a still-running application to leave its transaction first.
      const task = await owned()
      if ((task.workspaceIdentity?.projectId || projectId) !== logicalProjectId)
        throw new AgentError(409, 'Task workspace changed during recovery')
      const proposal = task.proposals?.find(value => value.id === proposalId)
      if (task.status !== 'completed' || !proposal || !validatedApplicationAcknowledgement(task, proposal)) {
        throw new AgentError(409, 'No valid server acknowledgement is available. Inspect the retained snapshots; this write cannot be replayed automatically.')
      }
      applicationOutcomeFields(task, proposal)
      if (proposal.status === 'accepted') {
        if (task.applicationOutcome && !await store.recoverAcknowledged(task, proposal)) throw new AgentError(409, 'Workflow state changed during recovery. Refresh this task.')
        await store.releaseApplicationRetention(task.id)
        return owned()
      }
      if (!['applying', 'uncertain'].includes(proposal.status)) throw new AgentError(409, 'Proposal state changed. Refresh this task.')
      if (!await canWrite(userId, projectId)) throw new AgentError(403, 'Project write access required')
      if (!await store.recoverAcknowledged(task, proposal)) throw new AgentError(409, 'Proposal changed during recovery. Refresh this task.')
      return owned()
    })
  }
}
