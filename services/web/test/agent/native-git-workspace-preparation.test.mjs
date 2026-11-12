import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorkspacePreparation } from '../../app/src/Features/NativeGit/WorkspacePreparation.mjs'

function fixture() {
  const calls = []
  const gate = Object.fromEntries(['beginRegistered', 'claim', 'assertClaimed', 'cancel'].map(name => [name, async () => { calls.push(name) }]))
  const emit = async (_, event) => { calls.push(event) }
  const withExclusiveWrite = async (_, action) => {
    calls.push('lock')
    try { return await action(async () => { calls.push('assertLease') }) }
    finally { calls.push('unlock') }
  }
  return { calls, gate, emit, withExclusiveWrite, run(options = {}) { return createWorkspacePreparation({ gate, emit, withExclusiveWrite, ...options }) } }
}
test('flush confirmation precedes lock; lease and preparation checked before action', async () => {
  const f = fixture()
  const result = await f.run()('project', 7, async check => { f.calls.push('action'); await check(); return 'done' })
  assert.equal(result, 'done')
  assert.deepEqual(f.calls, ['beginRegistered','nativeGitPrepare','claim','lock','assertLease','assertClaimed','action','assertLease','assertClaimed','assertLease','assertClaimed','unlock','cancel','nativeGitPrepareFinished'])
})
test('only pending confirmations retry; expiry prevents action and releases browsers', async () => {
  const f = fixture();let attempt = 0
  f.gate.claim = async () => { throw new Error(++attempt === 1 ? 'WORKSPACE_PREPARE_NOT_READY' : 'WORKSPACE_PREPARE_EXPIRED') }
  await assert.rejects(f.run({ wait: async () => f.calls.push('wait') })('p', 7, () => assert.fail('must not write')), /EXPIRED/)
  assert.equal(attempt, 2);assert.ok(!f.calls.includes('lock'))
  assert.deepEqual(f.calls.slice(-2), ['cancel','nativeGitPrepareFinished'])
})
test('claim invalidation while waiting for lease prevents action', async () => {
  const f = fixture();f.gate.assertClaimed = async () => { throw new Error('WORKSPACE_PREPARE_STALE') }
  await assert.rejects(f.run()('p', 7, () => assert.fail('must not write')), /STALE/)
  assert.ok(f.calls.includes('unlock'))
  assert.deepEqual(f.calls.slice(-2), ['cancel','nativeGitPrepareFinished'])
})
test('failed begin does not cancel or announce another operation', async () => {
  const f = fixture();f.gate.beginRegistered = async () => { throw new Error('BUSY') }
  await assert.rejects(f.run()('p', 7, () => assert.fail('must not write')), /BUSY/)
  assert.deepEqual(f.calls, [])
})
test('broadcast failure cancels reservation and attempts browser release', async () => {
  const f = fixture()
  const emit = async (_, event) => { f.calls.push(event);if(event === 'nativeGitPrepare')throw new Error('transport unavailable') }
  await assert.rejects(f.run({ emit })('p', 7, () => assert.fail('must not write')), /transport unavailable/)
  assert.deepEqual(f.calls, ['beginRegistered','nativeGitPrepare','cancel','nativeGitPrepareFinished'])
})
test('cancellation while waiting releases preparation without acquiring lease', async () => {
  const f = fixture();const abort = new AbortController()
  f.gate.claim = async () => { throw new Error('WORKSPACE_PREPARE_NOT_READY') }
  await assert.rejects(f.run({ wait: async () => abort.abort() })('p', 7, () => assert.fail('must not write'), { signal: abort.signal }), /abort/i)
  assert.ok(!f.calls.includes('lock'));assert.deepEqual(f.calls.slice(-2), ['cancel','nativeGitPrepareFinished'])
})
test('cleanup failure preserves application error and still releases browsers', async () => {
  const f = fixture();f.gate.cancel = async () => { throw new Error('Redis unavailable') }
  await assert.rejects(f.run()('p', 7, () => { throw new Error('application failed') }), error => {
    assert.ok(error instanceof AggregateError)
    assert.deepEqual(error.errors.map(e => e.message), ['application failed','Redis unavailable'])
    return true
  })
  assert.equal(f.calls.at(-1), 'nativeGitPrepareFinished')
})

test('intentional epoch advance completes registry transition before subsequent assertions', async () => {
 const f=fixture();f.gate.advanceMembership=async(_,identity,next)=>{assert.equal(identity.epoch,7);assert.equal(next,8);f.calls.push('advanceMembership')}
 const result=await f.run({advanceEpoch:async()=>{f.calls.push('advanceEpoch');return 8}})('p',7,async(check,tx)=>{
  const epoch=await tx.advanceEpoch();await check()
  await assert.rejects(tx.advanceEpoch(),/already started/)
  return epoch
 })
 assert.equal(result,8)
 assert.ok(f.calls.indexOf('advanceEpoch')<f.calls.indexOf('advanceMembership'))
 assert.ok(f.calls.indexOf('unlock')<f.calls.indexOf('nativeGitWorkspaceEpochChanged'))
 assert.ok(f.calls.indexOf('nativeGitWorkspaceEpochChanged')<f.calls.indexOf('nativeGitPrepareFinished'))
})
test('failed epoch transition cannot be swallowed by the application callback', async () => {
 const f=fixture();f.gate.advanceMembership=async()=>{throw new Error('registry unavailable')}
 await assert.rejects(f.run({advanceEpoch:async()=>8})('p',7,async(check,tx)=>{
  await assert.rejects(tx.advanceEpoch(),/registry unavailable/)
  return 'must not succeed'
 }),/registry unavailable/)
 assert.deepEqual(f.calls.slice(-2),['cancel','nativeGitPrepareFinished'])
 assert.ok(f.calls.includes('nativeGitWorkspaceEpochChanged'))
})

test('expected admission failures are classified without disguising storage errors', async () => {
 for(const [message,status] of [['WORKSPACE_PREPARE_BUSY',409],['WORKSPACE_PREPARE_EXPIRED',409],['WORKSPACE_MEMBERSHIP_UNAVAILABLE',503],['disk failed',undefined]]){
  const f=fixture();f.gate.beginRegistered=async()=>{throw new Error(message)}
  await assert.rejects(f.run()('p',7,()=>assert.fail('must not write')),error=>{assert.equal(error.status,status);return true})
 }
})
