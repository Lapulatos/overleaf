// @ts-check

import WritingAssistLLMProvider from './WritingAssistLLMProvider.mjs'
import WritingAssistEncryption from './WritingAssistEncryption.mjs'
import WritingAssistLaTeXMasker from './WritingAssistLaTeXMasker.mjs'
import WritingAssistTransformPromptBuilder from './WritingAssistTransformPromptBuilder.mjs'
import { callbackify } from 'node:util'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'

const MAX_TEXT_LENGTH = settings.writingAssist?.transformMaxTextLength ?? 8000
const DEFAULT_TIMEOUT = settings.writingAssist?.transformTimeout ?? 30000
const RETRY_ATTEMPTS = settings.writingAssist?.retryAttempts ?? 0
const ENCRYPTION_KEY = settings.writingAssist?.encryptionKey ?? 'dev-key-change-me'

/**
 * Run a text transform.
 *
 * @param {{ text: string, action: string, targetLanguage?: string, customInstruction?: string, lengthRatio?: number, provider: string, providerConfig: { apiKey: string, model: string, endpoint?: string, timeout?: number } }} params
 * @returns {Promise<{ result: string }>}
 */
async function transform(params) {
  const { text, action, targetLanguage, customInstruction, lengthRatio, rewriteFidelity, provider, providerConfig } = params

  if (!text || text.trim().length === 0) {
    throw Object.assign(new Error('Empty text'), { statusCode: 400 })
  }

  if (!providerConfig.apiKey) {
    throw Object.assign(new Error('API key not configured'), { statusCode: 400 })
  }

  if (!WritingAssistTransformPromptBuilder.VALID_ACTIONS.includes(action)) {
    throw Object.assign(new Error(`Unknown action: ${action}`), { statusCode: 400 })
  }

  // Validate language for translate action
  if (action === 'translate' && !targetLanguage) {
    throw Object.assign(new Error('targetLanguage required for translate action'), { statusCode: 400 })
  }

  // Validate instruction for custom action
  if (action === 'custom' && !customInstruction) {
    throw Object.assign(new Error('customInstruction required for custom action'), { statusCode: 400 })
  }

  const truncated = text.length > MAX_TEXT_LENGTH
    ? text.slice(0, MAX_TEXT_LENGTH)
    : text

  // Mask LaTeX — keep tokens so we can unmask the LLM response
  const { maskedText, tokens } = WritingAssistLaTeXMasker.mask(truncated)

  const apiKey = providerConfig.apiKey.startsWith('enc:')
    ? WritingAssistEncryption.decrypt(providerConfig.apiKey.slice(4), ENCRYPTION_KEY)
    : providerConfig.apiKey

  // Build prompts — pass original text for accurate length calculation
  const { systemPrompt, userMessage } = WritingAssistTransformPromptBuilder.buildTransformPrompt({
    action, targetLanguage, customInstruction, maskedText, lengthRatio, rewriteFidelity, originalText: truncated,
  })

  let lastError = null
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const rawResponse = await WritingAssistLLMProvider.check(
        { provider, apiKey, model: providerConfig.model, endpoint: providerConfig.endpoint, timeout: providerConfig.timeout ?? DEFAULT_TIMEOUT },
        truncated,
        systemPrompt,
        [], // enabledCategories not needed for transform
        userMessage // custom user message override
      )

      // Parse JSON response, then unmask LaTeX tokens (⟨CITE⟩ → \cite{...})
      const parsed = parseResult(rawResponse)
      parsed.result = WritingAssistLaTeXMasker.unmask(parsed.result, tokens)
      return parsed
    } catch (err) {
      lastError = err
      if (attempt < RETRY_ATTEMPTS) {
        logger.warn({ err, attempt }, 'WritingAssist transform: LLM call failed, retrying')
      }
    }
  }

  logger.error({ err: lastError }, 'WritingAssist transform: all retries exhausted')
  throw lastError
}

/**
 * Parse the LLM JSON response for a transform.
 *
 * @param {string} raw - raw LLM response
 * @returns {{ result: string }}
 */
function parseResult(raw) {
  let parsed
  try {
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
    }
    parsed = JSON.parse(cleaned)
  } catch (e) {
    logger.warn({ raw: raw.slice(0, 200) }, 'WritingAssist transform: failed to parse LLM JSON')
    throw Object.assign(new Error('Failed to parse transform response'), { statusCode: 500 })
  }

  if (typeof parsed?.result !== 'string') {
    logger.warn({ parsed }, 'WritingAssist transform: response missing result string')
    throw Object.assign(new Error('Invalid transform response format'), { statusCode: 500 })
  }

  return { result: parsed.result }
}

const WritingAssistTransformManager = {
  transform: callbackify(transform),
  promises: { transform },
}

export default WritingAssistTransformManager