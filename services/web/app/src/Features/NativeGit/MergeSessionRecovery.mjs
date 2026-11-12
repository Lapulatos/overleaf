const refuse = message => Object.assign(new Error(message), { status: 409 })

export function acceptsMergeRecoveryEpoch(task, epoch) {
  return [task.workspaceEpoch, task.workspaceEpoch + 1, task.sessionRecovery?.nextEpoch].includes(epoch)
}

// Called under the shared repository lock. Session recovery changes admission,
// never the original merge's document checkpoint, source commit or target ref.
export async function pendingMergeForSessionRecovery(store, binding, workspaceId, logicalProjectId) {
  if (binding.pending) throw refuse('A legacy document transfer must be recovered before resetting sessions')
  if (!binding.mutationTaskId) return null
  const task = await store.read(binding.mutationTaskId)
  if (task.workspaceId !== workspaceId || task.logicalProjectId !== logicalProjectId ||
      task.targetBranch !== binding.branch || !task.application ||
      !['applying', 'recovery-required', 'resolved', 'cancelled'].includes(task.state)) {
    throw refuse('Pending merge recovery ownership changed')
  }
  return task
}

export async function linkSessionRecoveryToMerge(store, task, recovery) {
  if (!task) return
  if (task.sessionRecovery?.id === recovery.id) {
    if (task.sessionRecovery.epoch !== recovery.epoch || task.sessionRecovery.nextEpoch !== recovery.nextEpoch) {
      throw refuse('Session recovery identity changed')
    }
    return
  }
  if (!acceptsMergeRecoveryEpoch(task, recovery.epoch) || recovery.nextEpoch !== recovery.epoch + 1) {
    throw refuse('Session recovery does not follow the pending merge generation')
  }
  await store.write({ ...task, revision: task.revision + 1, updatedAt: Date.now(),
    sessionRecovery: { id: recovery.id, epoch: recovery.epoch, nextEpoch: recovery.nextEpoch } })
}
