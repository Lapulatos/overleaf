// Display only. No scheduling or repository mutations occur here.
export async function annotateAutoCommitBranches(branches, workspaces, readSchedule) {
 const enabled = new Map()
 for (const workspace of workspaces) {
  if (!workspace.branch || workspace.archived) continue
  const schedule = await readSchedule(workspace.id)
  if (schedule?.enabled) enabled.set(workspace.branch, { enabled: true, state: schedule.state || 'scheduled' })
 }
 return branches.map(branch => ({ ...branch, autoCommit: !branch.remote && !branch.tag ? enabled.get(branch.name) : undefined }))
}

export async function annotateAutoSyncBranches(branches, workspaces, readSchedule) {
 const enabled = new Map()
 for (const workspace of workspaces) {
  if (!workspace.branch || workspace.archived) continue
  const schedule = await readSchedule(workspace.id)
  if (schedule?.enabled && schedule.workspaceBranch === workspace.branch) enabled.set(workspace.branch, { enabled: true, state: schedule.state || 'scheduled' })
 }
 return branches.map(branch => ({ ...branch, autoSync: !branch.remote && !branch.tag ? enabled.get(branch.name) : undefined }))
}
