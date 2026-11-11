// @ts-check
/**
 * Backend adapter factory — creates the appropriate backend based on config.
 *
 * Supported backends:
 *   - 'direct':    Direct API call to Anthropic/OpenAI (single-shot, no agent loop)
 *   - 'claude-code': Claude Code CLI (multi-step autonomous agent)
 *   - 'codex':     Codex CLI (OpenAI's agent)
 *   - 'aider':     Aider CLI (multi-provider coding assistant)
 */

import directAdapter, { checkDirectConnection } from './direct.mjs'
import claudeCodeAdapter from './claude-code.mjs'
import codexAdapter from './codex.mjs'
import aiderAdapter from './aider.mjs'

/**
 * @typedef {import('./base.mjs').BackendAdapter} BackendAdapter
 */

const BACKEND_MAP = /** @type {Record<string, BackendAdapter>} */ ({
  direct: directAdapter,
  'claude-code': claudeCodeAdapter,
  codex: codexAdapter,
  aider: aiderAdapter,
})

/**
 * Create a backend adapter from config.
 * @param {import('../types.mjs').AgentConfig} config
 * @returns {BackendAdapter}
 */
export function createBackendAdapter(config) {
  const name = config.backend || 'direct'
  const adapter = BACKEND_MAP[name]

  if (!adapter) {
    throw new Error(
      `Unknown backend: '${name}'. Supported: ${Object.keys(BACKEND_MAP).join(', ')}`
    )
  }

  if (name === 'direct') return {
    execute: (prompt, opts) => adapter.execute(prompt, { ...config, ...opts }),
    healthCheck: () => checkDirectConnection(config),
  }
  return adapter
}

export { BACKEND_MAP }