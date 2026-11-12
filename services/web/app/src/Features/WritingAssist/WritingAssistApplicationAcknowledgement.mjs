import { createHash } from 'node:crypto'
import { assertWorkspaceIdentity } from './WritingAssistWorkspaceIdentity.mjs'
const hash = value => createHash('sha256').update(value).digest('hex')

export function applicationAcknowledgement(task, proposal) {
  return {
    state: 'server-acknowledged', operationId: proposal.id, taskId: task.id,
    projectId: task.projectId, userId: task.userId,
    workspaceIdentity: task.workspaceIdentity || null,
    mode: proposal.mode || 'edit-document', path: proposal.path,
    docId: proposal.docId || null, expectedVersion: proposal.version ?? null,
    beforeHash: hash(proposal.before), afterHash: hash(proposal.after),
    acknowledgedAt: new Date().toISOString(),
  }
}

export function validatedApplicationAcknowledgement(task, proposal) {
  const value = proposal.applicationAcknowledgement
  if (!value || proposal.mode === 'delete-document') return null
  const expected = applicationAcknowledgement(task, proposal)
  try { assertWorkspaceIdentity(value.workspaceIdentity, expected.workspaceIdentity) }
  catch { return null }
  for (const key of Object.keys(expected).filter(key => !['acknowledgedAt', 'workspaceIdentity'].includes(key))) {
    if (JSON.stringify(value[key]) !== JSON.stringify(expected[key])) return null
  }
  if (typeof value.acknowledgedAt !== 'string' || !Number.isFinite(Date.parse(value.acknowledgedAt))) return null
  return { state: value.state, operationId: value.operationId, acknowledgedAt: value.acknowledgedAt }
}
