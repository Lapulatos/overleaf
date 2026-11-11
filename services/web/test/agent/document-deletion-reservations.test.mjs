/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDocumentDeletionReservations } from '../../app/src/Features/WritingAssist/DocumentDeletionReservations.mjs'

const intent = {
  projectId: 'a'.repeat(24), docId: 'b'.repeat(24), userId: 'c'.repeat(24),
  taskId: randomUUID(), proposalId: randomUUID(), expectedVersion: 12,
  baseHash: 'd'.repeat(64), path: 'sections/obsolete.tex',
}
function storage() {
  const rows = new Map()
  return {
    rows,
    async deleteOne(query) {
      const row = rows.get(query._id)
      if (!row || !Object.entries(query).every(([key, value]) => row[key] === value)) return { deletedCount: 0 }
      rows.delete(query._id)
      return { deletedCount: 1 }
    },
    async findOne(query) { return structuredClone(rows.get(query._id)) },
    async updateOne(query, update, options = {}) {
      const row = rows.get(query._id)
      if (!row && options.upsert) {
        rows.set(query._id, { _id: query._id, ...structuredClone(update.$setOnInsert) })
      } else if (row && Object.entries(query).every(([key, value]) => row[key] === value)) {
        Object.assign(row, structuredClone(update.$set || {}))
      }
    },
  }
}

test('simultaneous retries retain one operation and immutable proposal binding', async () => {
  const db = storage()
  const store = createDocumentDeletionReservations(db)
  const results = await Promise.all(Array.from({ length: 20 }, () => store.begin(intent)))
  assert.equal(new Set(results.map(row => row.operationId)).size, 1)
  assert.equal(db.rows.size, 1)
  for (const changed of [{ expectedVersion: 13 }, { baseHash: 'e'.repeat(64) },
    { userId: 'f'.repeat(24) }, { taskId: randomUUID() }, { proposalId: randomUUID() },
    { path: 'different.tex' }]) {
    await assert.rejects(store.begin({ ...intent, ...changed }), { status: 409 })
  }
  assert.equal((await store.read(intent)).expectedVersion, 12)
})

test('commit requires fencing and the exact operation, and retries never regress state', async () => {
  const store = createDocumentDeletionReservations(storage())
  const row = await store.begin(intent)
  await assert.rejects(store.markCommitted(intent, row.operationId), { status: 409 })
  await assert.rejects(store.markFenced(intent, randomUUID()), { status: 409 })
  await Promise.all([store.markFenced(intent, row.operationId), store.markFenced(intent, row.operationId)])
  await store.markCommitting(intent, row.operationId)
  await Promise.all([store.markCommitted(intent, row.operationId), store.markCommitted(intent, row.operationId)])
  assert.equal((await store.markFenced(intent, row.operationId)).state, 'committed')
  assert.equal((await store.begin(intent)).state, 'committed')
})

test('a new service instance recovers an acknowledged storage write after response loss', async () => {
  const db = storage()
  const store = createDocumentDeletionReservations(db)
  const row = await store.begin(intent)
  const write = db.updateOne.bind(db)
  db.updateOne = async (...args) => { await write(...args); throw new Error('response lost') }
  await assert.rejects(store.markFenced(intent, row.operationId), /response lost/)
  db.updateOne = write
  const recovered = createDocumentDeletionReservations(db)
  assert.equal((await recovered.markFenced(intent, row.operationId)).state, 'fenced')
  await recovered.markCommitting(intent, row.operationId)
  await recovered.markCommitted(intent, row.operationId)
  assert.equal((await recovered.read(intent)).state, 'committed')
})

test('malformed and cross-project requests cannot access a reservation', async () => {
  const db = storage()
  const store = createDocumentDeletionReservations(db)
  for (const changed of [{ projectId: '../x' }, { expectedVersion: -1 },
    { expectedVersion: Number.MAX_SAFE_INTEGER + 1 }, { path: '../main.tex' },
    { baseHash: '' }, { taskId: 'bad' }]) {
    await assert.rejects(store.begin({ ...intent, ...changed }), { status: 400 })
  }
  assert.equal(db.rows.size, 0)
  await store.begin(intent)
  await assert.rejects(store.read({ ...intent, projectId: 'f'.repeat(24) }), { status: 409 })
  await assert.rejects(store.read({ ...intent, docId: 'f'.repeat(24) }), { status: 409 })
})

test('only the same still-preparing intent can be released, without harming a replacement', async () => {
  const store = createDocumentDeletionReservations(storage())
  const first = await store.begin(intent)
  assert.equal(await store.releasePreparing(intent, randomUUID()), false)
  assert.equal(await store.releasePreparing(intent, first.operationId), true)
  const next = { ...intent, expectedVersion: 13, proposalId: randomUUID() }
  const second = await store.begin(next)
  assert.notEqual(second.operationId, first.operationId)
  assert.equal(await store.releasePreparing(intent, first.operationId), false)
  await assert.rejects(store.markFenced(intent, first.operationId), { status: 409 })
  await store.markFenced(next, second.operationId)
  assert.equal(await store.releasePreparing(next, second.operationId), false)
  await assert.rejects(store.markCommitted(next, second.operationId), { status: 409 })
  await store.markCommitting(next, second.operationId)
  assert.equal(await store.releasePreparing(next, second.operationId), false)
})


test('admitted operation identity survives concurrent creation and lost replies', async () => {
  const db = storage()
  const store = createDocumentDeletionReservations(db)
  const operationId = randomUUID()
  const rows = await Promise.all(Array.from({ length: 12 }, () => store.begin(intent, { operationId })))
  assert.ok(rows.every(row => row.operationId === operationId))
  await assert.rejects(store.begin(intent, { operationId: randomUUID() }), { status: 409 })
  assert.equal((await store.read(intent)).operationId, operationId)
  const next = { ...intent, docId: 'e'.repeat(24) }
  const update = db.updateOne.bind(db)
  db.updateOne = async (...args) => { await update(...args); throw new Error('response lost') }
  await assert.rejects(store.begin(next, { operationId }), /response lost/)
  db.updateOne = update
  assert.equal((await createDocumentDeletionReservations(db).begin(next, { operationId })).operationId, operationId)
})

test('invalid admitted IDs cannot create a reservation or adopt a legacy operation', async () => {
  const db = storage()
  const store = createDocumentDeletionReservations(db)
  for (const operationId of [null, '', 'bad', 42, {}]) {
    await assert.rejects(store.begin(intent, { operationId }), { status: 400 })
  }
  assert.equal(db.rows.size, 0)
  const legacy = await store.begin(intent)
  await assert.rejects(store.begin(intent, { operationId: randomUUID() }), { status: 409 })
  assert.equal((await store.read(intent)).operationId, legacy.operationId)
  assert.equal((await store.begin(intent, { operationId: legacy.operationId })).operationId, legacy.operationId)
})




