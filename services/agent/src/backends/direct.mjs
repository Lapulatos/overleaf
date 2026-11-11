// @ts-check
/**
 * Direct API adapter — calls Anthropic or OpenAI APIs directly.
 *
 * Supports custom endpoints (dmxapi relay, OpenAI-compatible proxies, etc.)
 * via --endpoint flag or ANTHROPIC_BASE_URL / OPENAI_BASE_URL env vars.
 *
 * This is the simplest end-to-end testable backend. Single API call,
 * no multi-step agent loop (that requires CLI backends).
 *
 * Usage:
 *   --backend direct --api-key sk-xxx --endpoint https://api.dmxapi.com/v1 --model claude-sonnet-4-6
 *   --backend direct --api-key sk-xxx --model gpt-4o
 */

import Anthropic from '@anthropic-ai/sdk'
import { parseResult } from './utils.mjs'
import { resolveDirectConfig } from './direct-config.mjs'

/** @type {import('./base.mjs').BackendAdapter} */
const directAdapter = {
  /**
   * Execute a single LLM API call.
   * @param {string} prompt
   * @param {import('./base.mjs').ExecuteOptions} opts
   * @returns {Promise<import('./base.mjs').BackendResult>}
   */
  async execute(prompt, opts) {
    const { apiKey, model, endpoint, provider } = resolveDirectConfig(opts)
    const isAnthropic = provider === 'anthropic'

    if (isAnthropic) {
      return await executeAnthropic(prompt, opts, apiKey, model, endpoint)
    }
    return await executeOpenAI(prompt, opts, apiKey, model, endpoint)
  },

  /**
   * Health check: verify API connectivity.
   * @returns {Promise<boolean>}
   */
  async healthCheck() { return checkDirectConnection({}) },

}

/**
 * Execute via Anthropic Messages API (or compatible relay like dmxapi).
 * @param {string} prompt
 * @param {import('./base.mjs').ExecuteOptions} opts
 * @param {string} apiKey
 * @param {string} model
 * @param {string} endpoint
 * @returns {Promise<import('./base.mjs').BackendResult>}
 */
async function executeAnthropic(prompt, opts, apiKey, model, endpoint) {
  const baseURL = endpoint
  const client = new Anthropic({ apiKey, baseURL, maxRetries: 0 })

  opts.onProgress(`[direct] Sending request to ${baseURL}...`)

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.1,
    system: 'You are an Overleaf Writing Assistant agent. Analyze the document and provide suggestions. If you suggest changes, output them as unified diff blocks.',
    messages: [{ role: 'user', content: prompt }],
  }, { signal: opts.signal, timeout: opts.timeout || 120000 })

  if (response.stop_reason !== 'end_turn') throw new Error('Anthropic response is incomplete')
  const text = response.content
    .filter(/** @param {any} block */ (block) => block.type === 'text')
    .map(/** @param {any} block */ (block) => block.text)
    .join('\n')

  opts.onProgress('[direct] Received response from Anthropic API')

  if (!text.trim()) throw new Error('Provider returned no text')
  return parseResult(text)
}

/**
 * Execute via OpenAI Chat Completions API (or compatible proxy).
 * @param {string} prompt
 * @param {import('./base.mjs').ExecuteOptions} opts
 * @param {string} apiKey
 * @param {string} model
 * @param {string} endpoint
 * @returns {Promise<import('./base.mjs').BackendResult>}
 */
async function executeOpenAI(prompt, opts, apiKey, model, endpoint) {
  const baseUrl = endpoint || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  opts.onProgress(`[direct] Sending request to ${baseUrl}...`)

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an Overleaf Writing Assistant agent. Analyze the document and provide suggestions. If you suggest changes, output them as unified diff blocks.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
    signal: AbortSignal.any([AbortSignal.timeout(opts.timeout || 120000), ...(opts.signal ? [opts.signal] : [])]),
  })

  if (!resp.ok) {
    await resp.body?.cancel()
    throw new Error(`OpenAI-compatible API error: ${resp.status}`)
  }

  const data = await resp.json()
  if (data?.choices?.[0]?.finish_reason !== 'stop') throw new Error('OpenAI-compatible response is incomplete')
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('Provider returned no text')

  opts.onProgress('[direct] Received response from OpenAI API')

  if (!text.trim()) throw new Error('Provider returned no text')
  return parseResult(text)
}

export async function checkDirectConnection(options) {
  try {
    const { provider, apiKey, endpoint } = resolveDirectConfig(options)
    const response = await fetch(`${endpoint}${provider === 'anthropic' ? '/v1' : ''}/models`, {
      headers: provider === 'anthropic'
        ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    await response.body?.cancel()
    return response.ok
  } catch { return false }
}

export default directAdapter
