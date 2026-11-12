import { randomUUID } from 'node:crypto'

// Store must be scoped to one workspace; withLock is its shared Git-operation
// lock. No browser owns the timer. Runtime integration remains opt-in.
export const autoCommitScheduleId = '00000000-0000-4000-8000-000000000002'
const conflict = message => Object.assign(Error(message), { status: 409 })
export async function readAutoCommitSchedule(store) {
  try { return await store.read(autoCommitScheduleId) }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null }
}
export function publicAutoCommitSchedule(policy) {
  if (!policy) return { enabled: false, revision: 0 }
  const { enabled, revision, intervalMs, state, nextAt, lastCompletedAt, operationId, reason } = policy
  return { enabled, revision, intervalMs, state, nextAt, lastCompletedAt, operationId, reason }
}
export async function configureAutoCommitSchedule({ store, withLock, authorize, ownerId, command, now = Date.now }) {
  return withLock(async () => {
    await authorize(ownerId)
    const old = await readAutoCommitSchedule(store)
    if ((old?.revision || 0) !== command.revision) throw conflict('Auto-commit schedule changed; refresh before saving')
    // Reconfiguration must not erase an uncertain operation, even when disabling.
    if (old?.operationId) throw conflict('Reconcile the pending automatic commit before changing its schedule')
    if (typeof command.enabled !== 'boolean' || !Number.isSafeInteger(command.intervalMs) || command.intervalMs < 60000 || command.intervalMs > 86400000) {
      throw Object.assign(Error('Invalid auto-commit schedule'), { status: 400 })
    }
    const policy = { id: autoCommitScheduleId, kind: 'auto-commit-schedule', ownerId,
      enabled: command.enabled, intervalMs: command.intervalMs, revision: (old?.revision || 0) + 1,
      state: command.enabled ? 'scheduled' : 'disabled', nextAt: now(), operationId: null, reason: null,
      createdAt: old?.createdAt || new Date(now()).toISOString() }
    await authorize(ownerId)
    await store.write(policy)
    return publicAutoCommitSchedule(policy)
  })
}

// inspect must read saved-snapshot, HEAD and index identities under the lock.
// commit must use a prepared write barrier and revalidate those identities
// immediately before its CAS publication. Scheduling alone is NOT that barrier.
export async function runDueAutoCommit({ store, withLock, authorize, inspect, commit, now = Date.now }) {
  return withLock(async repo => {
    let policy = await readAutoCommitSchedule(store)
    if (!policy?.enabled || policy.state === 'paused' || policy.nextAt > now()) return null
    const pause = async reason => {
      policy = { ...policy, state: 'paused', reason, revision: policy.revision + 1 }
      await store.write(policy)
      return { policy: publicAutoCommitSchedule(policy), paused: true }
    }
    // Process death may follow successful ref publication. Never create a second
    // commit or forget its operation id merely because no response was recorded.
    if (policy.operationId) return pause('outcome-unknown')
    let dispatched = false
    try {
      await authorize(policy.ownerId)
      const snapshot = await inspect(repo)
      if (snapshot.recoveryRequired || snapshot.conflicted) return pause('recovery-required')
      if (snapshot.manualIndex) return pause('manual-index')
      if (snapshot.unsaved) return pause('unsaved-edits')
      if (!snapshot.changed) {
        policy = { ...policy, revision: policy.revision + 1, nextAt: now() + policy.intervalMs }
        await store.write(policy)
        return { policy: publicAutoCommitSchedule(policy), unchanged: true }
      }
      if (![snapshot.head, snapshot.indexFingerprint, snapshot.snapshotFingerprint].every(value => typeof value === 'string' && value.length)) {
        return pause('missing-snapshot-identity')
      }
      policy = { ...policy, operationId: randomUUID(), state: 'running', reason: null, revision: policy.revision + 1 }
      await store.write(policy)
      await authorize(policy.ownerId)
      dispatched = true
      const result = await commit(repo, { operationId: policy.operationId, ownerId: policy.ownerId, snapshot }, () => authorize(policy.ownerId))
      // The executor must return a persisted operation outcome. Missing/ambiguous
      // acknowledgements require explicit reconciliation, not timer retries.
      if (!result || result.operationId !== policy.operationId || typeof result.commit !== 'string' || !/^[a-f0-9]{40,64}$/.test(result.commit)) {
        return pause('outcome-unknown')
      }
      const completed = { ...policy, state: 'scheduled', operationId: null, reason: null, revision: policy.revision + 1,
        lastCompletedAt: new Date(now()).toISOString(), nextAt: now() + policy.intervalMs }
      await store.write(completed)
      return { policy: publicAutoCommitSchedule(completed), result }
    } catch (error) {
      if ((!dispatched || error.autoCommitNotStarted === true) && policy.operationId) policy = { ...policy, operationId: null }
      // Once dispatched, even a permission error could follow a published ref.
      return pause(policy.operationId ? 'outcome-unknown' : [401, 403].includes(error.status || error.statusCode) ? 'permission-revoked' : 'inspection-failed')
    }
  })
}

// readOutcome is the scoped persistent journal reader, not a browser-provided
// result. Call after explicit Git reconciliation, using the same repository lock.
export async function settleAutoCommitSchedule({ store, withLock, authorize, readOutcome,
  workspaceId, ownerId, operationId, revision, now = Date.now }) {
  return withLock(async () => {
    await authorize(ownerId)
    const policy = await readAutoCommitSchedule(store)
    if (!policy || policy.ownerId !== ownerId) throw conflict('Automatic commit owner changed')
    const replay = !policy.operationId && !policy.enabled && policy.state === 'disabled' &&
      policy.lastSettlement?.operationId === operationId
    if (!replay && (policy.operationId !== operationId || policy.revision !== revision)) throw conflict('Pending automatic commit changed; refresh recovery')
    const outcome = await readOutcome(operationId)
    if (outcome.id !== operationId || outcome.operationId !== operationId || outcome.kind !== 'automatic-commit' ||
        outcome.workspaceId !== workspaceId || outcome.ownerId !== ownerId ||
        !['complete', 'cancelled'].includes(outcome.state) || !Number.isSafeInteger(outcome.revision) || outcome.revision < 1) {
      throw conflict('Automatic commit has no matching completed reconciliation')
    }
    if (replay) {
      if (policy.lastSettlement.outcome !== outcome.state || policy.lastSettlement.commit !== outcome.commit) throw conflict('Recorded reconciliation changed')
      return publicAutoCommitSchedule(policy)
    }
    await authorize(ownerId)
    const settled = { ...policy, revision: policy.revision + 1, enabled: false, state: 'disabled',
      operationId: null, reason: 'reconciled-reenable-required',
      lastSettlement: { operationId, outcome: outcome.state, commit: outcome.commit,
        journalRevision: outcome.revision, completedAt: new Date(now()).toISOString() } }
    await store.write(settled)
    return publicAutoCommitSchedule(settled)
  })
}
