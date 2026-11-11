import { parseBibliography, readableBibText } from './WritingAssistBibTeX.mjs'

const supported = new Set(['title', 'author', 'year', 'month', 'isbn', 'issn',
  'publisher', 'address', 'url', 'doi', 'abstract', 'booktitle', 'journal',
  'pages', 'numpages', 'keywords', 'location', 'series', 'volume', 'number', 'articleno'])
const equivalent = value => readableBibText(value).normalize('NFKC').replace(/[–—]/g, '-').replace(/--/g, '-').replace(/\s+/g, ' ').toLowerCase()

// Only source-supplied literal values are eligible. Unknown original fields,
// macros and citation keys are preserved; no model-generated facts are applied.
export function completeEntry(entry, citation) {
  const source = parseBibliography(citation.bibtex).entries[0]
  const changes = []
  if (!source || citation.authorsTruncated) return { raw: entry.raw, changes }
  for (const [field, value] of Object.entries(source.fields)) {
    if (!supported.has(field) || !value || source.unresolved.includes(field) || entry.unresolved.includes(field)) continue
    if (equivalent(entry.fields[field] || '') === equivalent(value)) continue
    if (field === 'publisher' && value === 'ACM' && /Association for Computing Machinery/i.test(entry.fields[field] || '')) continue
    // Abstracts and topic keywords can differ legitimately between providers.
    if (['abstract', 'keywords'].includes(field) && entry.fields[field]) continue
    if (field === 'url' && entry.fields.url && !citation.urlVerifiedCorrection) continue
    changes.push({ field, before: entry.fields[field] || '', after: value })
  }
  return { raw: applyReferenceFields(entry, changes), changes }
}

export function applyReferenceFields(entry, changes) {
  const edits = []
  const additions = []
  for (const {field, after: value} of changes) {
    const span = entry.spans[field]
    if (span) edits.push({ ...span, value: `{${value}}` })
    else additions.push(`  ${field} = {${value}}`)
  }
  let raw = entry.raw
  for (const edit of edits.sort((a, b) => b.start - a.start)) raw = raw.slice(0, edit.start) + edit.value + raw.slice(edit.end)
  if (additions.length) {
    const prefix = raw.slice(0, -1).trimEnd()
    raw = prefix + (prefix.endsWith(',') ? '' : ',') + '\n' + additions.join(',\n') + '\n' + raw.at(-1)
  }
  // Reparse before creating a proposal: malformed source cannot reach the writer.
  parseBibliography(raw)
  return raw
}
