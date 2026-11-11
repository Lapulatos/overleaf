/** Prepare legacy history using the native range-preserving resync, never a flag-only migration. */
export function createHistoryRestorePreparation({
  getProject,
  migrateProject,
}) {
  const pending = new Map()
  return function prepare(projectId) {
    if (pending.has(projectId)) return pending.get(projectId)
    const operation = (async () => {
      const project = await getProject(projectId)
      if (!project?.overleaf?.history?.id) {
        throw new Error('Project history is unavailable')
      }
      if (project.overleaf.history.rangesSupportEnabled) return
      await migrateProject(projectId, 'forwards')
      const migrated = await getProject(projectId)
      if (!migrated?.overleaf?.history?.rangesSupportEnabled) {
        throw new Error('History migration did not enable ranges support')
      }
    })().finally(() => pending.delete(projectId))
    pending.set(projectId, operation)
    return operation
  }
}
