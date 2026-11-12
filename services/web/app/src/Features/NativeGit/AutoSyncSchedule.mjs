import { randomUUID } from 'node:crypto'

export const autoSyncScheduleId = '00000000-0000-4000-8000-000000000003'
const refuse = message => Object.assign(Error(message), { status: 409 })
export function publicAutoSync(policy) {
  if (!policy) return { revision: 0, enabled: false }
  const { revision, enabled, pull, push, remote, branch, intervalMs, state, reason, nextAt, lastCompletedAt, operationId, mergeId } = policy
  return { revision, enabled, pull, push, remote, branch, intervalMs, state, reason, nextAt, lastCompletedAt, operationId, mergeId }
}

// The scheduler lock is separate from the Git lock: adapters acquire the latter
// around every read/write, revalidating identities before dispatch. Never hold
// a repository lock while calling a draft service which acquires that lock.
export class AutoSyncSchedule {
  constructor(options) { Object.assign(this, { now: Date.now, ...options }) }
  async read() {
    try { return await this.store.read(autoSyncScheduleId) }
    catch (error) { if (error.code !== 'ENOENT') throw error; return null }
  }
  async status() {
    await this.authorize()
    return this.withLock(async () => { const policy = await this.read(); await this.authorize(); return publicAutoSync(policy) })
  }
  async configure(command) {
    return this.withLock(async () => {
      await this.authorize()
      const old = await this.read()
      if ((old?.revision || 0) !== command.revision) throw refuse('Automatic sync settings changed; reload')
      if (old?.operationId) throw refuse('Reconcile the interrupted sync before changing settings')
      const target = await this.target(command.remote, command.branch)
      if (typeof command.enabled !== 'boolean' || typeof command.pull !== 'boolean' || typeof command.push !== 'boolean' ||
          (command.enabled && !command.pull && !command.push) || !Number.isSafeInteger(command.intervalMs) || command.intervalMs < 60000 || command.intervalMs > 86400000) throw refuse('Invalid automatic sync settings')
      await this.authorize()
      const policy = { id: autoSyncScheduleId, kind: 'auto-sync-schedule', ...target, ownerId: this.ownerId,
        remote: command.remote, branch: command.branch, enabled: command.enabled, pull: command.pull, push: command.push,
        intervalMs: command.intervalMs, revision: (old?.revision || 0) + 1, state: command.enabled ? 'scheduled' : 'disabled',
        nextAt: this.now(), operationId: null, mergeId: null, reason: null }
      await this.store.write(policy)
      return publicAutoSync(policy)
    })
  }
  async runDue() {
    return this.withLock(async () => {
      let policy = await this.read()
      if (!policy?.enabled || policy.state === 'paused' || policy.nextAt > this.now()) return null
      const save = async updates => { policy = { ...policy, ...updates, revision: policy.revision + 1 }; await this.store.write(policy); return publicAutoSync(policy) }
      const pause = reason => save({ state: 'paused', reason })
      if (policy.operationId) return pause('outcome-unknown')
      let run
      const record = async updates => { run = { ...run, ...updates, revision: (run?.revision || 0) + 1 }; await this.tasks.write(run) }
      try {
        await this.authorize()
        if (policy.ownerId !== this.ownerId) return pause('owner-changed')
        const target = await this.target(policy.remote, policy.branch)
        if (target.fetchUrl !== policy.fetchUrl || target.pushUrl !== policy.pushUrl || target.workspaceBranch !== policy.workspaceBranch) return pause('target-changed')
        if (await this.blocked()) return pause('shared-task-pending')
        run = { id: randomUUID(), kind: 'automatic-sync', ownerId: this.ownerId, workspaceId: this.workspaceId,
          remote: policy.remote, branch: policy.branch, fetchUrl: policy.fetchUrl, pushUrl: policy.pushUrl,
          phase: 'discovery', mergeId: randomUUID(), sessionId: randomUUID(), createdAt: this.now() }
        await record({})
        await save({ state: 'running', reason: null, operationId: run.id, mergeId: null })
        const discovery = await this.discover(policy, run)
        if (discovery.changes?.some(change => change.ref === `refs/remotes/${policy.remote}/${policy.branch}` && ['rewritten', 'deleted'].includes(change.change))) {
          await record({ phase: 'blocked' }); await save({ operationId: null }); return pause('remote-history-changed')
        }
        let info = await this.inspect(policy)
        if (info.blocked) { await record({ phase: 'blocked' }); await save({ operationId: null }); return pause('shared-task-pending') }
        if (!info.remoteHead) { await record({ phase: 'blocked' }); await save({ operationId: null }); return pause('remote-branch-missing') }
        if (info.manualIndex) { await record({ phase: 'blocked' }); await save({ operationId: null }); return pause('working-changes') }
        if (info.dirty) {
          // Editing is normal: wait for a checkpoint instead of disabling the
          // schedule permanently. Never stage or commit on the user's behalf.
          await record({ phase: 'waiting-for-commit' })
          return save({ state: 'waiting', reason: 'waiting-for-commit', operationId: null, nextAt: this.now() + policy.intervalMs })
        }
        if (policy.pull && !info.remoteIsAncestor) {
          await record({ phase: 'preparing' })
          const task = await this.prepare(policy, run, info.remoteHead)
          await save({ mergeId: task.id })
          if (!info.localIsAncestor || task.state !== 'ready-to-apply') {
            await record({ phase: 'review-required' }); await save({ operationId: null }); return pause('merge-review-required')
          }
          await record({ phase: 'applying' })
          await this.apply(policy, run, task)
          await record({ phase: 'applied' })
          info = await this.inspect(policy)
        }
        if (policy.push) {
          if (info.blocked || info.dirty || info.manualIndex || !info.remoteIsAncestor) {
            await record({ phase: 'blocked' }); await save({ operationId: null }); return pause('incoming-or-working-changes')
          }
          // Read the actual push endpoint; fetch and push URLs may differ.
          const remoteHead = await this.remoteHead(policy)
          if (remoteHead !== info.head) {
            if (remoteHead !== info.remoteHead) {
              await record({ phase: 'blocked' }); await save({ operationId: null }); return pause('push-target-changed')
            }
            await record({ phase: 'pushing', candidate: info.head, expectedRemote: remoteHead })
            await this.push(policy, run)
            if (await this.remoteHead(policy) !== run.candidate) throw refuse('Push outcome needs reconciliation')
          }
        }
        await record({ phase: 'complete', completedAt: this.now() })
        return save({ state: 'scheduled', reason: null, operationId: null, lastCompletedAt: this.now(), nextAt: this.now() + policy.intervalMs })
      } catch (error) {
        this.onError?.(error)
        // Never expose credentials or paths from transport errors; never retry an
        // ambiguous mutation as a fresh timer operation.
        return pause(policy.operationId ? 'outcome-unknown' : [401, 403].includes(error.status) ? 'permission-revoked' : 'inspection-failed')
      }
    })
  }
  async reconcile(revision, retryPush = false) {
    return this.withLock(async () => {
      await this.authorize()
      const policy = await this.read()
      if (!policy || policy.revision !== revision || !policy.operationId || policy.ownerId !== this.ownerId) throw refuse('Pending sync changed; reload')
      const run = await this.tasks.read(policy.operationId)
      if (run.ownerId !== this.ownerId || run.workspaceId !== this.workspaceId) throw refuse('Sync operation scope changed')
      const target = await this.target(policy.remote, policy.branch)
      if (target.fetchUrl !== run.fetchUrl || target.pushUrl !== run.pushUrl) throw refuse('Remote target changed; restore its binding before reconciliation')
      if (run.phase === 'discovery') {
        // Finish the same discovery receipt: a partial fetch may already have
        // changed refs, so a fresh receipt would lose the pre-fetch baseline.
        await this.discover(policy, run)
      } else if (run.phase === 'pushing') {
        // Confirmation is a read, never an implicit second push.
        let remote = await this.remoteHead(policy)
        if (remote !== run.candidate && retryPush && remote === run.expectedRemote) {
          await this.push(policy, run)
          remote = await this.remoteHead(policy)
        }
        if (remote !== run.candidate) throw refuse('Remote does not match the pending commit. If it has not advanced, explicitly retry the same push; otherwise review the remote first')
      } else if (['preparing', 'applying', 'applied'].includes(run.phase)) {
        let task
        try { task = await this.mergeTask(run.mergeId) }
        catch (error) {
          // Preparation can fail before a task is persisted. No apply was
          // dispatched in this phase; an absent task is safe to settle.
          if (run.phase !== 'preparing' || error.code !== 'ENOENT') throw error
        }
        if (task && !['resolved', 'cancelled', 'superseded'].includes(task.state)) throw refuse('Resolve or cancel the retained shared merge task first')
      }
      await this.authorize()
      await this.tasks.write({ ...run, revision: run.revision + 1, phase: 'reconciled', previousPhase: run.phase, completedAt: this.now() })
      const settled = { ...policy, enabled: false, state: 'disabled', operationId: null, reason: 'reconciled-reenable-required', revision: policy.revision + 1 }
      await this.store.write(settled)
      return publicAutoSync(settled)
    })
  }
}
