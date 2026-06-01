// @ts-check

import WritingAssistLLMProvider from './WritingAssistLLMProvider.mjs'
import WritingAssistEncryption from './WritingAssistEncryption.mjs'
import { callbackify } from 'node:util'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'

const MAX_TEXT_LENGTH = settings.writingAssist?.maxTextLength ?? 4000
const DEFAULT_TIMEOUT = settings.writingAssist?.timeout ?? 20000
const RETRY_ATTEMPTS = settings.writingAssist?.retryAttempts ?? 0
const ENCRYPTION_KEY = settings.writingAssist?.encryptionKey ?? 'dev-key-change-me'

const VALID_CATEGORIES = new Set([
  'correctness', 'clarity', 'conciseness', 'delivery', 'engagement',
])

// The LLM is a language model, not a character counter: asking it for numeric
// character offsets produces wrong positions (off-by-one, drift on long/LaTeX
// text). Instead we ask it to quote the exact problematic text and its fix, and
// we compute positions deterministically by string-searching the original text.
const SYSTEM_PROMPT = `You are an academic-paper writing checker for LaTeX documents.
Analyze the provided English prose and return structured JSON.

The text may contain LaTeX commands, math, and environments. NEVER flag or
change LaTeX syntax, commands (\\command), math ($...$, \\[...\\]), citation
keys, labels, or BibTeX. Only check natural-language prose.

Classify each issue into exactly ONE of these categories:

- correctness: grammar, spelling, verb tense, subject-verb agreement, AND
  punctuation/mechanics. MUST fix. Actively flag mechanical errors, not just
  word choice:
    * missing or wrong punctuation: missing comma after an introductory phrase
      ("However we" → "However, we"), missing terminal period, comma splice,
      wrong dash/hyphen usage;
    * spacing: a space before a punctuation mark ("result ." → "result."),
      a missing space after a comma/period ("fast,efficient" → "fast, efficient"),
      doubled spaces ("a  b" → "a b");
    * capitalization: a lowercase letter starting a sentence.
- clarity: hard to follow — too long, tangled clauses, passive overuse. SHOULD fix.
- conciseness: wordiness/filler — "due to the fact that"→"because", "in order to"→"to". SHOULD fix.
- delivery: tone mismatch — too blunt/casual/aggressive for academic writing. OPTIONAL.
- engagement: flat expression — "good"→"promising". Flag gently.

Treat punctuation and spacing mistakes with the SAME priority as grammar: if a
sentence reads correctly but has a misplaced comma, a missing space, or a space
before a period, still report it as a correctness issue.

Return ONLY a JSON object — no markdown, no code fence, no explanation:

{"issues":[{"original":"…","corrected":"…","message":"…","category":"…"},…]}

For each issue:
- original: copy the EXACT problematic span verbatim from the input text,
  character-for-character (including its original spacing/punctuation). It MUST
  appear verbatim in the input so it can be located. Quote the smallest span
  that still contains the whole problem; it may cross several words. For a
  punctuation or spacing fix, include the adjacent word(s) so the span is
  unique and locatable — e.g. quote "However we" (not just " "), or "result ."
  (the word plus the offending space and mark), never an empty or whitespace-
  only string.
- corrected: the full replacement text for that exact span.
- message: one short sentence, in Chinese, explaining the problem.
- category: one of the five category strings above.

If there are no issues, return {"issues":[]}.`

/**
 * Run a writing check.
 *
 * @param {{ text: string, enabledCategories: string[], provider: string, providerConfig: { apiKey: string, model: string, endpoint?: string, timeout?: number } }} params
 * @returns {Promise<Array<{ offset: number, length: number, suggestion: string, message: string, category: string }>>}
 */
