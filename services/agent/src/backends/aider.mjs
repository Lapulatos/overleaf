// @ts-check
/**
 * Aider CLI adapter — executes tasks by spawning `aider` CLI.
 *
 * Aider is a CLI tool for AI-assisted coding that works with
 * multiple LLM providers and supports multi-file edits.
 *
 * Prerequisite: `aider` must be installed and on PATH.
 * Install: pip install aider-chat
 */

import { spawn } from 'node:child_process'
import { parseResult, spawnAsync, bindCancellation } from './utils.mjs'

/** @type {import('./base.mjs').BackendAdapter} */
const aiderAdapter = {
  /**
   * @param {string} prompt
   * @param {import('./base.mjs').ExecuteOptions} opts
   * @returns {Promise<import('./base.mjs').BackendResult>}
   */
  async execute(prompt, opts) {
    opts.onProgress('[aider] Spawning aider CLI...')

    const result = await runAiderCLI(prompt, opts)

    opts.onProgress('[aider] CLI execution completed')
    return parseResult(result)
  },

  async healthCheck() {
    try {
      const result = await spawnAsync('aider', ['--version'], 5000)
      return result.length > 0
    } catch {
      return false
    }
  },
}

/**
 * @param {string} prompt
 * @param {import('./base.mjs').ExecuteOptions} opts
 * @returns {Promise<string>}
 */
function runAiderCLI(prompt, opts) {
  return new Promise((resolve, reject) => {
    const args = [
      '--model', opts.model || 'anthropic/claude-sonnet-4-6',
      '--no-auto-commits',
      '--chat-mode', 'ask',
      '--message', prompt,
    ]

    const proc = spawn('aider', args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: opts.apiKey || process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: opts.apiKey || process.env.OPENAI_API_KEY,
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
      opts.onProgress(text.slice(0, 200))
    })

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.stdin.end()

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`aider CLI timed out after ${opts.timeout}ms`))
    }, opts.timeout || 120000)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (opts.signal?.aborted) return reject(opts.signal.reason)
      if (code === 0) {
        resolve(stdout)
      } else if (stdout.trim()) {
        // Aider sometimes exits non-zero (e.g. warnings, unmergeable hunks)
        // but still produces usable output. Mirror claude-code / codex
        // behavior and surface the partial result instead of dropping it.
        resolve(stdout)
      } else {
        reject(new Error(`aider CLI exited with code ${code}: ${stderr.slice(0, 500)}`))
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to spawn aider CLI: ${err.message}`))
    })
  })
}

export default aiderAdapter