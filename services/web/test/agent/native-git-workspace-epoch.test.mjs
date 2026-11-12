import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Redis from 'ioredis'
const { createWorkspaceEpoch } = await import(process.env.EPOCH_SERVICE_MODULE || '../../app/src/Features/NativeGit/WorkspaceEpoch.mjs')
const { default: epochModule } = await import(process.env.EPOCH_GATE_MODULE || '@overleaf/redis-wrapper/WorkspaceEpochGate.js')
const { createWorkspaceEpochGate, epochKey, assertSessionEpoch } = epochModule
const url = process.env.NATIVE_GIT_TEST_REDIS_URL

test('durable epoch CAS has one winner and a failed mirror publication never rolls back the database', async () => {
  let epoch = 1, fail = false, mirrored = 1
  const adapter = createWorkspaceEpoch({ fence: async () => {}, readRecord: async () => ({ enabled: true, epoch }),
    compareAndSwap: async (expected, next) => { if (epoch !== expected) return false; epoch = next; return true },
    publish: async next => { if (fail) throw new Error('Redis unavailable'); mirrored = next } })
  const results = await Promise.allSettled([adapter.advance(1), adapter.advance(1)])
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1)
  assert.equal(epoch, 2)
  fail = true
  await assert.rejects(adapter.advance(2), /Redis unavailable/)
  assert.equal(epoch, 3)
  assert.equal(mirrored, 2)
  fail = false
  assert.equal(await adapter.hydrate(), 3)
  assert.equal(mirrored, 3)
  await assert.rejects(adapter.advance(2), /epoch changed/)
})

test('fencing is opt-in and cannot accept invalid generations or relabel old session edits', async () => {
  const adapter = createWorkspaceEpoch({ fence: async () => {}, readRecord: async () => ({ enabled: false, epoch: 1 }),
    compareAndSwap: async () => false, publish: async () => { throw new Error('must not publish') } })
  await assert.rejects(adapter.read(), /not enabled/)
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER, undefined]) await assert.rejects(adapter.advance(value))
  assertSessionEpoch(undefined, undefined)
  assertSessionEpoch(2, 2)
  for (const [session, edit] of [[2, 1], [2, undefined], [undefined, 2], [2, '2']]) {
    assert.throws(() => assertSessionEpoch(session, edit), { code: 'WORKSPACE_EPOCH_STALE' })
  }
})

async function fixture(t) {
  const client = new Redis(url, { maxRetriesPerRequest: 1 })
  const project = randomUUID(), list = `native-git:test:epoch:${project}`, lock = `native-git:project-write:${project}`
  const cleanup = []
  t.after(async () => { await client.del(epochKey(project), list, lock, ...cleanup); await client.quit() })
  return { client, project, list, lock, cleanup, gate: createWorkspaceEpochGate(client) }
}
test('atomic queue admission rejects old/missing epochs and never rolls the mirrored generation back', { skip: !url }, async t => {
  const f = await fixture(t)
  await f.gate.enqueue(f.project, f.list, 'legacy')
  await f.gate.publish(f.project, 1)
  await assert.rejects(f.gate.enqueue(f.project, f.list, 'missing'), { code: 'WORKSPACE_EPOCH_STALE' })
  await f.gate.enqueue(f.project, f.list, 'epoch-one', 1)
  await f.gate.publish(f.project, 2)
  await assert.rejects(f.gate.enqueue(f.project, f.list, 'old', 1), { code: 'WORKSPACE_EPOCH_STALE' })
  await assert.rejects(f.gate.publish(f.project, 1), { code: 'WORKSPACE_EPOCH_STALE' })
  await f.gate.enqueue(f.project, f.list, 'epoch-two', 2)
  assert.deepEqual(await f.client.lrange(f.list, 0, -1), ['legacy', 'epoch-one', 'epoch-two'])
})
test('write lease and missing epoch cache both fail closed for a versioned session', { skip: !url }, async t => {
  const f = await fixture(t)
  await f.gate.publish(f.project, 1)
  await f.client.set(f.lock, randomUUID())
  await assert.rejects(f.gate.enqueue(f.project, f.list, 'blocked', 1), { code: 'PROJECT_WRITE_BUSY' })
  await f.client.del(f.lock, epochKey(f.project))
  await assert.rejects(f.gate.enqueue(f.project, f.list, 'cache-lost', 1), { code: 'WORKSPACE_EPOCH_STALE' })
  await assert.rejects(f.gate.assertCurrent(f.project, 1), { code: 'WORKSPACE_EPOCH_STALE' })
  await f.gate.publish(f.project, 2)
  await f.gate.assertCurrent(f.project, 2)
  assert.deepEqual(await f.client.lrange(f.list, 0, -1), [])
})

