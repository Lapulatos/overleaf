import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { ShellContainerLifecycle } from '../../app/src/Features/NativeGit/ShellContainerLifecycle.mjs'

async function fixture(t) {
  const directory = await mkdtemp(Path.join(tmpdir(), 'shell-lifecycle-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const store = new CollaborationTaskStore(directory)
  const input = { attemptId: randomUUID(), draftId: randomUUID(), logicalProjectId: 'a'.repeat(24), workspaceId: 'b'.repeat(24), actorId: 'c'.repeat(24) }
  const configuration = { image: 'fixture-image', directory: '/draft/work', mode: 'full-access' }
  const calls = []
  let container
  const docker = {
    async create(options) {
      calls.push('create')
      assert.equal((await store.read(input.attemptId)).state, 'creating')
      container = { Id: 'container-1', Name: `/${options.name}`, Config: { Labels: options.labels }, HostConfig: { RestartPolicy: { Name: options.restart }, AutoRemove: options.autoRemove }, State: { Running: false, Restarting: false, Status: 'created', StartedAt: '0001-01-01T00:00:00Z' } }
    },
    async inspect() { if (!container) throw Object.assign(new Error('missing'), { code: 'ENOENT' }); return structuredClone(container) },
    async start() {
      calls.push('start')
      assert.equal((await store.read(input.attemptId)).state, 'starting')
      container.State = { Running: true, Restarting: false, Status: 'running', StartedAt: '2026-11-11T00:00:00Z' }
    },
    async stop() { calls.push('stop'); container.State = { ...container.State, Running: false, Status: 'exited' } },
  }
  // Tests serialize callers, but do not claim a production cross-process lock.
  let pending = Promise.resolve()
  const withLock = (_key, fn) => { const next = pending.then(fn); pending = next.catch(() => {}); return next }
  const service = () => new ShellContainerLifecycle({ store, docker, withLock })
  return { store, input, configuration, calls, docker, service, mutate: fn => fn(container), remove: () => { container = undefined } }
}

test('durable create/start and stop survive service reconstruction without replay', async t => {
  const f = await fixture(t)
  const result = await f.service().start(f.input, f.configuration)
  assert.equal(result.containerId, 'container-1')
  assert.deepEqual(await f.service().start(f.input, { mode: 'full-access', directory: '/draft/work', image: 'fixture-image' }), result)
  assert.deepEqual(f.calls, ['create', 'start'])
  assert.equal((await f.service().stop(f.input)).quiescent, true)
  await assert.rejects(f.service().start(f.input, f.configuration), /already exists/)
  assert.equal((await f.store.read(f.input.attemptId)).state, 'stopped')
})

test('missing known container never recreates an attempt', async t => {
  const f = await fixture(t)
  await f.service().start(f.input, f.configuration)
  f.remove()
  await assert.rejects(f.service().start(f.input, f.configuration), /missing/)
  await assert.rejects(f.service().stop(f.input), /missing/)
  assert.deepEqual(f.calls, ['create', 'start'])
})

test('changed configuration, actor and replaced container are refused', async t => {
  const f = await fixture(t)
  await f.service().start(f.input, f.configuration)
  await assert.rejects(f.service().start(f.input, { ...f.configuration, directory: '/other' }), /configuration changed/)
  await assert.rejects(f.service().stop({ ...f.input, actorId: 'd'.repeat(24) }), /scope mismatch/)
  f.mutate(c => { c.Id = 'replacement' })
  await assert.rejects(f.service().start(f.input, f.configuration), /replaced/)
  await assert.rejects(f.service().stop(f.input), /replaced/)
  assert.deepEqual(f.calls, ['create', 'start'])
})

test('lost start response is retained and stopped by identity without retry', async t => {
  const f = await fixture(t)
  const start = f.docker.start
  f.docker.start = async () => { await start(); throw new Error('response lost') }
  await assert.rejects(f.service().start(f.input, f.configuration), /response lost/)
  assert.equal((await f.store.read(f.input.attemptId)).state, 'uncertain')
  await assert.rejects(f.service().start(f.input, f.configuration), /already exists/)
  assert.equal((await f.service().stop(f.input)).quiescent, true)
  assert.deepEqual(f.calls, ['create', 'start', 'stop'])
})

test('unconfirmed never-started attempt cannot be declared quiescent', async t => {
  const f = await fixture(t)
  f.docker.start = async () => { throw new Error('timeout') }
  await assert.rejects(f.service().start(f.input, f.configuration), /timeout/)
  await assert.rejects(f.service().stop(f.input), /ambiguous/)
  assert.deepEqual(f.calls, ['create'])
})

for (const mutation of [c => { c.HostConfig.AutoRemove = true }, c => { c.HostConfig.RestartPolicy.Name = 'always' }, c => { c.Config.Labels['overleaf.shell.actorId'] = 'd'.repeat(24) }]) {
  test('container policy or scope tampering prevents stop acknowledgement', async t => {
    const f = await fixture(t)
    await f.service().start(f.input, f.configuration)
    f.mutate(mutation)
    await assert.rejects(f.service().stop(f.input), /identity or restart policy/)
    assert.deepEqual(f.calls, ['create', 'start'])
  })
}

test('Docker stop returning before exit never enables review', async t => {
  const f = await fixture(t)
  await f.service().start(f.input, f.configuration)
  f.docker.stop = async () => {}
  await assert.rejects(f.service().stop(f.input), /has not stopped/)
  assert.equal((await f.store.read(f.input.attemptId)).state, 'stopping')
})

test('concurrent identical starts make one container and one start call', async t => {
  const f = await fixture(t)
  const results = await Promise.all([f.service().start(f.input, f.configuration), f.service().start(f.input, f.configuration)])
  assert.deepEqual(results[0], results[1])
  assert.deepEqual(f.calls, ['create', 'start'])
})
