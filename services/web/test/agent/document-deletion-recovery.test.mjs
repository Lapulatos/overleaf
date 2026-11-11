/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createDeletionRecoveryReader } from '../../app/src/Features/WritingAssist/DocumentDeletionRecovery.mjs'
function fixture() {
  const args = ['a'.repeat(24), 'b'.repeat(24), randomUUID()]
  const row = { projectId: args[0], docId: args[1], operationId: args[2], state: 'fenced', path: 'tex/chapter.tex', expectedVersion: 3, baseHash: createHash('sha256').update('original').digest('hex') }
  const project = { rootFolder: [{ docs: [], folders: [{ name: 'tex', docs: [{ _id: args[1], name: 'chapter.tex' }] }] }] }
  const doc = { lines: ['original'], version: 3 }
  const adapters = { getReservation: async () => ({ ...row }), getProject: async () => project, getDocument: async () => doc }
  return { args, row, project, doc, adapters, run: () => createDeletionRecoveryReader(adapters)(...args) }
}
test('proof verifies stored content and returns no manuscript', async () => {
  const f = fixture()
  assert.deepEqual(await f.run(), { projectId: f.args[0], docId: f.args[1], operationId: f.args[2], version: 3, pathname: f.row.path, baseHash: f.row.baseHash })
})
test('invalid identity and non-fenced operation cannot read persisted content', async () => {
  for (const state of ['preparing', 'committing', 'committed']) {
    const f = fixture(); f.row.state = state
    f.adapters.getDocument = async () => assert.fail('must not read')
    await assert.rejects(f.run(), { status: 409 })
  }
  const f = fixture(); f.args[0] = '../project'
  await assert.rejects(f.run(), { status: 400 })
})
test('changed persisted version, content or malformed lines reject proof', async () => {
  for (const doc of [{ version: 4, lines: ['original'] }, { version: 3, lines: ['modified'] }, { version: 3, lines: [null] }]) {
    const f = fixture(); f.adapters.getDocument = async () => doc
    await assert.rejects(f.run(), { status: 409 })
  }
})
test('renamed, missing, ambiguous or already removed file cannot recover', async () => {
  for (const change of [f => { f.project.rootFolder[0].folders[0].name = 'renamed' },
    f => { f.project.rootFolder = [] },
    f => { f.project.rootFolder[0].docs.push({ _id: f.args[1], name: 'duplicate.tex' }) },
    f => { f.project.deletionReceipts = { [f.args[2]]: {} } }]) {
    const f = fixture(); change(f)
    await assert.rejects(f.run(), { status: 409 })
  }
})
test('reservation and path are checked again after storage read', async () => {
  for (const change of [f => { f.row.state = 'committing' }, f => { f.row.operationId = randomUUID() }, f => { f.project.rootFolder = [] }]) {
    const f = fixture()
    f.adapters.getDocument = async () => { change(f); return f.doc }
    await assert.rejects(f.run(), { status: 409 })
  }
})


