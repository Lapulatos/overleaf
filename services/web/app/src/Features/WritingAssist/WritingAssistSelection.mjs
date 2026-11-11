import { AgentError } from './WritingAssistAgentService.mjs'

export function resolveSourceSelection(documents, selection) {
  if (!selection) return undefined
  const doc = documents.find(doc => doc.id === selection.docId)
  const { from, to, text } = selection
  if (!doc || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) ||
      from < 0 || to <= from || to > doc.content.length || typeof text !== 'string' ||
      text.length > 16000 || doc.content.slice(from, to) !== text) {
    throw new AgentError(409, 'The selected text changed. Select it again before sending.')
  }
  return { docId: doc.id, path: doc.path, version: doc.version, from, to, text,
    startLine: doc.content.slice(0, from).split('\n').length,
    endLine: doc.content.slice(0, to - 1).split('\n').length }
}
