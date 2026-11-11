/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDeletionTaskRetention } from '../../app/src/Features/WritingAssist/DocumentDeletionTaskRetention.mjs'

test('retention readiness supports native and buffered Mongoose index cursors', async () => {
  for (const buffered of [false, true]) {
    const cursor = { toArray: async () => [{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }] }
    await createDeletionTaskRetention({ listIndexes: () => buffered ? Promise.resolve(cursor) : cursor }).assertReady()
  }
})
test('buffered indexes still reject the legacy expiration policy', async () => {
  const cursor = { toArray: async () => [{ key: { createdAt: 1 }, expireAfterSeconds: 604800 }] }
  await assert.rejects(createDeletionTaskRetention({ listIndexes: async () => cursor }).assertReady(), { status: 503 })
})
