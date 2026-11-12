import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

// Preparation must precede the exclusive write lease: browsers need to flush
// their accepted edits before normal write admission is closed by that lease.
export function createWorkspacePreparation({ gate, emit, withExclusiveWrite, advanceEpoch, wait = delay }) {
  return async function withPreparedWrite(projectId, epoch, action, { ttlMs = 15000, signal } = {}) {
    const id = randomUUID()
    const identity = { id, epoch }
    let begun = false
    let result
    let failure
    let advancedEpoch
    try {
      signal?.throwIfAborted()
      await gate.beginRegistered(projectId, { ...identity, ttlMs })
      begun = true
      await emit(projectId, 'nativeGitPrepare', { ...identity, projectId, ttlMs })
      // The Redis server deadline is authoritative. Only NOT_READY is retryable;
      // lost state, stale epochs, expiry and ownership changes fail immediately.
      for (;;) {
        signal?.throwIfAborted()
        try {
          await gate.claim(projectId, identity)
          break
        } catch (error) {
          if (!/\bWORKSPACE_PREPARE_NOT_READY\b/.test(error.message)) throw error
          await wait(50, undefined, { signal })
        }
      }
      result = await withExclusiveWrite(projectId, async assertLease => {
        let transitionFailure
        let advancing = false
        let advanced = false
        const assertPrepared = async () => {
          if (transitionFailure) throw transitionFailure
          signal?.throwIfAborted()
          await assertLease()
          await gate.assertClaimed(projectId, identity)
        }
        await assertPrepared()
        // Callers must continue checking before mutations and preserve their
        // document/ref CAS and recovery journal. This does not replace them.
        const advance = async () => {
          if (typeof advanceEpoch !== 'function' || advancing || advanced) throw new Error('Prepared epoch advancement is unavailable or already started')
          advancing = true
          try {
            await assertPrepared()
            const next = await advanceEpoch(projectId, epoch)
            if (next !== epoch + 1) throw new Error('Unexpected advanced workspace epoch')
            advancedEpoch = next
            await gate.advanceMembership(projectId, identity, next)
            await assertPrepared()
            advanced = true
            return next
          } catch (error) {
            transitionFailure = error
            throw error
          } finally { advancing = false }
        }
        const value = await action(assertPrepared, { advanceEpoch: advance })
        await assertPrepared()
        return value
      })
    } catch (error) {
      failure = error
    } finally {
      if (begun) {
        const cleanupErrors = []
        // Notify only after leaving the write lease, so reconnect cannot race
        // partial application. This is also needed after a failed post-advance
        // transfer: old editors must preserve their snapshots and stop writing.
        if (advancedEpoch !== undefined) {
          try { await emit(projectId, 'nativeGitWorkspaceEpochChanged', { projectId, epoch: advancedEpoch }) }
          catch (error) { cleanupErrors.push(error) }
        }
        try { await gate.cancel(projectId, id) } catch (error) { cleanupErrors.push(error) }
        // Always release the exact browser operation, including Redis failures.
        try { await emit(projectId, 'nativeGitPrepareFinished', { id }) } catch (error) { cleanupErrors.push(error) }
        if (cleanupErrors.length) failure = new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], 'Workspace preparation cleanup failed')
      }
    }
    if (failure) {
      // Expected admission/refusal outcomes should be actionable HTTP conflicts,
      // not uncaught server errors. Unknown storage/application failures retain
      // their original classification and recovery evidence.
      if (/\bWORKSPACE_(PREPARE|MEMBERSHIP)_/.test(failure.message)) {
        failure.status = /MEMBERSHIP_(UNAVAILABLE|REINITIALIZATION_REQUIRED)/.test(failure.message) ? 503 : 409
      }
      throw failure
    }
    return result
  }
}
