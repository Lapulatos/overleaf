// A deletion can resume only its persisted inventory, never a newly enumerated
// branch or a newly supplied backup. Adapters enforce ownership and write gates.
export class ProjectDeletion {
  constructor(adapters) { this.a = adapters }
  async run(id, actorId) {
    const a = this.a
    return a.lock(id, async () => {
      let task = await a.read(id)
      await a.authorize(task, actorId)
      if (task.state === 'completed') return task
      if (task.state === 'cancelled') throw Object.assign(Error('Deletion was cancelled'), { status: 409 })
      const deadline = Date.now() + 5 * 60 * 1000
      const assertWindow = () => { if (Date.now() >= deadline) throw Object.assign(Error('Deletion execution window ended; resume the retained operation'), { status: 409 }) }
      const save = async patch => {
        const next = { ...task, ...patch, revision: task.revision + 1 }
        await a.save(next); task = next
      }
      const step = async (key, action) => {
        if (task.completedSteps.includes(key)) return
        assertWindow(); await a.authorize(task, actorId)
        await action(task)
        await save({ completedSteps: [...task.completedSteps, key] })
      }
      try {
        // Every retry verifies the independent archive before any destructive
        // action. A missing or damaged retained copy blocks further cleanup.
        await a.verifyRetainedBackup(task)
        if (task.state !== 'deleting') {
          await a.verifyInventory(task)
          await save({ state: 'freezing', failure: undefined })
          for (const workspaceId of task.workspaceIds) {
            await step(`freeze:${workspaceId}`, t => a.freeze(t, workspaceId))
          }
          await a.assertAllFrozen(task)
          await a.verifySnapshot(task)
          await a.retainPrivateRecords(task)
          // This durable transition is the irreversible boundary. No delete
          // adapter is called until all workspaces and records are accounted for.
          assertWindow(); await a.authorize(task, actorId)
          await save({ state: 'deleting' })
        }
        await a.assertAllFrozen(task)
        for (const workspaceId of task.workspaceIds) {
          for (const resource of a.resources) {
            await step(`remove:${workspaceId}:${resource}`, t => a.remove(t, workspaceId, resource))
          }
        }
        await step('remove-repository', t => a.removeRepository(t))
        await save({ state: 'completed', failure: undefined })
        return task
      } catch (error) {
        // Keep 'deleting' after the irreversible boundary, even when a service
        // response was lost. Each remove adapter must be idempotent.
        await save({ failure: error.status === 409 ? error.message : 'Deletion paused. Retained backup and remaining data are preserved. Resume this operation to continue.' })
        throw error
      }
    })
  }
  async cancel(id, actorId) {
    const a = this.a
    return a.lock(id, async () => {
      const task = await a.read(id)
      await a.authorize(task, actorId)
      if (task.state === 'cancelled') return task
      if (['deleting', 'completed'].includes(task.state)) throw Object.assign(Error('Deletion has started; restore the retained backup into a new project instead.'), { status: 409 })
      // Unfreeze all persisted IDs, including a freeze whose response was lost.
      // The adapter must advance epochs, never reuse the old editor generation.
      for (const workspaceId of task.workspaceIds) await a.unfreeze(task, workspaceId)
      const result = { ...task, state: 'cancelled', revision: task.revision + 1, failure: undefined }
      await a.save(result)
      return result
    })
  }
}