async function check(params) {
  const { text, enabledCategories, provider, providerConfig } = params

  if (!text || text.trim().length === 0) return []
  if (!providerConfig.apiKey) {
    throw Object.assign(new Error('API key not configured'), { statusCode: 400 })
  }

  const validCategories = enabledCategories.filter(
    /** @param {string} c */ c => VALID_CATEGORIES.has(c)
  )
  if (validCategories.length === 0) return []

  const truncated = text.length > MAX_TEXT_LENGTH
    ? text.slice(0, MAX_TEXT_LENGTH)
    : text

  const apiKey = providerConfig.apiKey.startsWith('enc:')
    ? WritingAssistEncryption.decrypt(providerConfig.apiKey.slice(4), ENCRYPTION_KEY)
    : providerConfig.apiKey

  let lastError = null
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const rawResponse = await WritingAssistLLMProvider.check(
        { provider, apiKey, model: providerConfig.model, endpoint: providerConfig.endpoint, timeout: providerConfig.timeout ?? DEFAULT_TIMEOUT },
        truncated,
        SYSTEM_PROMPT,
        validCategories
      )

      return parseAndLocate(rawResponse, truncated)
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

/**
 * Parse the LLM JSON and turn each {original, corrected} pair into a positioned
 * issue by locating `original` in the source text. Positions are computed here,
 * deterministically, so they are always correct regardless of what the LLM
 * thinks the offsets are.
 *
 * @param {string} raw   raw LLM response
 * @param {string} text  the exact text that was sent to the LLM
 */
function parseAndLocate(raw, text) {
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

  // Track a search cursor per distinct `original` string so repeated phrases
  // map to successive occurrences instead of all collapsing onto the first.
  /** @type {Map<string, number>} */
  const searchFrom = new Map()
  const issues = []

  for (const i of parsed.issues) {
    if (!i || typeof i.original !== 'string' || typeof i.corrected !== 'string') continue
    if (!VALID_CATEGORIES.has(i.category)) continue
    if (i.original.length === 0) continue
    if (i.original === i.corrected) continue

    const from = searchFrom.get(i.original) ?? 0
    const idx = text.indexOf(i.original, from)
    if (idx === -1) {
      // LLM quoted something not present verbatim — skip rather than mis-place.
      logger.debug({ original: i.original.slice(0, 40) }, 'WritingAssist: original not found, skipping')
      continue
    }
    searchFrom.set(i.original, idx + i.original.length)

    // Trim the common prefix/suffix between original and corrected so the
    // highlighted span is just the part that actually changes.
    const trimmed = trimToDiff(i.original, i.corrected)

    issues.push({
      offset: idx + trimmed.prefix,
      length: trimmed.origCore.length,
      suggestion: trimmed.corrCore,
      message: typeof i.message === 'string' ? i.message : '',
      category: i.category,
    })
  }

  return issues.sort((a, b) => a.offset - b.offset)
}

/**
 * Strip the shared leading/trailing characters of two strings so only the
 * differing core remains. "I is" / "I am" → prefix 2 ("I "), origCore "is",
 * corrCore "am". This keeps the strikethrough on just the changed words.
 *
 * Pure insertions (original is a substring of corrected) leave origCore empty;
 * those are anchored on the adjacent word so the highlight stays minimal
 * instead of covering the whole sentence. See the origCore.length === 0 branch.
 *
 * @param {string} original
 * @param {string} corrected
 * @returns {{ prefix: number, origCore: string, corrCore: string }}
 */
function trimToDiff(original, corrected) {
  let start = 0
  const maxStart = Math.min(original.length, corrected.length)
  while (
    start < maxStart &&
    original[start] === corrected[start]
  ) {
    start++
  }

  let endO = original.length
  let endC = corrected.length
  while (
    endO > start &&
    endC > start &&
    original[endO - 1] === corrected[endC - 1]
  ) {
    endO--
    endC--
  }

  // Don't split in the middle of a word: back the prefix up to the last
  // whitespace boundary so we never strike "s" out of "is".
  let prefix = start
  while (prefix > 0 && /\S/.test(original[prefix - 1]) && /\S/.test(original[prefix])) {
    prefix--
  }
  // Likewise extend the core to a trailing word boundary.
  while (endO < original.length && /\S/.test(original[endO - 1]) && /\S/.test(original[endO])) {
    endO++
  }

  const origCore = original.slice(prefix, endO)
  const corrCore = corrected.slice(prefix, corrected.length - (original.length - endO))

  // Pure insertion: the corrected text only ADDS characters, so origCore is
  // empty. How we anchor depends on WHAT is inserted:
  //  - inserted text starting with punctuation (e.g. "However" → "However,"):
  //    attach to the PRECEDING word so the punctuation sits against it
  //    ("However" → "However,"), not floating before the next word.
  //  - otherwise (e.g. "but still…" → "but it still…" adds a word): anchor on
  //    the word that FOLLOWS the insertion point ("still" → "it still").
  if (origCore.length === 0) {
    const insertedText = corrected.slice(start, endC)
    const startsWithPunct = /^[\s]*[,.;:!?)\]}'"]/.test(insertedText)

    if (startsWithPunct) {
      const back = anchorWordBefore(original, prefix)
      if (back) {
        return {
          prefix: back.from,
          origCore: original.slice(back.from, back.to),
          corrCore: original.slice(back.from, back.to) + insertedText,
        }
      }
    }

    const anchor = anchorWordAt(original, prefix)
    if (anchor) {
      return {
        prefix: anchor.from,
        origCore: original.slice(anchor.from, anchor.to),
        corrCore: corrCore + original.slice(anchor.from, anchor.to),
      }
    }
    // No word after the insertion point (insertion at end): anchor on the word
    // before it instead.
    const back = anchorWordBefore(original, prefix)
    if (back) {
      return {
        prefix: back.from,
        origCore: original.slice(back.from, back.to),
        corrCore: original.slice(back.from, back.to) + corrCore,
      }
    }
    // Degenerate fallback — mark the whole span.
    return { prefix: 0, origCore: original, corrCore: corrected }
  }
  return { prefix, origCore, corrCore }
}

/**
 * Return the [from, to) span of the word starting at or after `pos` in `text`,
 * or null if there is no non-whitespace word from `pos` onward.
 *
 * @param {string} text
 * @param {number} pos
 * @returns {{ from: number, to: number } | null}
 */
function anchorWordAt(text, pos) {
  let from = pos
  while (from < text.length && /\s/.test(text[from])) from++
  if (from >= text.length) return null
  let to = from
  while (to < text.length && /\S/.test(text[to])) to++
  return { from, to }
}

/**
 * Return the [from, to) span of the word ending at or before `pos` in `text`,
 * or null if there is no non-whitespace word before `pos`.
 *
 * @param {string} text
 * @param {number} pos
 * @returns {{ from: number, to: number } | null}
 */
function anchorWordBefore(text, pos) {
  let to = pos
  while (to > 0 && /\s/.test(text[to - 1])) to--
  if (to <= 0) return null
  let from = to
  while (from > 0 && /\S/.test(text[from - 1])) from--
  return { from, to }
}

const WritingAssistManager = {
  check: callbackify(check),
  promises: { check },
}

export default WritingAssistManager
