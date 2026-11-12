import { AgentError } from './WritingAssistErrors.mjs'

// These values come from the server project record, never from request bodies.
export function workspaceIdentity(projectId, project) {
  if (!project) throw new AgentError(404, 'Project no longer exists')
  if (project.gitWorkspace && project.gitWorkspace.state !== 'ready') {
    throw new AgentError(409, 'Branch workspace is not ready')
  }
  if (!project.gitWorkspaceFenceEnabled && !project.gitWorkspace) return null
  if (!Number.isSafeInteger(project.gitWorkspaceEpoch) || project.gitWorkspaceEpoch < 1) {
    throw new AgentError(409, 'Workspace epoch is unavailable')
  }
  return {
    projectId: String(project.gitWorkspace?.logicalProjectId || projectId),
    workspaceId: String(projectId),
    branch: project.gitWorkspace?.branch || null,
    epoch: project.gitWorkspaceEpoch,
  }
}

export function assertWorkspaceIdentity(expected, current) {
  // Legacy tasks are usable only while the project remains outside workspace
  // fencing. Enabling fencing invalidates their uncaptured baseline.
  if (expected == null && current == null) return
  if (!expected || !current || ['projectId', 'workspaceId', 'branch', 'epoch']
    .some(key => expected[key] !== current[key])) {
    throw new AgentError(409, 'Workspace changed since this task. Run a new task in the current branch.', 'AI_WORKSPACE_CHANGED')
  }
}
