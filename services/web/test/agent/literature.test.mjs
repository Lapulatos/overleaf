import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  citationFromWork,
  createLiteratureService,
} from '../../app/src/Features/WritingAssist/WritingAssistLiteratureService.mjs'
const work = {
  DOI: '10.1234/example',
  title: ['A & B: 100%'],
  author: [{ given: 'Ana', family: 'Ponce-de-León' }],
  published: { 'date-parts': [[2024]] },
  type: 'journal-article',
  'container-title': ['Journal'],
  page: '1-9',
}
function fixture(body, status = 200) {
  const calls = []
  const service = createLiteratureService({
    canWrite: async (u) => u === 'owner',
    fetcher: async (...args) => {
      calls.push(args)
      return new Response(JSON.stringify(body), { status })
    },
  })
  return { service, calls }
}
test('citation preserves supplied names and source, escaping TeX special characters', () => {
  const result = citationFromWork(work)
  assert.equal(result.authors[0].family, 'Ponce-de-León')
  assert.match(result.bibtex, /A \\& B: 100\\%/)
  assert.match(result.bibtex, /Ponce-de-León, Ana/)
  assert.equal(result.source, 'Crossref')
  assert.equal(result.url, 'https://doi.org/10.1234/example')
  assert.equal(result.key, citationFromWork({ ...work }).key)
})
test('missing authors/year remain missing instead of invented', () => {
  const result = citationFromWork({ DOI: work.DOI, title: ['Title'] })
  assert.equal(result.year, null)
  assert.deepEqual(result.authors, [])
  assert.ok(!result.bibtex.includes('author ='))
  assert.ok(!result.bibtex.includes('year ='))
  assert.equal(citationFromWork({ title: ['No DOI'] }), null)
})
test('search checks project access before contacting provider and encodes query', async () => {
  const f = fixture({ message: { items: [work] } })
  await assert.rejects(f.service.search('other', 'p', 'query'), { status: 403 })
  assert.equal(f.calls.length, 0)
  const value = await f.service.search('owner', 'p', 'a & b')
  assert.equal(value.results.length, 1)
  assert.equal(f.calls[0][0].searchParams.get('query.bibliographic'), 'a & b')
  assert.equal(f.calls[0][0].hostname, 'api.crossref.org')
})
test('lookup rejects invalid DOI and mismatched upstream identity', async () => {
  const f = fixture({ message: work })
  await assert.rejects(f.service.lookup('owner', 'p', 'http://localhost'), {
    status: 400,
  })
  await assert.rejects(f.service.lookup('owner', 'p', '10.1234/different'), {
    status: 502,
  })
  assert.equal((await f.service.lookup('owner', 'p', work.DOI)).doi, work.DOI)
})
test('upstream errors and oversized responses remain explicit', async () => {
  const limited = fixture({}, 429)
  await assert.rejects(limited.service.search('owner', 'p', 'x'), {
    status: 429,
  })
  const huge = fixture({ text: 'x'.repeat(2 * 1024 * 1024) })
  await assert.rejects(huge.service.search('owner', 'p', 'x'), { status: 502 })
  const malformed = fixture({ message: {} })
  await assert.rejects(malformed.service.search('owner', 'p', 'x'), {
    status: 502,
  })
})

test('malformed metadata cannot silently truncate DOI or turn a string title into one character', () => {
  assert.equal(
    citationFromWork({ ...work, DOI: '10.1234/' + 'x'.repeat(300) }),
    null
  )
  assert.equal(citationFromWork({ ...work, title: 'Title' }), null)
  assert.deepEqual(citationFromWork({ ...work, author: [null] }).authors, [])
})

test('DOI searches use exact lookup instead of fuzzy bibliographic search', async () => {
  for (const query of [
    work.DOI,
    `https://doi.org/${work.DOI}`,
    `doi: ${work.DOI}`,
  ]) {
    const f = fixture({ message: work })
    const result = await f.service.search('owner', 'p', query)
    assert.equal(result.results[0].doi, work.DOI)
    assert.equal(
      String(f.calls[0][0]),
      'https://api.crossref.org/works/10.1234%2Fexample'
    )
  }
})
