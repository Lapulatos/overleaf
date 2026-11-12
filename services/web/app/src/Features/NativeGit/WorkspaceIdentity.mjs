// IDs are deliberately distinct from branch names. Storage IDs remain stable
// across branch renames; a child can never itself be a logical project.
export const visibleProjects = { 'gitWorkspace.logicalProjectId': { $exists: false } }

export function workspaceIdentity(project) {
  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 })
  const storageProjectId = String(project._id)
  const fencing = { fenceEnabled: project.gitWorkspaceFenceEnabled === true, epoch: project.gitWorkspaceEpoch ?? project.gitWorkspace?.epoch ?? 1 }
  const metadata = project.gitWorkspace
  if (!metadata?.logicalProjectId) {
    return { logicalProjectId: storageProjectId, storageProjectId, workspaceId: storageProjectId, internal: false, ...fencing, enabled: project.gitWorkspaceEnabled === true }
  }
  const logicalProjectId = String(metadata.logicalProjectId)
  if (!/^[a-f0-9]{24}$/i.test(logicalProjectId) || logicalProjectId === storageProjectId) {
    throw Object.assign(new Error('Invalid workspace parent'), { status: 409 })
  }
  return { logicalProjectId, storageProjectId, workspaceId: storageProjectId, internal: true,
    branch: metadata.branch, state: metadata.state, ...fencing }
}

export function inheritedWorkspaceAccess(storage, parent) {
  const scope = workspaceIdentity(storage)
  if (!scope.internal) return storage
  if (scope.state !== 'ready' || !parent || String(parent._id) !== scope.logicalProjectId || parent.gitWorkspace?.logicalProjectId) {
    throw Object.assign(new Error('Workspace is not available'), { status: 403 })
  }
  // Link-sharing applies only to the original workspace. Never copy tokens,
  // token members, or stale membership from an internal storage record.
  return { ...parent, publicAccesLevel: 'private', tokens: {},
    tokenAccessReadOnly_refs: [], tokenAccessReadAndWrite_refs: [] }
}
