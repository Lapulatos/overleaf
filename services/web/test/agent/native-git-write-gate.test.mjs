import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import Redis from 'ioredis'
import ProjectWriteGate from '@overleaf/redis-wrapper/ProjectWriteGate.js'

const url = process.env.NATIVE_GIT_TEST_REDIS_URL
test('unsupported clustered Redis keeps ordinary edits working and refuses exclusive Git transfers', async () => {
  const queued = []
  const gate = ProjectWriteGate.createProjectWriteGate({ nodes() {}, rpush: async (...args) => queued.push(args) }, { isEnabled: () => true })
  assert.equal(gate.supported(), false)
  await gate.enqueue('project', 'pending', 'edit')
  assert.deepEqual(queued, [['pending', 'edit']])
  await assert.rejects(gate.withExclusive('project', async () => {}), /unsupported/)
})
async function fixture(t, options = {}) {
  const client = new Redis(url, { maxRetriesPerRequest: 1 })
  const project = randomUUID().replaceAll('-', '').slice(0, 24)
  const list = `native-git:test:pending:${project}`
  t.after(async () => { await client.del(ProjectWriteGate.keyFor(project), list); await client.quit() })
  return { client, project, list, gate: ProjectWriteGate.createProjectWriteGate(client, { isEnabled: () => true, ...options }) }
}

test('exclusive transfer admits only its own internal document requests and rejects new queued edits atomically', { skip: !url }, async t => {
  const { client, gate, project, list } = await fixture(t)
  const started = Promise.withResolvers()
  const finish = Promise.withResolvers()
  await gate.enqueue(project, list, 'already queued')
  let token
  const transfer = gate.withExclusive(project, async () => {
    token = ProjectWriteGate.current(project).token
    await gate.assertWrite(project)
    assert.equal(ProjectWriteGate.requestHeaders(project)['X-Project-Write-Token'], token)
    started.resolve()
    await finish.promise
  })
  await started.promise
  await assert.rejects(gate.assertWrite(project), /being updated by Git/)
  await assert.rejects(gate.enqueue(project, list, 'must not queue'), /being updated by Git/)
  await assert.rejects(gate.withExclusive(project, async () => {}), /being updated by Git/)
  await assert.rejects(ProjectWriteGate.runWithToken(project, randomUUID(), () => gate.assertWrite(project)), /being updated by Git/)
  await ProjectWriteGate.runWithToken(project, token, () => gate.assertWrite(project))
  assert.deepEqual(await client.lrange(list, 0, -1), ['already queued'])
  finish.resolve()
  await transfer
  await assert.rejects(ProjectWriteGate.runWithToken(project, token, () => gate.assertWrite(project)), /being updated by Git/)
  await gate.enqueue(project, list, 'after transfer')
  assert.deepEqual(await client.lrange(list, 0, -1), ['already queued', 'after transfer'])
})

test('lease renews while active, releases after errors, and does not erase a replacement owner', { skip: !url }, async t => {
  const { client, gate, project } = await fixture(t, { ttlMs: 180, maxDurationMs: 5000 })
  await assert.rejects(gate.withExclusive(project, async () => {
    await sleep(500)
    assert.ok(await client.pttl(ProjectWriteGate.keyFor(project)) > 0)
    await gate.assertWrite(project)
    throw new Error('Import failed')
  }), /Import failed/)
  assert.equal(await client.get(ProjectWriteGate.keyFor(project)), null)
  const other = randomUUID()
  await assert.rejects(gate.withExclusive(project, async () => {
    await client.set(ProjectWriteGate.keyFor(project), other)
    await gate.assertWrite(project)
  }), /being updated by Git/)
  assert.equal(await client.get(ProjectWriteGate.keyFor(project)), other)
})

test('deadline expires privileged writes, while disabled integration leaves normal editing unchanged', { skip: !url }, async t => {
  const { client, gate, project, list } = await fixture(t, { ttlMs: 1000, maxDurationMs: 100 })
  await assert.rejects(gate.withExclusive(project, async () => {
    await sleep(180)
    await gate.assertWrite(project)
  }), /being updated by Git/)
  assert.equal(await client.get(ProjectWriteGate.keyFor(project)), null)
  const disabled = ProjectWriteGate.createProjectWriteGate(client, { isEnabled: () => false })
  await disabled.withWriter(project, async () => disabled.enqueue(project, list, 'normal edit'))
  assert.deepEqual(await client.lrange(list, 0, -1), ['normal edit'])
  await assert.rejects(disabled.withExclusive(project, async () => {}), /disabled/)
})
