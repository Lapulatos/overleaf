import { citationKey } from './WritingAssistCitationKey.mjs'
import { AgentError } from './WritingAssistAgentService.mjs'

const API = 'https://api.crossref.org/works'
const MAX_BYTES = 2 * 1024 * 1024
function text(value, limit = 2000) {
  return typeof value === 'string' ? value.slice(0, limit).trim() : ''
}
function latex(value) {
  const replacements = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '%': '\\%',
    '&': '\\&',
    '#': '\\#',
    _: '\\_',
    $: '\\$',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}',
  }
  return String(value)
    .replace(/[\\{}%&#_$~^]/g, (char) => replacements[char])
    .replace(/[\r\n]+/g, ' ')
}
export function citationFromWork(work) {
  if (
    typeof work?.DOI !== 'string' ||
    work.DOI.length > 256 ||
    !Array.isArray(work.title) ||
    typeof work.title[0] !== 'string' ||
    work.title[0].length > 2000
  )
    return null
  const doi = text(work.DOI, 256)
  const title = text(work.title[0])
  if (!/^10\.\d{4,9}\/\S+$/i.test(doi) || !title) return null
  const authors = (Array.isArray(work.author) ? work.author : [])
    .filter((author) => author && typeof author === 'object')
    .slice(0, 100)
    .map((author) => ({
      family: text(author.family, 200),
      given: text(author.given, 200),
      name: text(author.name, 400),
    }))
    .filter((author) => author.family || author.name)
  const date =
    work.published?.['date-parts']?.[0] || work.issued?.['date-parts']?.[0]
  const year =
    Number.isInteger(date?.[0]) && date[0] > 0 && date[0] < 10000
      ? date[0]
      : null
  const venue = text(
    Array.isArray(work['container-title']) ? work['container-title'][0] : '',
    500
  )
  const key = citationKey({ authors, year, title })
  const type =
    work.type === 'journal-article'
      ? 'article'
      : work.type === 'proceedings-article'
        ? 'inproceedings'
        : work.type === 'book'
          ? 'book'
          : 'misc'
  const url = `https://doi.org/${doi.split('/').map(encodeURIComponent).join('/')}`
  const fields = { title: `{${latex(title)}}` }
  if (authors.length)
    fields.author = authors
      .map((author) =>
        author.family
          ? `${latex(author.family)}${author.given ? ', ' + latex(author.given) : ''}`
          : `{${latex(author.name)}}`
      )
      .join(' and ')
  if (year) fields.year = String(year)
  if (venue && ['article', 'inproceedings'].includes(type))
    fields[type === 'article' ? 'journal' : 'booktitle'] = latex(venue)
  for (const field of ['volume', 'issue', 'page', 'publisher']) {
    const value = text(work[field], 500)
    if (value)
      fields[
        field === 'issue' ? 'number' : field === 'page' ? 'pages' : field
      ] = latex(value)
  }
  if (Number.isInteger(date?.[1]) && date[1] >= 1 && date[1] <= 12) fields.month = String(date[1])
  if (text(work['article-number'], 100)) fields.articleno = latex(work['article-number'])
  if (Array.isArray(work.ISBN) && work.ISBN[0]) fields.isbn = latex(text(work.ISBN[0], 100))
  const abstract = text(work.abstract, 20000).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (abstract) fields.abstract = latex(abstract)
  if (Array.isArray(work.ISSN) && work.ISSN[0]) fields.issn = latex(text(work.ISSN[0], 100))
  if (text(work['publisher-location'], 500)) fields.address = latex(work['publisher-location'])
  if (text(work.event?.location, 500)) fields.location = latex(work.event.location)
  if (Array.isArray(work.subject) && work.subject.length) fields.keywords = latex(work.subject.filter(s => typeof s === 'string').slice(0, 30).join(', '))
  if (fields.pages) fields.pages = fields.pages.replace(/(\d)\s*[-–—]+\s*(?=\d)/g, '$1--')
  const range = fields.pages?.match(/^(\d+)--(\d+)$/)
  if (range && Number(range[2]) >= Number(range[1])) fields.numpages = String(Number(range[2]) - Number(range[1]) + 1)
  fields.doi = latex(doi)
  fields.url = latex(url)
  const bibtex = `@${type}{${key},\n${Object.entries(fields)
    .map(([name, value]) => `  ${name} = {${value}}`)
    .join(',\n')}\n}\n`
  return {
    doi,
    title,
    authors,
    year,
    venue,
    url,
    key,
    bibtex,
    metadata: { ...fields, title, author: authors.map(a => a.family ? `${a.family}${a.given ? ', ' + a.given : ''}` : a.name).join(' and '), year: year ? String(year) : '', month: fields.month || '', journal: type === 'article' ? venue : '', booktitle: type === 'inproceedings' ? venue : '', publisher: text(work.publisher, 500), volume: text(work.volume, 100), number: text(work.issue, 100), pages: text(work.page, 500), articleno: text(work['article-number'], 100), doi },
    abstract,
    authorsTruncated: Array.isArray(work.author) && work.author.length > 100,
    source: 'Crossref',
    sourceUrl: `${API}/${encodeURIComponent(doi)}`,
  }
}

export function createLiteratureService({ canWrite, fetcher = fetch }) {
  async function request(url) {
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Overleaf-Paper-Assistant/0.1',
        },
      })
      if (!response.ok)
        throw new AgentError(
          response.status === 429 ? 429 : 502,
          response.status === 429
            ? 'Literature provider rate limit reached; retry later'
            : 'Literature provider request failed'
        )
      if (Number(response.headers.get('content-length')) > MAX_BYTES)
        throw new AgentError(502, 'Literature response exceeds size limit')
      const reader = response.body.getReader()
      const chunks = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > MAX_BYTES)
            throw new AgentError(502, 'Literature response exceeds size limit')
          chunks.push(Buffer.from(value))
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch (error) {
      if (error instanceof AgentError) throw error
      throw new AgentError(
        502,
        'Literature provider is unavailable or returned invalid metadata'
      )
    }
  }
  async function authorize(userId, projectId) {
    if (!(await canWrite(userId, projectId)))
      throw new AgentError(403, 'Project write access required')
  }
  async function fetchCitation(doi) {
    if (
      typeof doi !== 'string' ||
      doi.length > 256 ||
      !/^10\.\d{4,9}\/\S+$/i.test(doi)
    )
      throw new AgentError(400, 'A valid DOI is required')
    const data = await request(`${API}/${encodeURIComponent(doi)}`)
    const citation = citationFromWork(data?.message)
    if (!citation || citation.doi.toLowerCase() !== doi.toLowerCase())
      throw new AgentError(
        502,
        'Provider metadata does not match the requested DOI'
      )
    return citation
  }
  return {
    async search(userId, projectId, query) {
      await authorize(userId, projectId)
      if (typeof query !== 'string' || !query.trim() || query.length > 300)
        throw new AgentError(400, 'Search query must be 1–300 characters')
      const doi = query
        .trim()
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
        .replace(/^doi:\s*/i, '')
      if (/^10\.\d{4,9}\/\S+$/i.test(doi)) {
        return {
          query: query.trim(),
          source: 'Crossref',
          results: [await fetchCitation(doi)],
        }
      }
      const url = new URL(API)
      url.searchParams.set('query.bibliographic', query.trim())
      url.searchParams.set('rows', '10')
      const data = await request(url)
      if (!Array.isArray(data?.message?.items))
        throw new AgentError(
          502,
          'Literature provider returned invalid search results'
        )
      return {
        query: query.trim(),
        source: 'Crossref',
        results: data.message.items
          .slice(0, 10)
          .map(citationFromWork)
          .filter(Boolean),
      }
    },
    async lookup(userId, projectId, doi) {
      await authorize(userId, projectId)
      return await fetchCitation(doi)
    },
  }
}
