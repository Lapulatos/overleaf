import { configureAutoCommitSchedule, readAutoCommitSchedule, publicAutoCommitSchedule, runDueAutoCommit, settleAutoCommitSchedule } from './AutoCommitSchedule.mjs'

export class AutoCommitController {
  constructor({ service, store, withLock, authorize, authorizeRead, ownerId, workspaceId, enabled }) {
    Object.assign(this, { service, store, withLock, authorize, ownerId, workspaceId, enabled })
    this.authorizeRead = authorizeRead || (async () => { await authorize(ownerId); return true })
  }
  async execute(command) {
    if (command.command === 'autoCommitSchedule') {
      return this.withLock(async () => {
        await this.authorizeRead()
        const policy = await readAutoCommitSchedule(this.store)
        const canManage = await this.authorizeRead()
        return { ...publicAutoCommitSchedule(policy), schedulerAvailable: this.enabled, canManage }
      })
    }
    await this.authorize(this.ownerId)
    if (command.command === 'configureAutoCommitSchedule') {
      if (command.enabled && !this.enabled) throw Object.assign(Error('Automatic commits are not enabled on this server'), { status: 503 })
      return configureAutoCommitSchedule({ ...this, command })
    }
    // Disabling new scheduling must never disable recovery of retained tasks.
    if (command.command === 'autoCommitRecoveryPreview') return this.service.recoveryPreview(command.operationId)
    if (command.command === 'autoCommitRecover') {
      const result = await this.service.recover(command)
      const policy = await settleAutoCommitSchedule({ ...this, operationId: command.operationId,
        revision: command.scheduleRevision, readOutcome: id => this.service.journal.read(id) })
      return { ...result, policy }
    }
    throw Object.assign(Error('Unsupported automatic commit command'), { status: 400 })
  }
  async runDue() {
    if (!this.enabled) return null
    return runDueAutoCommit({ ...this, inspect: () => this.service.previewLocked(),
      commit: (_, request) => this.service.executeLocked(request) })
  }
}
