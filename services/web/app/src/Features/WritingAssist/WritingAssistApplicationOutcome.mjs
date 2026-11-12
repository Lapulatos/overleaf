import { createHash } from 'node:crypto'
import { AgentError } from './WritingAssistErrors.mjs'

// Server-created continuation metadata only; never accept arbitrary task fields.
export function applicationOutcomeFields(task, proposal) {
  const outcome = task.applicationOutcome
  if (outcome == null) return {}
  const fields = outcome.fields
  const keys = fields && Object.keys(fields).sort().join(',')
  const reference = keys === 'referenceReview,summary' && fields.referenceReview && typeof fields.referenceReview === 'object'
  const claim = keys === 'claimInput,claimReview,summary' && fields.claimInput && fields.claimReview && typeof fields.claimInput === 'object' && typeof fields.claimReview === 'object'
  if (outcome.proposalId !== proposal.id || outcome.afterHash !== createHash('sha256').update(proposal.after).digest('hex') ||
      (!reference && !claim) || typeof fields.summary !== 'string') {
    throw new AgentError(409, 'Stored workflow outcome does not match this application. Retain the task for inspection.')
  }
  return structuredClone(fields)
}
