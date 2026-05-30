// @ts-check

import WritingAssistLLMProvider from './WritingAssistLLMProvider.mjs'
import WritingAssistEncryption from './WritingAssistEncryption.mjs'
import WritingAssistLaTeXMasker from './WritingAssistLaTeXMasker.mjs'
import { callbackify } from 'node:util'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { InvalidParamsError } from '../../infrastructure/Validation.mjs'

const MAX_TEXT_LENGTH = settings.writingAssist?.maxTextLength ?? 4000
const TIMEOUT = settings.writingAssist?.timeout ?? 10000
const RETRY_ATTEMPTS = settings.writingAssist?.retryAttempts ?? 1
const ENCRYPTION_KEY = settings.writingAssist?.encryptionKey ?? 'dev-key-change-me'

const VALID_CATEGORIES = new Set([
  'correctness', 'clarity', 'conciseness', 'delivery', 'engagement',
])

const SYSTEM_PROMPT = `You are an academic-paper writing checker for LaTeX documents.
Analyze the provided English prose and return structured JSON.

The text has already had LaTeX commands and math content stripped.
Do NOT suggest changes to LaTeX syntax, citation keys, or BibTeX.

Classify each issue into exactly ONE of these categories:

- correctness: grammar error, spelling mistake, punctuation error,
  tense error, subject-verb disagreement. MUST be fixed.

- clarity: sentence is hard to follow — too long, too many embedded
  clauses, passive voice overuse, tangled modifiers. SHOULD be fixed
  for readability.

- conciseness: wordiness or filler — "due to the fact that"→"because",
  "it is important to note that"→delete, "in order to"→"to".
  SHOULD be fixed to tighten prose.

- delivery: tone mismatch — too blunt/harsh for reviewer response,
  too casual for academic, too aggressive for rebuttal.
  OPTIONAL; polite alternatives only.

- engagement: expression feels flat — "good"→"promising",
  "works"→"achieves".  In academic writing this can sound
  marketese; flag but don't push.

Return ONLY a JSON object — no markdown, no explanation, no code fence:

{"issues":[{"offset":N,"length":N,"message":"…","suggestion":"…","category":"…"},…]}

For each issue:
- offset: 0-based character position in the input text
- length: number of characters in the problematic span
- message: one-sentence description of the problem and why it matters (use Chinese)
- suggestion: the exact replacement text
- category: one of the five category strings above`

/**
 * Run a writing check.
 */
async function check(params) {
  const { text, enabledCategories, provider, providerConfig } = params

  if (!text || text.trim().length === 0) return []
  if (!providerConfig.apiKey) {
    throw new InvalidParamsError('API key not configured')
  }

  const validCategories = enabledCategories.filter(c => VALID_CATEGORIES.has(c))
  if (validCategories.length === 0) return []

  const truncated = text.length > MAX_TEXT_LENGTH
    ? text.slice(0, MAX_TEXT_LENGTH)
    : text

  const { maskedText, remap } = WritingAssistLaTeXMasker.mask(truncated)

  if (maskedText.trim().length === 0) return []

  const apiKey = providerConfig.apiKey.startsWith('enc:')
    ? WritingAssistEncryption.decrypt(providerConfig.apiKey.slice(4), ENCRYPTION_KEY)
    : providerConfig.apiKey

  let lastError = null
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const rawResponse = await WritingAssistLLMProvider.check(
        { provider, apiKey, model: providerConfig.model, endpoint: providerConfig.endpoint, timeout: TIMEOUT },
        maskedText,
        SYSTEM_PROMPT,
        validCategories
      )

      return parseAndValidateResponse(rawResponse, maskedText.length, remap)
    } catch (err) {
      lastError = err
      if (attempt < RETRY_ATTEMPTS) {
        logger.warn({ err, attempt }, 'WritingAssist: LLM call failed, retrying')
      }
    }
  }

  logger.error({ err: lastError }, 'WritingAssist: all retries exhausted')
  throw lastError
}

function parseAndValidateResponse(raw, textLength, remap) {
  let parsed
  try {
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
    }
    parsed = JSON.parse(cleaned)
  } catch (e) {
    logger.warn({ raw: raw.slice(0, 200) }, 'WritingAssist: failed to parse LLM JSON')
    return []
  }

  if (!Array.isArray(parsed?.issues)) {
    logger.warn({ parsed }, 'WritingAssist: response missing issues array')
    return []
  }

  return parsed.issues
    .filter(i =>
      typeof i.offset === 'number' &&
      typeof i.length === 'number' &&
      i.offset >= 0 &&
      i.offset + i.length <= textLength &&
      VALID_CATEGORIES.has(i.category) &&
      typeof i.suggestion === 'string' &&
      i.suggestion.length > 0
    )
    .map(i => ({
      offset: remap(i.offset),
      length: i.length,
      message: typeof i.message === 'string' ? i.message : '',
      suggestion: i.suggestion,
      category: i.category,
    }))
    .sort((a, b) => a.offset - b.offset)
}

const WritingAssistManager = {
  check: callbackify(check),
  promises: { check },
}

export default WritingAssistManager
