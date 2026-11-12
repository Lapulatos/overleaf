import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { HistoryRestoreJournal, historyFingerprint } from '../../app/src/Features/History/HistoryRestoreJournal.mjs'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
async function fixture(t) {
  const root = await mkdtemp(Path.join(tmpdir(), 'history-journal-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const store = new CollaborationTaskStore(root)
  return { store, journal: new HistoryRestoreJournal(store) }
}
test('partial failure persists completed and in-flight file steps across process reconstruction', async t => {
  const { store, journal } = await fixture(t)
  const task = await journal.start({ workspaceId: 'a', version: 4 }, { files: ['old'] })
  await assert.rejects(journal.run(task, async step => {
    await step('before', 'a.tex', 'restore'); await step('after', 'a.tex', 'restore')
    await step('before', 'b.tex', 'restore'); throw Error('interrupted')
  }, async () => 'checkpoint'), /interrupted/)
  const [saved] = await new HistoryRestoreJournal(new CollaborationTaskStore(store.directory)).pending()
  assert.equal(saved.state, 'recovery-required'); assert.equal(saved.steps.length, 3)
  assert.equal(saved.steps[1].checkpoint, 'checkpoint')
  await assert.rejects(journal.start({ version: 5 }, {}), { status: 409 })
})
test('changed files or stale task revision refuse recovery without resolving the task', async t => {
  const { journal, store } = await fixture(t)
  const task = await journal.start({ version: 4 }, {})
  const before = { fileId: 'a', version: 1, text: 'x' }
  for (const next of [{ ...before, version: 2 }, { ...before, fileId: 'b' }, { ...before, text: 'new' }]) {
    await assert.rejects(journal.review(task.id, task.revision, historyFingerprint(before), next), { status: 409 })
  }
  await assert.rejects(journal.review(task.id, task.revision + 1, historyFingerprint(before), before), { status: 409 })
  assert.equal((await store.read(task.id)).state, 'applying')
})
test('explicitly reviewed retry resolves and duplicate recovery is refused', async t => {
  const { journal } = await fixture(t)
  let task = await journal.start({ version: 4 }, {})
  task = await journal.review(task.id, task.revision, historyFingerprint({}), {})
  await journal.run(task, async step => { await step('before','a','restore'); await step('after','a','restore'); return ['done'] }, async () => 'final')
  assert.equal((await journal.pending())[0].state, 'applied-awaiting-finalization')
  await journal.complete(task.id)
  assert.deepEqual(await journal.pending(), [])
  await assert.rejects(journal.review(task.id, task.revision, historyFingerprint({}), {}), { status: 409 })
})

test('exit failure retains recovery even after all file mutations finished', async t => {
  const { journal, store } = await fixture(t)
  const task = await journal.start({ version: 4 }, {})
  await journal.run(task, async step => { await step('after', 'a', 'restore') }, async () => 'final')
  await journal.interrupt(task.id)
  assert.equal((await store.read(task.id)).state, 'recovery-required')
  assert.equal((await journal.pending()).length, 1)
  await assert.rejects(journal.complete(task.id), { status: 409 })
})
