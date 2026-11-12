import { inspectionFingerprint } from './WritingAssistApplicationDisposition.mjs'
import { AgentError } from './WritingAssistErrors.mjs'
import { assertWorkspaceIdentity } from './WritingAssistWorkspaceIdentity.mjs'
import { validatedApplicationAcknowledgement } from './WritingAssistApplicationAcknowledgement.mjs'

const selectedDocument = (documents, proposal) => documents.find(doc => doc.id === proposal.docId) ||
  documents.find(doc => doc.path === proposal.path) || null

export function createApplicationInspection({ canWrite, store, snapshot, readWorkspaceIdentity }) {
  return async (userId, projectId, taskId, proposalId) => {
    const authorize = async () => {
      if (!await canWrite(userId, projectId)) throw new AgentError(403, 'Project write access required')
    }
    await authorize()
    const task = await store.find(taskId, userId, projectId)
    if (!task) throw new AgentError(404, 'Task not found')
    const proposal = task.proposals?.find(item => item.id === proposalId)
    if (!proposal || proposal.mode === 'delete-document' || !['applying', 'uncertain', 'closed-unconfirmed'].includes(proposal.status)) {
      throw new AgentError(409, 'This proposal does not need write inspection')
    }
    const identity = await readWorkspaceIdentity(projectId)
    const current = selectedDocument(await snapshot(projectId), proposal)
    const latest = selectedDocument(await snapshot(projectId), proposal)
    assertWorkspaceIdentity(identity, await readWorkspaceIdentity(projectId))
    await authorize()
    // Equal bytes are an observation, not proof of an earlier successful write.
    if (JSON.stringify(current) !== JSON.stringify(latest)) {
      throw new AgentError(409, 'Document changed during inspection. Inspect again.')
    }
    let workspaceMatches = true
    try { assertWorkspaceIdentity(task.workspaceIdentity, identity) }
    catch (error) {
      if (error.code !== 'AI_WORKSPACE_CHANGED') throw error
      workspaceMatches = false
    }
    let comparison = 'missing'
    if (current) {
      if (proposal.docId && current.id !== proposal.docId) comparison = 'replaced'
      else if (current.path !== proposal.path) comparison = 'renamed'
      else if (current.content === proposal.after) comparison = 'matches-proposal'
      else if (current.content === proposal.before) comparison = 'matches-baseline'
      else comparison = 'changed'
    }
    const result = {
      taskId, proposalId, path: proposal.path, status: proposal.status,
      checkedAt: new Date().toISOString(), readOnly: true, confirmed: false, canRetry: false,
      acknowledgement: validatedApplicationAcknowledgement(task, proposal),
      workspace: { baseline: task.workspaceIdentity || null, current: identity }, workspaceMatches,
      comparison, disposition: proposal.applicationDisposition || null,
      baseline: { docId: proposal.docId || null, version: proposal.version ?? null, content: proposal.before },
      proposed: { content: proposal.after }, current,
    }
    return { ...result, fingerprint: inspectionFingerprint(result) }
  }
}
