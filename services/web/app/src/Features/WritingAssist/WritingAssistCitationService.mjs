import { uniqueCitationKey } from './WritingAssistCitationKey.mjs'
import { randomUUID } from 'node:crypto'
import { AgentError } from './WritingAssistAgentService.mjs'
import { assertWorkspaceIdentity } from './WritingAssistWorkspaceIdentity.mjs'

const newFileName = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}\.bib$/
export function assertCitationAbsent(documents, citation) {
  for (const doc of documents.filter((doc) => /\.bib$/i.test(doc.path))) {
    const keys = [
      ...doc.content.matchAll(/@\w+\s*[{(]\s*([^\s,{}()]+)\s*,/g),
    ].map((match) => match[1])
    if (keys.includes(citation.key))
      throw new AgentError(
        409,
        `Citation key ${citation.key} already occurs in ${doc.path}`
      )
    const normalized = doc.content.replace(/\\([_&#%])/g, '$1').toLowerCase()
    // Conservatively retain a DOI found in either a DOI field or a resolver URL.
    // This also avoids silently duplicating an entry whose key was renamed.
    if (
      citation.doi &&
      new RegExp(
        citation.doi.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '(?=[\\s}\\)"\',?]|$)'
      ).test(normalized)
    )
      throw new AgentError(409, `This DOI already occurs in ${doc.path}`)
    if (
      citation.sourceId &&
      normalized.includes(citation.sourceId.toLowerCase())
    )
      throw new AgentError(
        409,
        `This library item already occurs in ${doc.path}`
      )
  }
}
export function createCitationService({
  canWrite,
  literature,
  snapshot,
  store,
  tasks,
  readWorkspaceIdentity = async () => null,
}) {
  async function authorize(userId, projectId) {
    if (!(await canWrite(userId, projectId)))
      throw new AgentError(403, 'Project write access required')
  }
  return {
    async destinations(userId, projectId) {
      await authorize(userId, projectId)
      return (await snapshot(projectId))
        .filter((doc) => /\.bib$/i.test(doc.path))
        .map(({ id, path }) => ({ id, path }))
    },
    async preview(userId, projectId, doi, destination, { importNotes = [] } = {}) {
      await authorize(userId, projectId)
      if (
        !destination ||
        Boolean(destination.docId) === Boolean(destination.newName)
      )
        throw new AgentError(
          400,
          'Choose an existing bibliography or a new filename'
        )
      if (destination.newName && !newFileName.test(destination.newName))
        throw new AgentError(
          400,
          'Use a root-level filename such as references.bib'
        )
      const batch = Array.isArray(doi)
      const identifiers = batch ? doi : [doi]
      if (!identifiers.length || identifiers.length > 50)
        throw new AgentError(400, 'Select between 1 and 50 references')
      const fetched = []
      // Bound provider concurrency; never store a partial preview on failure.
      for (let offset = 0; offset < identifiers.length; offset += 5) {
        fetched.push(...await Promise.all(identifiers.slice(offset, offset + 5)
          .map(id => literature.lookup(userId, projectId, id))))
      }
      const workspaceIdentity = await readWorkspaceIdentity(projectId)
      const documents = await snapshot(projectId)
      const citations = []
      const skipped = []
      for (const original of fetched) {
        const occupied = new Set([...documents, { content: citations.map(item => item.bibtex).join('\n') }]
          .flatMap(doc => [...doc.content.matchAll(/@\w+\s*[{(]\s*([^\s,{}()]+)\s*,/g)].map(match => match[1])))
        const key = uniqueCitationKey(original.key, occupied)
        const citation = { ...original, key, bibtex: original.bibtex.replace(/^(@\w+\s*[{(]\s*)[^\s,{}()]+/, (_, prefix) => prefix + key) }
        if (citation.authorsTruncated)
          throw new AgentError(422, 'The author list exceeds automatic import limits; review the full source metadata')
        try {
          assertCitationAbsent([...documents, { path: 'selected.bib', content: citations.map(item => item.bibtex).join('\n') }], citation)
        } catch (error) {
          if (!batch || !(error instanceof AgentError) || error.status !== 409) throw error
          skipped.push({ key: citation.key, title: citation.title, reason: error.message })
          continue
        }
        citations.push(citation)
      }
      if (!citations.length) throw new AgentError(409, 'All selected references already exist in the project or selection. No changes were prepared.')
      const citation = citations[0]
      const doc = destination.docId
        ? documents.find(
            (doc) => doc.id === destination.docId && /\.bib$/i.test(doc.path)
          )
        : null
      if (destination.docId && !doc)
        throw new AgentError(404, 'Bibliography document not found')
      if (
        destination.newName &&
        documents.some((doc) => doc.path === destination.newName)
      )
        throw new AgentError(409, 'A document with this name already exists')
      const before = doc?.content || ''
      const after =
        before +
        (before && !before.endsWith('\n') ? '\n' : '') +
        (before ? '\n' : '') +
        citations.map(item => item.bibtex).join('\n')
      if (after.length > 500000)
        throw new AgentError(
          422,
          'Bibliography exceeds the supported size limit'
        )
      const taskId = randomUUID()
      const proposal = {
        id: randomUUID(),
        path: doc?.path || destination.newName,
        before,
        after,
        status: 'pending',
        ...(batch ? { citations: citations.map(item => ({ doi: item.doi, key: item.key,
          ...(item.sourceId ? { sourceId: item.sourceId } : {}) })) } : { citation: {
          doi: citation.doi, key: citation.key,
          ...(citation.sourceId ? { sourceId: citation.sourceId } : {}),
        } }),
        ...(doc
          ? { docId: doc.id, version: doc.version }
          : { mode: 'create-bibliography' }),
      }
      await authorize(userId, projectId)
      assertWorkspaceIdentity(workspaceIdentity, await readWorkspaceIdentity(projectId))
      await store.create({
        id: taskId,
        workspaceIdentity,
        userId,
        projectId,
        instruction: batch ? `Import ${citations.length} references` : `Import citation ${citation.doi || citation.sourceId || citation.key}`,
        status: 'completed',
        summary: (importNotes.length ? importNotes.join('\n') + '\n\n' : '') + citations.map(item => `Source: ${item.source}\n${item.title}\n${item.url}\nCitation key: ${item.key}`).join('\n\n') + (skipped.length ? `\n\nSkipped ${skipped.length} duplicate reference(s):\n${skipped.map(item => item.title).join('\n')}` : '') + '\nReview the bibliography change before applying it.',
        documents: doc ? [doc] : [],
        proposals: [proposal],
        createdAt: new Date(),
      })
      return { citation, citations, skipped, task: await tasks.get(userId, projectId, taskId) }
    },
  }
}
