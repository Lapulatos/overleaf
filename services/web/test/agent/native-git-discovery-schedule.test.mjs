import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { configureDiscoverySchedule, runDueDiscovery, readDiscoverySchedule } from '../../app/src/Features/NativeGit/RemoteDiscoverySchedule.mjs'
async function fixture(t) {
 const directory = await mkdtemp(Path.join(tmpdir(), 'discovery-schedule-'))
 t.after(() => rm(directory, { recursive: true, force: true }))
 const store = new CollaborationTaskStore(directory)
 let queue = Promise.resolve(), clock = 100000, owner = 'owner', url = 'https://example.test/repo.git'
 const calls = []
 const options = { store, now: () => clock,
  withLock: fn => { const result = queue.then(() => fn({})); queue = result.catch(() => {}); return result },
  authorize: async actor => { if (actor !== owner) throw Object.assign(Error('revoked'), { status: 403 }) },
  remoteUrl: async () => url,
  discover: async (_repo, policy) => { calls.push(policy.operationId); return { state: 'fetched' } },
 }
 const configure = (command = {}) => configureDiscoverySchedule({ ...options, ownerId: owner,
  command: { revision: 0, enabled: true, remote: 'origin', intervalMs: 60000, ...command } })
 return { options, calls, configure, advance: ms => { clock += ms }, changeOwner: () => { owner = 'new-owner' }, changeUrl: () => { url = 'https://example.test/changed.git' } }
}
test('two workers share due execution and durable next-run time', async t => {
 const f = await fixture(t); await f.configure()
 const results = await Promise.all([runDueDiscovery(f.options), runDueDiscovery(f.options)])
 assert.equal(results.filter(Boolean).length, 1); assert.equal(f.calls.length, 1)
 const saved = await readDiscoverySchedule(f.options.store)
 assert.equal(saved.state, 'scheduled'); assert.equal(saved.nextAt, 160000)
 assert.equal(await runDueDiscovery(f.options), null)
 f.advance(60000); await runDueDiscovery(f.options)
 assert.equal(f.calls.length, 2); assert.notEqual(f.calls[0], f.calls[1])
})
test('failed discovery preserves operation ID across durable retry and backs off', async t => {
 const f = await fixture(t); await f.configure()
 const failed = await runDueDiscovery({ ...f.options, discover: async (_repo, policy) => {
  f.calls.push(policy.operationId); throw Error('temporary remote failure')
 } })
 assert.equal(failed.policy.state, 'retrying')
 assert.equal(await runDueDiscovery(f.options), null)
 f.advance(60000)
 const success = await runDueDiscovery(f.options)
 assert.equal(f.calls[0], f.calls[1]); assert.equal(success.policy.operationId, null)
 assert.equal(success.policy.failures, 0)
})
test('process restart resumes saved running task identity', async t => {
 const f = await fixture(t); await f.configure()
 const saved = await readDiscoverySchedule(f.options.store)
 const operationId = '11111111-1111-4111-8111-111111111111'
 await f.options.store.write({ ...saved, state: 'running', operationId, revision: saved.revision + 1 })
 await runDueDiscovery({ ...f.options, store: new CollaborationTaskStore(f.options.store.directory) })
 assert.deepEqual(f.calls, [operationId])
})
test('changed owner or target pauses without fetch and does not retry automatically', async t => {
 for (const change of ['changeOwner', 'changeUrl']) {
  const f = await fixture(t); await f.configure(); f[change]()
  const result = await runDueDiscovery(f.options)
  assert.equal(result.policy.state, 'paused'); assert.equal(f.calls.length, 0)
  f.advance(86400000); assert.equal(await runDueDiscovery(f.options), null)
 }
})
test('CAS configuration and disabling prevent stale configuration and future fetches', async t => {
 const f = await fixture(t); const first = await f.configure()
 await assert.rejects(f.configure(), { status: 409 })
 const disabled = await f.configure({ revision: first.revision, enabled: false })
 assert.equal(disabled.state, 'disabled'); assert.equal(await runDueDiscovery(f.options), null)
 assert.equal(f.calls.length, 0)
})
test('revocation after fetch pauses without reporting successful completion', async t => {
 const f = await fixture(t); await f.configure()
 const result = await runDueDiscovery({ ...f.options, discover: async () => { f.changeOwner(); return { state: 'fetched' } } })
 assert.equal(result.failed, true); assert.equal(result.policy.state, 'paused')
 assert.equal(result.policy.lastCompletedAt, undefined)
})

test('disabling and re-enabling preserves an interrupted discovery identity', async t => {
 const f = await fixture(t); await f.configure()
 const failed = await runDueDiscovery({ ...f.options, discover: async () => { throw Error('interrupted fetch') } })
 const disabled = await f.configure({ revision: failed.policy.revision, enabled: false })
 assert.equal(disabled.operationId, failed.policy.operationId)
 await assert.rejects(f.configure({ revision: disabled.revision, remote: 'different' }), { status: 409 })
 await f.configure({ revision: disabled.revision })
 await runDueDiscovery(f.options)
 assert.deepEqual(f.calls, [failed.policy.operationId])
})
