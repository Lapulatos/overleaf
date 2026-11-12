import test from 'node:test'
import assert from 'node:assert/strict'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { AutoCommitService } from '../../app/src/Features/NativeGit/AutoCommitService.mjs'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { WorkspaceStore } from '../../app/src/Features/NativeGit/WorkspaceStore.mjs'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { writeWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
async function fixture(t) {
  const root = await mkdtemp(Path.join(tmpdir(), 'auto-service-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = await GitRepository.init(Path.join(root, 'repo'))
  await repo.author('Human', 'human@example.test')
  await writeWorktree(repo.directory, new Map([['main.tex', Buffer.from('base')]]))
  await repo.stage(['main.tex']); await repo.commit('base')
  const f = { epoch: 3, version: 1, text: 'saved edits', allowed: true, failExit: false, failPrepare: false, prepares: 0 }
  const store = new WorkspaceStore(Path.join(root, 'binding'))
  await store.initialize({ directory: repo.directory, branch: 'main' })
  const taskStore = new CollaborationTaskStore(Path.join(root, 'tasks'))
  const read = async () => ({ files: new Map([['main.tex', Buffer.from(f.text)]]), entries: new Map([['main.tex', { id: 'doc1', type: 'doc', version: f.version }]]), folders: new Map() })
  const project = { transaction: async (action, options) => {
    assert.deepEqual(options, { prepare: true, epoch: f.epoch }); f.prepares++
    if (f.failPrepare) throw Error('client did not acknowledge saving')
    let active = true
    try {
      const result = await action({ read, assertActive: async () => { assert.ok(active) } })
      if (f.failExit) throw Error('lease lost at transaction exit')
      return result
    } finally { active = false }
  } }
  const service = new AutoCommitService({ workspace: { current: async binding => { assert.equal(binding.directory, repo.directory); return repo } },
    project, workspaceStore: store, taskStore, withLock: fn => fn(), authorize: async () => { if (!f.allowed) throw Object.assign(Error('revoked'), { status: 403 }) },
    readEpoch: async () => f.epoch, workspaceId: 'a', ownerId: 'owner' })
  return Object.assign(f, { repo, service, store, taskStore })
}
test('prepared service commits live saved snapshot and releases only its mutation', async t => {
  const f = await fixture(t), snapshot = await f.service.preview(), operationId = randomUUID()
  const result = await f.service.execute({ operationId, snapshot })
  assert.equal(await f.repo.git.show(['HEAD:main.tex']), 'saved edits')
  assert.equal(result.commit, await f.repo.head()); assert.equal(f.prepares, 2)
  assert.equal((await f.store.read()).mutationTaskId, undefined)
  assert.equal((await f.taskStore.read(operationId)).state, 'complete')
})
test('identical bytes with newer document version reject old preview', async t => {
  const f = await fixture(t), snapshot = await f.service.preview(), head = await f.repo.head()
  f.version++
  await assert.rejects(f.service.execute({ operationId: randomUUID(), snapshot }), /Saved documents changed/)
  assert.equal(await f.repo.head(), head); assert.equal((await f.store.read()).mutationTaskId, undefined)
})
test('new epoch and changed branch binding reject stale preview', async t => {
  const f = await fixture(t), snapshot = await f.service.preview()
  f.epoch++
  await assert.rejects(f.service.execute({ operationId: randomUUID(), snapshot }), { status: 409 })
  f.epoch--; await f.store.write({ directory: f.repo.directory, branch: 'other' })
  await assert.rejects(f.service.execute({ operationId: randomUUID(), snapshot }), { status: 409 })
})
test('another recovery mutation is never stolen or cleared', async t => {
  const f = await fixture(t), snapshot = await f.service.preview(), other = randomUUID()
  await f.store.beginMutation(other)
  await assert.rejects(f.service.execute({ operationId: randomUUID(), snapshot }), { status: 409 })
  assert.equal((await f.store.read()).mutationTaskId, other)
})
test('failed client save preparation leaves Git and mutation ownership untouched', async t => {
  const f = await fixture(t), snapshot = await f.service.preview(), head = await f.repo.head()
  f.failPrepare = true
  await assert.rejects(f.service.execute({ operationId: randomUUID(), snapshot }), /client did not acknowledge/)
  assert.equal(await f.repo.head(), head); assert.equal((await f.store.read()).mutationTaskId, undefined)
})
test('late transaction failure retains completed journal and recovery block', async t => {
  const f = await fixture(t), snapshot = await f.service.preview(), operationId = randomUUID()
  f.failExit = true
  await assert.rejects(f.service.execute({ operationId, snapshot }), error => /lease lost/.test(error.message) && error.autoCommitNotStarted !== true)
  assert.equal((await f.store.read()).mutationTaskId, operationId)
  const record = await f.taskStore.read(operationId)
  assert.equal(record.state, 'complete'); assert.equal(record.commit, await f.repo.head())
  await assert.rejects(f.service.preview(), { status: 409 })
})
test('revoked owner cannot prepare or commit', async t => {
  const f = await fixture(t), snapshot = await f.service.preview(); f.allowed = false
  await assert.rejects(f.service.execute({ operationId: randomUUID(), snapshot }), error => error.status === 403 && error.autoCommitNotStarted === true)
  assert.equal((await f.store.read()).mutationTaskId, undefined)
})
test('explicit prepared recovery clears a late failure without duplicating the commit', async t => {
  const f = await fixture(t), snapshot = await f.service.preview(), operationId = randomUUID()
  f.failExit = true
  await assert.rejects(f.service.execute({ operationId, snapshot }), /lease lost/)
  const head = await f.repo.head()
  f.failExit = false; f.text = 'newer writing'; f.version++
  const preview = await f.service.recoveryPreview(operationId)
  assert.equal(preview.action, 'complete')
  const result = await f.service.recover(preview)
  assert.equal(result.state, 'complete'); assert.equal(await f.repo.head(), head)
  assert.equal(f.text, 'newer writing'); assert.equal((await f.store.read()).mutationTaskId, undefined)
  await f.service.recover(await f.service.recoveryPreview(operationId))
  assert.equal(await f.repo.head(), head)
})
test('client preparation timeout leaves a durable cancellable attempt', async t => {
  const f = await fixture(t), snapshot = await f.service.preview(), operationId = randomUUID(), head = await f.repo.head()
  f.failPrepare = true
  await assert.rejects(f.service.execute({ operationId, snapshot }), /client did not acknowledge/)
  assert.equal((await f.taskStore.read(operationId)).state, 'requested')
  assert.equal((await f.store.read()).mutationTaskId, undefined)
  f.failPrepare = false
  const preview = await f.service.recoveryPreview(operationId)
  assert.equal(preview.action, 'cancel')
  const result = await f.service.recover(preview)
  assert.equal(result.state, 'cancelled'); assert.equal(await f.repo.head(), head)
  assert.equal((await f.store.read()).mutationTaskId, undefined)
})

test('shared merge review pauses preview and rejects a previously prepared automatic commit', async t => {
 const f = await fixture(t), snapshot = await f.service.preview(), head = await f.repo.head()
 f.service.hasPendingMerge = async () => true
 assert.equal((await f.service.preview()).conflicted, true)
 await assert.rejects(f.service.execute({ operationId: randomUUID(), snapshot }), /shared merge task/)
 assert.equal(await f.repo.head(), head)
 assert.equal((await f.taskStore.list()).length, 0)
})
