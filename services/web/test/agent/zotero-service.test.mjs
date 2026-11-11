import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createZoteroService } from '../../app/src/Features/WritingAssist/WritingAssistZoteroService.mjs'
const input = { libraryId: '12345', apiKey: 'PrivateTestKey1234567890' }
function fixture(secret = 'a'.repeat(32)) {
  const rows = new Map()
  const calls = []
  const service = createZoteroService({
    store: {
      get: async (user) => rows.get(user),
      set: async (user, data) => rows.set(user, data),
      remove: async (user) => rows.delete(user),
    },
    client: {
      search: async (...args) => {
        calls.push(args)
        return { results: [] }
      },
      lookup: async (...args) => {
        calls.push(args)
        return { itemKey: args[1] }
      },
    },
    canWrite: async (user) => user !== 'denied',
    encryptionKey: () => secret,
  })
  return { service, rows, calls }
}
test('Zotero credentials are encrypted per user and never returned by status', async () => {
  const f = fixture()
  assert.deepEqual(await f.service.connect('alice', 'p', input), {
    connected: true,
    libraryId: '12345',
  })
  assert.ok(!JSON.stringify(f.rows.get('alice')).includes(input.apiKey))
  assert.deepEqual(await f.service.status('alice', 'p'), {
    connected: true,
    libraryId: '12345',
  })
  assert.deepEqual(await f.service.status('bob', 'p'), {
    connected: false,
    libraryId: null,
  })
  await assert.rejects(f.service.search('bob', 'p', 'query', 0), {
    status: 409,
  })
  await f.service.lookup('alice', 'p', 'ABCDEFGH')
  assert.equal(f.calls.at(-1)[0].apiKey, input.apiKey)
})
test('Zotero authorization runs before credential reads or upstream calls', async () => {
  const f = fixture()
  for (const action of [
    () => f.service.connect('denied', 'p', input),
    () => f.service.status('denied', 'p'),
    () => f.service.disconnect('denied', 'p'),
    () => f.service.search('denied', 'p', '', 0),
    () => f.service.lookup('denied', 'p', 'ABCDEFGH'),
  ])
    await assert.rejects(action(), { status: 403 })
  assert.equal(f.rows.size, 0)
  assert.equal(f.calls.length, 0)
})
test('Zotero refuses to store keys using the old development encryption default', async () => {
  const f = fixture('dev-key-change-me')
  await assert.rejects(f.service.connect('alice', 'p', input), { status: 503 })
  assert.equal(f.rows.size, 0)
  assert.equal(f.calls.length, 0)
})
test('Zotero disconnect forgets only the caller connection', async () => {
  const f = fixture()
  await f.service.connect('alice', 'p', input)
  await f.service.connect('bob', 'p', input)
  await f.service.disconnect('alice', 'p')
  assert.equal(f.rows.has('alice'), false)
  assert.equal(f.rows.has('bob'), true)
})
test('corrupt stored Zotero key produces a reconnect message without secret details', async () => {
  const f = fixture()
  f.rows.set('alice', { libraryId: '12345', encryptedApiKey: 'corrupt-secret' })
  await assert.rejects(
    f.service.search('alice', 'p', '', 0),
    (error) => error.status === 503 && !error.message.includes('corrupt-secret')
  )
  assert.equal(f.calls.length, 0)
})
