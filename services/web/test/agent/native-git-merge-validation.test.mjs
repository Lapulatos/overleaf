import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { MergeValidationService } from '../../app/src/Features/NativeGit/MergeValidationService.mjs'
async function fixture(t, compile = async () => ({ status: 'success', outputFiles: [{ path: 'output.pdf' }] })) {
  const root = await mkdtemp(Path.join(tmpdir(), 'merge-validation-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const store = new CollaborationTaskStore(Path.join(root, 'tasks'))
  const documents = { files: [{ id: 'doc', version: 1, hash: 'old' }] }
  let identity = { commit: 'merged', documents, epoch: 2, rootDocId: 'doc', compiler: 'pdflatex' }, time = 1000
  const task = { id: randomUUID(), revision: 1, state: 'resolved', resolutionCommit: 'merged', application: { after: documents }, workspaceId: 'w', logicalProjectId: 'p' }
  await store.write(task)
  const drafts = { workspaceId: 'w', logicalProjectId: 'p', workspace: { withLock: fn => fn() }, store, authorize: async () => {},
    scoped: id => store.read(id), assertRevision: (task, revision) => { assert.equal(task.revision, revision) },
    save: async (task, fields) => { const next = { ...task, ...fields, revision: task.revision + 1 }; await store.write(next); return next },
  }
  const service = new MergeValidationService({ drafts, root, readIdentity: async () => structuredClone(identity), clock: () => time,
    capture: async () => ({ identity: structuredClone(identity), request: { compile: { resources: [{ path: 'main.tex', content: 'fixed' }] } } }), compile })
  return { service, task, store, edit: update => { identity = { ...identity, ...update } }, expire: () => { time += 600001 } }
}
test('success binds a captured request; later document versions, settings and branch changes are stale', async t => {
  const f = await fixture(t, async (id, captured) => {
    assert.match(id, /^[a-f0-9]{24}$/); assert.equal(captured.request.compile.resources[0].content, 'fixed')
    return { status: 'success', outputFiles: [{ path: 'output.pdf' }] }
  })
  assert.equal((await f.service.list())[0].validation.state, 'unchecked')
  assert.equal((await f.service.run(f.task.id, 1)).validation.state, 'success')
  for (const update of [{ compiler: 'xelatex' }, { commit: 'later' }, { documents: { files: [{ id: 'doc', version: 3, hash: 'old' }] } }]) {
    f.edit(update); assert.equal((await f.service.list())[0].validation.state, 'stale')
  }
})
test('editing during compilation keeps a fixed input and returns stale rather than current success', async t => {
  let release, started
  const startedPromise = new Promise(resolve => { started = resolve })
  const f = await fixture(t, async () => { started(); await new Promise(resolve => { release = resolve }); return { status: 'success', outputFiles: [{ path: 'output.pdf' }] } })
  const running = f.service.run(f.task.id, 1); await startedPromise
  assert.equal((await f.service.list())[0].validation.state, 'checking')
  const pending = await f.store.read(f.task.id)
  await assert.rejects(f.service.run(f.task.id, pending.revision), /already being checked/)
  f.edit({ epoch: 3 }); release()
  assert.equal((await running).validation.state, 'stale')
})
test('compiler failure does not undo the resolved merge; interrupted checks can retry', async t => {
  const f = await fixture(t, async () => { throw Error('compiler down') })
  const result = await f.service.run(f.task.id, 1)
  assert.equal(result.state, 'resolved'); assert.equal(result.validation.state, 'failed')
  const saved = await f.store.read(f.task.id)
  await f.store.write({ ...saved, validation: { ...saved.validation, state: 'checking' } })
  f.expire()
  assert.equal((await f.service.list())[0].validation.state, 'failed')
  assert.equal((await f.service.run(f.task.id, saved.revision)).validation.state, 'failed')
})
test('success without a PDF is a failed validation and stale merge cannot start', async t => {
  const f = await fixture(t, async () => ({ status: 'success', outputFiles: [] }))
  assert.equal((await f.service.run(f.task.id, 1)).validation.state, 'failed')
  f.edit({ commit: 'new' })
  await assert.rejects(f.service.run(f.task.id, (await f.store.read(f.task.id)).revision), /stale/)
})
