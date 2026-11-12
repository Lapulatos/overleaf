import { createHash } from 'node:crypto'
import { AgentError } from './WritingAssistErrors.mjs'

export function inspectionFingerprint(inspection) {
  // Exclude observation time; include every identity/content observation.
  return createHash('sha256').update(JSON.stringify({
    taskId: inspection.taskId, proposalId: inspection.proposalId,
    workspace: inspection.workspace, baseline: inspection.baseline,
    proposed: inspection.proposed, current: inspection.current,
    acknowledgement: inspection.acknowledgement,
  })).digest('hex')
}

export function createApplicationDisposition({ canWrite, store, inspect, withApplicationLock }) {
  return async (userId, projectId, taskId, proposalId, { fingerprint, decision }) => {
    if (decision !== 'close-without-retry' || !/^[a-f0-9]{64}$/.test(fingerprint || '')) throw new AgentError(400, 'Review the current document before closing this task')
    const owned = async () => {
      if (!await canWrite(userId, projectId)) throw new AgentError(403, 'Project write access required')
      const task = await store.find(taskId, userId, projectId)
      if (!task) throw new AgentError(404, 'Task not found')
      return task
    }
    const initial = await owned()
    const logicalProjectId = initial.workspaceIdentity?.projectId || projectId
    return withApplicationLock(logicalProjectId, async () => {
      const task = await owned()
      if ((task.workspaceIdentity?.projectId || projectId) !== logicalProjectId) throw new AgentError(409, 'Task workspace changed')
      const proposal = task.proposals?.find(value => value.id === proposalId)
      if (task.status !== 'completed' || !proposal || proposal.mode === 'delete-document') throw new AgentError(409, 'This operation cannot be closed here')
      if (proposal.status === 'closed-unconfirmed' && proposal.applicationDisposition?.fingerprint === fingerprint) return task
      if (!['applying', 'uncertain'].includes(proposal.status)) throw new AgentError(409, 'Task state changed. Inspect again.')
      const observation = await inspect(userId, projectId, taskId, proposalId)
      if (observation.acknowledgement) throw new AgentError(409, 'This operation has a server acknowledgement. Use acknowledged recovery instead.')
      if (inspectionFingerprint(observation) !== fingerprint) throw new AgentError(409, 'The reviewed document or workspace changed. Inspect again before closing.')
      await owned()
      const disposition = { kind: 'manual-close-without-retry', fingerprint, closedAt: new Date().toISOString(), userId,
        outcome: 'unconfirmed', replayAllowed: false, observation }
      if (!await store.closeUnconfirmed(task, proposal, disposition)) throw new AgentError(409, 'Task changed before closure. Inspect again.')
      return owned()
    })
  }
}
