import { Project } from '../../models/Project.mjs'
import { workspaceIdentity } from './WorkspaceIdentity.mjs'

export async function resolveWorkspaceScope(projectId) {
  const project = await Project.findById(projectId).select('gitWorkspace gitWorkspaceEnabled gitWorkspaceFenceEnabled gitWorkspacePrepareEnabled gitWorkspaceEpoch gitProjectDeletion').lean().exec()
  if (project?.gitProjectDeletion) throw Object.assign(Error('Project deletion is in progress; use the recovery vault'), { status: 409 })
  return { ...workspaceIdentity(project), prepareEnabled: project.gitWorkspacePrepareEnabled === true }
}

export async function isWorkspaceStorage(projectId) {
  return (await resolveWorkspaceScope(projectId)).internal
}
