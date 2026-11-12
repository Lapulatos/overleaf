// Shared task status contains no credential owner, remote URL, or filesystem data.
export function publicDiscoveryTask(task) {
  const { id, revision, remote, state, createdAt, fetchedAt } = task
  return { id, revision, remote, state, createdAt,
    ...(fetchedAt ? { fetchedAt } : {}), applied: false,
    changes: (task.changes || []).map(({ ref, before, after, change }) => ({ ref, before, after, change })) }
}

export async function listRemoteDiscoveries({ store, withLock, authorize }) {
  await authorize()
  return withLock(async () => {
    await authorize()
    const tasks = await store.list()
    await authorize()
    return tasks.filter(task => task.kind === 'remote-discovery')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .map(publicDiscoveryTask)
  })
}
