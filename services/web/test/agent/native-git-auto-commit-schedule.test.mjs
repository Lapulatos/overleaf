import test from 'node:test'
import assert from 'node:assert/strict'
import { configureAutoCommitSchedule, runDueAutoCommit } from '../../app/src/Features/NativeGit/AutoCommitSchedule.mjs'

function fixture() {
  let policy, commits = 0, revoked = false, failCompletion = false
  const store = {
    async read() { if (!policy) throw Object.assign(Error('absent'), { code: 'ENOENT' }); return structuredClone(policy) },
    async write(value) {
      if (failCompletion && value.lastCompletedAt) { failCompletion = false; throw Error('disk failure after commit') }
      policy = structuredClone(value)
    },
  }
  const options = { store, withLock: fn => fn({}), authorize: async () => { if (revoked) throw Object.assign(Error('revoked'), { status: 403 }) },
    ownerId: 'owner', now: () => 1000,
    inspect: async () => ({ changed: true, head: 'a'.repeat(40), indexFingerprint: 'index', snapshotFingerprint: 'saved' }),
    commit: async (_, request, authorize) => { await authorize(); commits++; return { operationId: request.operationId, commit: 'b'.repeat(40) } } }
  return { options, get policy() { return policy }, get commits() { return commits }, revoke() { revoked = true }, failCompletion() { failCompletion = true } }
}
async function enable(f) {
  return configureAutoCommitSchedule({ ...f.options, command: { enabled: true, revision: 0, intervalMs: 60000 } })
}

test('schedule revision and interval checks prevent stale reconfiguration', async () => {
  const f = fixture(); await enable(f)
  await assert.rejects(enable(f), { status: 409 })
  await assert.rejects(configureAutoCommitSchedule({ ...f.options, command: { enabled: true, revision: 1, intervalMs: 1 } }), { status: 400 })
  assert.equal(f.policy.revision, 1)
})
for (const [flag, reason] of [['manualIndex', 'manual-index'], ['unsaved', 'unsaved-edits'], ['recoveryRequired', 'recovery-required'], ['conflicted', 'recovery-required']]) {
  test(`${flag} pauses without touching the repository`, async () => {
    const f = fixture(); await enable(f)
    f.options.inspect = async () => ({ changed: true, [flag]: true })
    const result = await runDueAutoCommit(f.options)
    assert.equal(result.policy.reason, reason); assert.equal(f.commits, 0)
    assert.equal(await runDueAutoCommit(f.options), null)
  })
}
test('saved snapshot identity reaches executor and one due run commits once', async () => {
  const f = fixture(); await enable(f)
  const original = f.options.commit
  f.options.commit = async (repo, request, auth) => {
    assert.equal(f.policy.state, 'running'); assert.equal(f.policy.operationId, request.operationId)
    assert.equal(request.snapshot.snapshotFingerprint, 'saved')
    return original(repo, request, auth)
  }
  const result = await runDueAutoCommit(f.options)
  assert.equal(result.policy.state, 'scheduled'); assert.equal(result.policy.nextAt, 61000)
  assert.equal(await runDueAutoCommit(f.options), null); assert.equal(f.commits, 1)
})
test('completion persistence failure retains operation id and prevents duplicate commit', async () => {
  const f = fixture(); await enable(f); f.failCompletion()
  const result = await runDueAutoCommit(f.options)
  assert.equal(result.policy.reason, 'outcome-unknown'); assert.ok(result.policy.operationId)
  assert.equal(f.commits, 1)
  assert.equal(await runDueAutoCommit(f.options), null)
  await assert.rejects(configureAutoCommitSchedule({ ...f.options, command: { revision: f.policy.revision, enabled: false, intervalMs: 60000 } }), { status: 409 })
  assert.ok(f.policy.operationId)
})
test('persisted interrupted execution is never replayed automatically', async () => {
  const f = fixture(); await enable(f)
  await f.options.store.write({ ...f.policy, state: 'running', operationId: 'retained-operation' })
  const result = await runDueAutoCommit(f.options)
  assert.equal(result.policy.reason, 'outcome-unknown'); assert.equal(f.commits, 0)
})
test('revoked owner pauses before inspection or repository mutation', async () => {
  const f = fixture(); await enable(f); f.revoke()
  f.options.inspect = async () => { assert.fail('must authorize first') }
  assert.equal((await runDueAutoCommit(f.options)).policy.reason, 'permission-revoked')
  assert.equal(f.commits, 0)
})
test('ambiguous executor response retains pending operation', async () => {
  const f = fixture(); await enable(f); f.options.commit = async () => ({})
  assert.equal((await runDueAutoCommit(f.options)).policy.reason, 'outcome-unknown')
  assert.ok(f.policy.operationId)
})

