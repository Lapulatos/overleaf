import { randomUUID, createHash } from 'node:crypto'

export const historyFingerprint = snapshot => createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
const refuse = message => Object.assign(Error(message), { status: 409 })

// The caller holds the shared project lock and the prepared document write gate.
export class HistoryRestoreJournal {
  constructor(store) { this.store = store }
  async pending() { return (await this.store.list()).filter(t => t.state !== 'resolved') }
  async save(task, updates) {
    const next = { ...task, ...updates, revision: task.revision + 1, updatedAt: Date.now() }
    await this.store.write(next)
    return next
  }
  async start(specification, before) {
    if ((await this.pending()).length) throw refuse('Finish History recovery before starting another restore')
    const task = { id: randomUUID(), revision: 1, state: 'applying', specification,
      before, attempts: [], steps: [], createdAt: Date.now() }
    await this.store.write(task)
    return task
  }
  async review(id, revision, fingerprint, snapshot) {
    const task = await this.store.read(id)
    if (task.state === 'resolved' || task.revision !== revision || historyFingerprint(snapshot) !== fingerprint) {
      throw refuse('The recovery preview is stale. Review the current files again; no files were replaced.')
    }
    return task
  }
  async complete(id) {
    const task = await this.store.read(id)
    if (task.state !== 'applied-awaiting-finalization') throw refuse('History restore has not finished applying')
    return this.save(task, { state: 'resolved' })
  }
  async interrupt(id) {
    const task = await this.store.read(id)
    return this.save(task, { state: 'recovery-required', failure: 'Restore interrupted. Review current files before retrying or keeping them.' })
  }
  async run(task, action, checkpoint) {
    let current = task
    const step = async (phase, path, kind) => {
      current = await this.save(current, { steps: [...current.steps,
        { phase, path, kind, at: Date.now(), ...(phase === 'after' ? { checkpoint: await checkpoint() } : {}) }] })
    }
    try {
      const result = await action(step)
      await this.save(current, { state: 'applied-awaiting-finalization', outcome: 'restored', result, final: await checkpoint() })
      return result
    } catch (error) {
      await this.save(current, { state: 'recovery-required', failure: 'Restore interrupted. Review current files before retrying or keeping them.' })
      throw error
    }
  }
}
