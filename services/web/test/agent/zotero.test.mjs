import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  citationFromZotero,
  createZoteroClient,
} from '../../app/src/Features/WritingAssist/WritingAssistZoteroClient.mjs'
import { assertCitationAbsent } from '../../app/src/Features/WritingAssist/WritingAssistCitationService.mjs'
const credentials = { libraryId: '12345', apiKey: 'PrivateTestKey1234567890' }
const item = {
  key: 'ABCDEFGH',
  data: {
    itemType: 'book',
    title: 'A & B: 100%',
    date: '2024',
    creators: [
      { creatorType: 'author', firstName: 'Ana', lastName: 'Ponce-de-León' },
    ],
    publisher: 'Example Press',
  },
}
function fixture(body, status = 200) {
  const calls = []
  const client = createZoteroClient({
    fetcher: async (...args) => {
      calls.push(args)
      return new Response(JSON.stringify(body), { status })
    },
  })
  return { client, calls }
}
test('Zotero converts a non-DOI item without inventing metadata', () => {
  const citation = citationFromZotero(item, '12345')
  assert.equal(citation.doi, null)
  assert.equal(citation.key, 'poncedeleon2024a')
  assert.equal(citation.sourceId, 'users/12345/items/ABCDEFGH')
  assert.match(citation.bibtex, /A \\& B: 100\\%/)
  assert.match(citation.bibtex, /Ponce-de-León, Ana/)
  assert.ok(!citation.bibtex.includes('doi ='))
  const unknown = citationFromZotero(
    {
      key: 'ABCDEFGH',
      data: { itemType: 'document', title: 'No date or author' },
    },
    '12345'
  )
  assert.equal(unknown.year, null)
  assert.deepEqual(unknown.authors, [])
})
test('Zotero notes and attachments are not offered as bibliography entries', () => {
  for (const type of ['note', 'attachment', 'annotation'])
    assert.equal(
      citationFromZotero(
        { ...item, data: { ...item.data, itemType: type } },
        '12345'
      ),
      null
    )
})
test('Zotero item provenance prevents duplicate imports after citation-key rename', () => {
  const citation = citationFromZotero(item, '12345')
  assert.doesNotThrow(() =>
    assertCitationAbsent(
      [{ path: 'r.bib', content: '@book{other,title={Other}}' }],
      citation
    )
  )
  assert.throws(
    () =>
      assertCitationAbsent(
        [
          {
            path: 'r.bib',
            content: citation.bibtex.replace(citation.key, 'renamed'),
          },
        ],
        citation
      ),
    { status: 409 }
  )
  assert.throws(
    () =>
      assertCitationAbsent(
        [{ path: 'r.bib', content: citation.bibtex }],
        citation
      ),
    { status: 409 }
  )
})
test('Zotero search uses fixed origin, header key, bounded page, and no redirects', async () => {
  const f = fixture([item])
  const result = await f.client.search(credentials, 'a & b', 20)
  assert.equal(result.results.length, 1)
  assert.equal(result.nextStart, null)
  const [url, options] = f.calls[0]
  assert.equal(url.origin, 'https://api.zotero.org')
  assert.equal(url.searchParams.get('q'), 'a & b')
  assert.equal(url.searchParams.get('limit'), '20')
  assert.equal(url.searchParams.get('start'), '20')
  assert.ok(!url.href.includes(credentials.apiKey))
  assert.equal(options.headers['Zotero-API-Key'], credentials.apiKey)
  assert.equal(options.headers['Zotero-API-Version'], '3')
  assert.equal(options.redirect, 'error')
})
test('Zotero rejects malformed credentials/item identifiers before requests', async () => {
  const f = fixture(item)
  await assert.rejects(f.client.lookup(credentials, '../local'), {
    status: 400,
  })
  await assert.rejects(
    f.client.search({ ...credentials, libraryId: 'https://evil.test' }, ''),
    { status: 400 }
  )
  await assert.rejects(f.client.search(credentials, '', -1), { status: 400 })
  assert.equal(f.calls.length, 0)
})
test('Zotero lookup checks item identity and maps auth failure without reflecting upstream details', async () => {
  const f = fixture(item)
  assert.equal((await f.client.lookup(credentials, 'ABCDEFGH')).doi, null)
  await assert.rejects(f.client.lookup(credentials, 'IJKLMNOP'), {
    status: 422,
  })
  const denied = fixture({ error: credentials.apiKey }, 403)
  await assert.rejects(
    denied.client.lookup(credentials, 'ABCDEFGH'),
    (error) =>
      error.status === 401 && !error.message.includes(credentials.apiKey)
  )
  const huge = fixture({ data: 'x'.repeat(2 * 1024 * 1024) })
  await assert.rejects(huge.client.lookup(credentials, 'ABCDEFGH'), {
    status: 502,
  })
})

test('non-DOI library import creates a reviewable proposal retaining item provenance', async () => {
  const { createCitationService } =
    await import('../../app/src/Features/WritingAssist/WritingAssistCitationService.mjs')
  const citation = citationFromZotero(item, '12345')
  const records = new Map()
  const service = createCitationService({
    canWrite: async () => true,
    literature: { lookup: async () => citation },
    snapshot: async () => [],
    store: { create: async (task) => records.set(task.id, task) },
    tasks: { get: async (u, p, id) => records.get(id) },
  })
  const { task } = await service.preview('u', 'p', 'ABCDEFGH', {
    newName: 'references.bib',
  })
  assert.equal(task.proposals[0].status, 'pending')
  assert.equal(task.proposals[0].citation.sourceId, citation.sourceId)
  assert.equal(task.proposals[0].citation.doi, null)
  assert.match(task.instruction, /users\/12345\/items\/ABCDEFGH/)
  assert.equal(task.proposals[0].after, citation.bibtex)
})

test('Zotero retries one transient read failure without exposing credentials', async () => {
  let calls = 0
  const client = createZoteroClient({ fetcher: async () => {
    calls++
    if (calls === 1) throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })
    return new Response(JSON.stringify([item]))
  } })
  assert.equal((await client.search(credentials, 'test')).results.length, 1)
  assert.equal(calls, 2)
})
test('Zotero distinguishes malformed JSON from network and timeout errors', async () => {
  const malformed = createZoteroClient({ fetcher: async () => new Response('<html>unavailable</html>') })
  await assert.rejects(malformed.search(credentials, 'test'), error => error.status === 502 && error.message.includes('invalid JSON'))
  const timedOut = createZoteroClient({ fetcher: async () => { throw new DOMException('timeout', 'TimeoutError') } })
  await assert.rejects(timedOut.search(credentials, 'test'), error => error.status === 504 && error.message.includes('do not need to reconnect'))
  let calls = 0
  const denied = createZoteroClient({ fetcher: async () => { calls++;return new Response('', { status: 403 }) } })
  await assert.rejects(denied.search(credentials, 'test'), { status: 401 })
  assert.equal(calls, 1)
})