import { settleAutoCommitSchedule } from '../../app/src/Features/NativeGit/AutoCommitSchedule.mjs'
async function pending() {
  const f = fixture(); await enable(f)
  f.options.commit = async () => { throw Error('lost acknowledgement') }
  await runDueAutoCommit(f.options)
  const operationId = f.policy.operationId
  const outcome = { id: operationId, operationId, kind: 'automatic-commit', workspaceId: 'workspace', ownerId: 'owner', state: 'complete', revision: 3, commit: 'b'.repeat(40) }
  const settle = { ...f.options, workspaceId: 'workspace', ownerId: 'owner', operationId,
    revision: f.policy.revision, readOutcome: async () => structuredClone(outcome) }
  return { f, outcome, settle }
}
test('explicit completed recovery disables schedule and allows deliberate re-enable', async () => {
  const { f, settle } = await pending()
  const result = await settleAutoCommitSchedule(settle)
  assert.equal(result.enabled, false); assert.equal(result.operationId, null)
  assert.equal(result.reason, 'reconciled-reenable-required')
  assert.equal(await runDueAutoCommit(f.options), null)
  assert.deepEqual(await settleAutoCommitSchedule(settle), result)
  await configureAutoCommitSchedule({ ...f.options, command: { enabled: true, revision: result.revision, intervalMs: 60000 } })
  assert.equal(f.policy.enabled, true)
  await assert.rejects(settleAutoCommitSchedule(settle), { status: 409 })
  assert.equal(f.policy.enabled, true)
})
test('cancelled reconciliation releases pending operation but never restarts timer', async () => {
  const { f, outcome, settle } = await pending(); outcome.state = 'cancelled'
  await settleAutoCommitSchedule(settle)
  assert.equal(f.policy.lastSettlement.outcome, 'cancelled')
  assert.equal(f.policy.enabled, false)
})
for (const [field, value] of [['state', 'published'], ['workspaceId', 'other'], ['ownerId', 'other'], ['operationId', 'other'], ['kind', 'shell-draft'], ['revision', 0]]) {
  test(`settlement refuses mismatched ${field}`, async () => {
    const { f, outcome, settle } = await pending(); outcome[field] = value
    await assert.rejects(settleAutoCommitSchedule(settle), { status: 409 })
    assert.equal(f.policy.operationId, settle.operationId)
  })
}
test('old recovery cannot clear a newer pending operation or a revised policy', async () => {
  const { f, settle } = await pending()
  await f.options.store.write({ ...f.policy, revision: f.policy.revision + 1 })
  await assert.rejects(settleAutoCommitSchedule(settle), { status: 409 })
  await f.options.store.write({ ...f.policy, operationId: 'newer-operation' })
  await assert.rejects(settleAutoCommitSchedule({ ...settle, revision: f.policy.revision }), { status: 409 })
  assert.equal(f.policy.operationId, 'newer-operation')
})
test('revoked owner cannot settle or erase pending recovery', async () => {
  const { f, settle } = await pending(); f.revoke()
  await assert.rejects(settleAutoCommitSchedule(settle), { status: 403 })
  assert.equal(f.policy.operationId, settle.operationId)
})
test('authorization failure after running record but before dispatch clears unused operation id', async () => {
  const f = fixture(); await enable(f)
  let checks = 0
  f.options.authorize = async () => { if (++checks === 2) throw Object.assign(Error('revoked before dispatch'), { status: 403 }) }
  const result = await runDueAutoCommit(f.options)
  assert.equal(f.commits, 0); assert.equal(result.policy.operationId, null)
  assert.equal(result.policy.state, 'paused'); assert.equal(result.policy.reason, 'permission-revoked')
})
test('trusted executor preflight rejection clears ID but unknown dispatch retains it', async () => {
  const f = fixture(); await enable(f)
  f.options.commit = async () => { throw Object.assign(Error('stale workspace before recording attempt'), { status: 409, autoCommitNotStarted: true }) }
  const result = await runDueAutoCommit(f.options)
  assert.equal(result.policy.operationId, null); assert.equal(result.policy.state, 'paused')
})
