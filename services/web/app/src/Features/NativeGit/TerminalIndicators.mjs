// Shared display metadata only: never export runner IDs, paths or transcripts.
export async function annotateTerminalLocations(snapshot, tasks, { logicalProjectId, users, health }) {
  const visible = tasks.filter(task => task.kind === 'shell-draft' && task.logicalProjectId === logicalProjectId && !task.deletedAt && task.state !== 'deleted' && task.sourcePosition)
  const entries = await Promise.all(visible.map(async task => {
    let state = task.state === 'running' ? 'running' : 'stopped'
    if (task.state === 'running') {
      try { state = await health(task) } catch { state = 'unavailable' }
    } else if (['starting', 'preparing', 'recovery-required', 'stopping'].includes(task.state)) state = 'unavailable'
    else if (task.state === 'ready') state = 'ready'
    return { branch: task.sourcePosition.branch, head: task.sourcePosition.head,
      indicator: { userId: task.createdBy, displayName: users.get(task.createdBy) || 'Collaborator',
        branch: task.sourcePosition.branch || null, name: task.name || `Terminal ${task.id.slice(0, 8)}`, state } }
  }))
  return { ...snapshot,
    branches: snapshot.branches?.map(branch => ({ ...branch, terminals: !branch.remote && !branch.tag ? entries.filter(entry => entry.branch && entry.branch === branch.name).map(entry => entry.indicator) : [] })),
    graph: snapshot.graph?.map(commit => ({ ...commit, terminals: entries.filter(entry => entry.head === commit.hash).map(entry => entry.indicator) })) }
}
