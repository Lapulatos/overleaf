import { citationKey } from './WritingAssistCitationKey.mjs'
import { AgentError } from './WritingAssistAgentService.mjs'

const API = 'https://api.zotero.org'
const itemKeyPattern = /^[A-Z0-9]{8}$/
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
export function validateZoteroCredentials(credentials) {
  if (
    !credentials ||
    typeof credentials.libraryId !== 'string' ||
    !/^[1-9]\d{0,11}$/.test(credentials.libraryId) ||
    typeof credentials.apiKey !== 'string' ||
    !/^[A-Za-z0-9]{16,128}$/.test(credentials.apiKey)
  )
    throw new AgentError(
      400,
      'Enter a numeric Zotero user ID and a valid dedicated API key'
    )
  return { libraryId: credentials.libraryId, apiKey: credentials.apiKey }
}

export function citationFromZotero(item, libraryId) {
  const data = item?.data
  if (
    !data ||
    !itemKeyPattern.test(item.key || '') ||
    !/^[1-9]\d{0,11}$/.test(libraryId) ||
    ['attachment', 'note', 'annotation'].includes(data.itemType)
  )
    return null
  if (
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.length > 2000
  )
    return null
  const title = data.title.trim()
  const creators = Array.isArray(data.creators) ? data.creators : []
  const authors = creators
    .filter((c) => c?.creatorType === 'author')
    .slice(0, 100)
    .map((c) => ({
      family: text(c.lastName, 200),
      given: text(c.firstName, 200),
      name: text(c.name, 400),
    }))
    .filter((c) => c.family || c.name)
  const editors = creators
    .filter((c) => c?.creatorType === 'editor')
    .slice(0, 100)
  const yearMatch = text(data.date, 100).match(/\b([12]\d{3})\b/)
  const year = yearMatch ? Number(yearMatch[1]) : null
  const doi =
    typeof data.DOI === 'string' &&
    data.DOI.length <= 256 &&
    /^10\.\d{4,9}\/\S+$/i.test(data.DOI.trim())
      ? data.DOI.trim()
      : null
  const key = citationKey({ authors, year, title })
  const sourceId = `users/${libraryId}/items/${item.key}`
  const sourceUrl = `${API}/${sourceId}`
  const url = /^https?:\/\//i.test(text(data.url, 2000))
    ? text(data.url, 2000)
    : `https://www.zotero.org/${sourceId}`
  const types = {
    journalArticle: 'article',
    conferencePaper: 'inproceedings',
    book: 'book',
    bookSection: 'incollection',
    report: 'techreport',
  }
  const type = types[data.itemType] || 'misc'
  const venue = text(
    data.publicationTitle || data.proceedingsTitle || data.bookTitle,
    500
  )
  const fields = { title: `{${latex(title)}}` }
  const person = (author) =>
    author.family
      ? `${latex(author.family)}${author.given ? ', ' + latex(author.given) : ''}`
      : `{${latex(author.name)}}`
  if (authors.length) fields.author = authors.map(person).join(' and ')
  if (editors.length)
    fields.editor = editors
      .map((c) =>
        person({
          family: text(c.lastName, 200),
          given: text(c.firstName, 200),
          name: text(c.name, 400),
        })
      )
      .join(' and ')
  if (year) fields.year = String(year)
  if (venue && ['article', 'inproceedings', 'incollection'].includes(type))
    fields[type === 'article' ? 'journal' : 'booktitle'] = latex(venue)
  for (const [source, target] of [
    ['volume', 'volume'],
    ['issue', 'number'],
    ['pages', 'pages'],
    ['publisher', 'publisher'],
    ['place', 'address'],
    ['ISBN', 'isbn'],
    ['reportNumber', 'number'],
    ['institution', 'institution'],
  ]) {
    if (text(data[source], 500)) fields[target] = latex(text(data[source], 500))
  }
  if (doi) fields.doi = latex(doi)
  fields.url = latex(url)
  fields.zotero = sourceId
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
    source: 'Zotero',
    sourceId,
    sourceUrl,
    itemKey: item.key,
    authorsTruncated:
      creators.filter((c) => ['author', 'editor'].includes(c?.creatorType))
        .length > 100,
  }
}

export function createZoteroClient({ fetcher = fetch, timeoutMs = 30000 } = {}) {
  async function request(credentials, suffix, query) {
    const { libraryId, apiKey } = validateZoteroCredentials(credentials)
    const url = new URL(`${API}/users/${libraryId}/${suffix}`)
    for (const [key, value] of Object.entries(query || {}))
      url.searchParams.set(key, String(value))
    try {
      const signal = AbortSignal.timeout(timeoutMs)
      const options = {
        headers: {
          'Zotero-API-Version': '3',
          'Zotero-API-Key': apiKey,
          Accept: 'application/json',
        },
        signal,
        redirect: 'error',
      }
      let response
      for (let attempt = 0; attempt < 2; attempt++) {
        try { response = await fetcher(url, options); break }
        catch (error) {
          const retryable = error?.message === 'fetch failed' || ['UND_ERR_CONNECT_TIMEOUT', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error?.cause?.code)
          if (attempt || signal.aborted || !retryable) throw error
        }
      }
      if (!response.ok) {
        await response.body?.cancel()
        const status = [401, 403].includes(response.status)
          ? 401
          : response.status === 429
            ? 429
            : response.status === 404
              ? 404
              : 502
        throw new AgentError(
          status,
          status === 401
            ? 'Zotero rejected the key or library access; reconnect with library-read permission'
            : status === 429
              ? 'Zotero rate limit reached; retry later'
              : status === 404
                ? 'Zotero item or library was not found'
                : 'Zotero request failed'
        )
      }
      const reader = response.body.getReader()
      const chunks = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 2 * 1024 * 1024)
            throw new AgentError(502, 'Zotero response exceeds size limit')
          chunks.push(Buffer.from(value))
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
      catch { throw new AgentError(502, 'Zotero returned an invalid JSON response. Retry the search shortly.') }
    } catch (error) {
      if (error instanceof AgentError) throw error
      if (['TimeoutError', 'AbortError'].includes(error?.name) || error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
        throw new AgentError(504, 'Zotero search timed out. Retry the search; you do not need to reconnect your library.')
      }
      throw new AgentError(502, 'Could not reach Zotero. Check the server connection and retry the search.')
    }
  }
  return {
    async search(credentials, query = '', start = 0) {
      if (
        typeof query !== 'string' ||
        query.length > 300 ||
        !Number.isSafeInteger(start) ||
        start < 0 ||
        start > 100000
      )
        throw new AgentError(400, 'Invalid Zotero search or page')
      const items = await request(credentials, 'items/top', {
        q: query.trim(),
        qmode: 'titleCreatorYear',
        format: 'json',
        limit: 20,
        start,
      })
      if (!Array.isArray(items) || items.length > 20)
        throw new AgentError(502, 'Invalid Zotero item list')
      return {
        results: items
          .map((item) => citationFromZotero(item, credentials.libraryId))
          .filter(Boolean),
        nextStart: items.length === 20 ? start + 20 : null,
      }
    },
    async lookup(credentials, itemKey) {
      if (typeof itemKey !== 'string' || !itemKeyPattern.test(itemKey))
        throw new AgentError(400, 'Invalid Zotero item key')
      const item = await request(credentials, `items/${itemKey}`, {
        format: 'json',
      })
      const citation = citationFromZotero(item, credentials.libraryId)
      if (!citation || citation.itemKey !== itemKey)
        throw new AgentError(
          422,
          'Zotero item has unsupported or mismatched metadata'
        )
      return citation
    },
  }
}