test('database/mirror failure leaves admission fenced until the durable increment is reconciled', { skip: !url }, async t => {
  const f = await fixture(t)
  let epoch = 1, fail = true
  const adapter = createWorkspaceEpoch({ readRecord: async () => ({ enabled: true, epoch }),
    compareAndSwap: async (expected, next) => { if (epoch !== expected) return false; epoch = next; return true },
    fence: expected => f.gate.fence(f.project, expected),
    publish: async next => { if (fail) throw new Error('publication failed'); await f.gate.publish(f.project, next) } })
  await f.gate.publish(f.project, 1)
  await assert.rejects(adapter.advance(1), /publication failed/)
  assert.equal(epoch, 2)
  for (const generation of [1, 2]) await assert.rejects(f.gate.enqueue(f.project, f.list, 'blocked', generation), { code: 'WORKSPACE_EPOCH_STALE' })
  await assert.rejects(f.gate.publish(f.project, 1), { code: 'WORKSPACE_EPOCH_STALE' })
  assert.equal(await adapter.read(), 2)
  fail = false
  await adapter.hydrate()
  await f.gate.enqueue(f.project, f.list, 'reconciled', 2)
  assert.deepEqual(await f.client.lrange(f.list, 0, -1), ['reconciled'])
})

test('consumer atomically retains stale queued edits while returning only the current generation', { skip: !url }, async t => {
  const f = await fixture(t), doc = randomUUID(), recoveryKey = `native-git:rejected-updates:${f.project}:${doc}`
  f.cleanup.push(recoveryKey)
  const old = { op: [{ i: 'old text', p: 0 }], meta: { workspaceEpoch: 1, user_id: 'A' } }
  const current = { op: [{ i: 'new text', p: 0 }], meta: { workspaceEpoch: 2, user_id: 'B' } }
  await f.gate.publish(f.project, 2)
  await f.client.rpush(f.list, JSON.stringify(old), JSON.stringify(current))
  const result = await f.gate.takePending(f.project, doc, f.list)
  assert.deepEqual(result.updates, [current])
  assert.equal(result.rejected, 1)
  assert.deepEqual((await f.client.lrange(recoveryKey, 0, -1)).map(JSON.parse), [old])
  assert.equal(await f.client.llen(f.list), 0)
  const retry = await f.gate.takePending(f.project, doc, f.list)
  assert.deepEqual(retry.updates, [])
  assert.equal(await f.client.llen(recoveryKey), 1)
})

test('consumer leaves a queue intact during a foreign write lease and on malformed JSON', { skip: !url }, async t => {
  const f = await fixture(t), doc = randomUUID()
  await f.client.rpush(f.list, JSON.stringify({ op: [], meta: null }))
  await f.client.set(f.lock, randomUUID())
  assert.deepEqual((await f.gate.takePending(f.project, doc, f.list)).updates, [])
  assert.equal(await f.client.llen(f.list), 1)
  await f.client.del(f.lock)
  await f.client.rpush(f.list, '{invalid json')
  await assert.rejects(f.gate.takePending(f.project, doc, f.list), /Invalid pending update JSON/)
  assert.equal(await f.client.llen(f.list), 2)
})


test('expired privileged consumer cannot dequeue even when its lease key has vanished', { skip: !url }, async t => {
  const f = await fixture(t), doc = randomUUID(), token = randomUUID()
  const { default: writes } = await import(process.env.WRITE_GATE_MODULE || '@overleaf/redis-wrapper/ProjectWriteGate.js')
  await f.client.rpush(f.list, JSON.stringify({ op: [], meta: null }))
  await assert.rejects(writes.runWithToken(f.project, token, () => f.gate.takePending(f.project, doc, f.list)), /PROJECT_WRITE_BUSY/)
  assert.equal(await f.client.llen(f.list), 1)
  await f.client.set(f.lock, token)
  const accepted = await writes.runWithToken(f.project, token, () => f.gate.takePending(f.project, doc, f.list))
  assert.equal(accepted.updates.length, 1)
  assert.equal(await f.client.llen(f.list), 0)
})
