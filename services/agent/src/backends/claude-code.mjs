// @ts-check
/**
 * Claude Code CLI adapter — executes multi-step agent tasks via Claude Code CLI.
 *
 * Claude Code runs as an autonomous agent that can read/write files,
 * run shell commands, search code, and iterate across multiple turns.
 *
 * Key CLI flags (non-interactive mode):
 *   claude --print [--model sonnet] [--max-budget-usd 0.5] "prompt"
 *   --print: non-interactive, output text to stdout then exit
 *   --max-budget-usd: cost cap to prevent runaway spending
 *   --permission-mode plan: suggests changes without auto-applying
 *
 * Auth: Claude Code uses ANTHROPIC_API_KEY from env or its own OAuth login.
 * For dmxapi relay, set ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY in env.
 * NOTE: For dmxapi, use ANTHROPIC_AUTH_TOKEN as ANTHROPIC_API_KEY — the
 * ANTHROPIC_API_KEY env var from .zprofile is a different (invalid) key.
 */

import { spawn } from 'node:child_process'
import { parseResult, spawnAsync, bindCancellation } from './utils.mjs'

/** @type {import('./base.mjs').BackendAdapter} */
const claudeCodeAdapter = {
  /**
   * @param {string} prompt
   * @param {import('./base.mjs').ExecuteOptions} opts
   * @returns {Promise<import('./base.mjs').BackendResult>}
   */
  async execute(prompt, opts) {
    opts.onProgress('[claude-code] Starting Claude Code agent...')

    const result = await runClaudeCode(prompt, opts)

    opts.onProgress('[claude-code] Claude Code agent completed')
    return result
  },

  /**
   * Health check: verify `claude` CLI is on PATH and authenticated.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const result = await spawnAsync('claude', ['--version'], 5000)
      return result.length > 0
    } catch {
      return false
    }
  },
}

/**
 * Run Claude Code in non-interactive print mode.
 * Uses text output mode (--print without --output-format) for simplicity.
 * stream-json mode requires --verbose and outputs too much noise (hook system, skills).
 *
 * @param {string} prompt
 * @param {import('./base.mjs').ExecuteOptions} opts
 * @returns {Promise<import('./base.mjs').BackendResult>}
 */
function runClaudeCode(prompt, opts) {
  return new Promise((resolve, reject) => {
    const model = opts.model || 'claude-sonnet-4-6'

    const args = [
      '--print',                       // non-interactive mode (text output)
      '--model', model,
      '--permission-mode', 'plan',     // suggest changes, don't auto-apply
      '--bare',                        // skip hooks, skills, CLAUDE.md — clean output
    ]

    // Cost cap
    const budget = opts.maxBudgetUsd || 1.0
    args.push('--max-budget-usd', String(budget))

    // Pass prompt as CLI argument (stdin piping triggers "Reading from stdin" noise)
    args.push(prompt)

    const proc = spawn('claude', args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // For dmxapi relay: override ANTHROPIC_API_KEY with the correct dmxapi key
        // ANTHROPIC_AUTH_TOKEN (sk-hlMB3...) works with dmxapi; ANTHROPIC_API_KEY (sk-dYo2a...) doesn't
        ANTHROPIC_API_KEY: opts.apiKey || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_BASE_URL: opts.endpoint || process.env.ANTHROPIC_BASE_URL,
        // Outbound proxy comes from env only — common cases:
        //   - dmxapi relay over a local proxy: export ALL_PROXY=http://127.0.0.1:7897
        //   - corporate proxy: export HTTPS_PROXY=...
        // No hardcoded fallback so users without a proxy can still call upstream.
        all_proxy: process.env.all_proxy || process.env.ALL_PROXY || '',
        HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    bindCancellation(proc, opts.signal)
    proc.stdin.on('error', () => {})

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      // Report progress chunks
      opts.onProgress(text.slice(0, 200))
    })

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    // Close stdin immediately (we passed prompt as CLI arg)
    proc.stdin.end()

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`Claude Code agent timed out after ${opts.timeout}ms`))
    }, opts.timeout || 120000)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (opts.signal?.aborted) return reject(opts.signal.reason)

      if (code === 0) {
        resolve(parseResult(stdout))
      } else {
        // Even on non-zero exit, we may have partial output
        if (stdout.trim()) {
          resolve(parseResult(stdout))
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr.slice(0, 500)}`))
        }
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to spawn Claude Code: ${err.message}`))
    })
  })
}

export default claudeCodeAdapter