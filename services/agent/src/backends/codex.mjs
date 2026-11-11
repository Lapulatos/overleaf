// @ts-check
/**
 * Codex CLI adapter — executes multi-step agent tasks via OpenAI Codex CLI.
 *
 * Codex exec mode runs non-interactively, executing a prompt as an autonomous
 * agent that can read files, run commands, and iterate.
 *
 * Key CLI flags:
 *   codex exec [--model MODEL] [--sandbox read-only] [--json] [PROMPT]
 *   --json: emits events as JSONL on stdout (structured output for parsing)
 *   --sandbox read-only: agent can read but not write files (safe for analysis)
 *   --sandbox workspace-write: agent can write in the project directory
 *
 * Prerequisite: `codex` CLI must be installed and on PATH.
 * Install: npm install -g @openai/codex
 */

import { withImageFiles } from '../image-files.mjs'
import { spawn } from 'node:child_process'
import { createCodexEventParser } from './codex-events.mjs'
import { parseResult, spawnAsync, bindCancellation } from './utils.mjs'
import { runDocumentHarness } from '../document-harness.mjs'

export function documentChangesToDiffs(changes) {
  return changes.map(change => {
    if (change.kind === 'delete') return { kind: 'delete', path: change.path, content: change.before, version: change.version }
    if (change.kind === 'create') return { kind: 'create', path: change.path, content: change.after }
    return { path: change.path, content: change.content }
  })
}

/** @type {import('./base.mjs').BackendAdapter} */
const codexAdapter = {
  /**
   * @param {string} prompt
   * @param {import('./base.mjs').ExecuteOptions} opts
   * @returns {Promise<import('./base.mjs').BackendResult>}
   */
  async execute(prompt, opts) {
    if (opts.compilerImage && opts.taskType !== 'writing-assist-json' && Array.isArray(opts.context?.documents)) {
      const instruction = [
        opts.instruction,
        opts.context.conversation ? `Earlier conversation is context only; suggestions may not have been applied. Use current files as authoritative:\n${JSON.stringify(opts.context.conversation)}` : '',
      ].filter(Boolean).join('\n\n')
      const result = await runDocumentHarness({
        documents: opts.context.documents, assets: opts.context.assets, instruction, images: opts.context.images,
        prepareEnvironmentRepair: opts.prepareEnvironmentRepair,
        compilerImage: opts.compilerImage, model: opts.model, effort: opts.effort,
        signal: opts.signal, timeout: opts.timeout, maxToolCalls: opts.maxSteps,
        onProgress: opts.onProgress, onActivity: opts.onActivity,
      })
      return { summary: result.summary, diffs: documentChangesToDiffs(result.changes), artifacts: result.artifacts }
    }
    opts.onProgress('[codex] Starting Codex agent...')

    const result = await withImageFiles(opts.context?.images, paths => runCodexExec(prompt, opts, paths))

    opts.onProgress('[codex] Codex agent execution completed')
    return result
  },

  /**
   * Health check: verify `codex` CLI is on PATH and can run.
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const result = await spawnAsync('codex', ['--version'], 5000)
      return result.includes('codex') || result.includes('Codex')
    } catch {
      return false
    }
  },
}

/**
 * Run Codex in non-interactive exec mode.
 * Uses `--json` to get structured JSONL output for parsing.
 *
 * @param {string} prompt
 * @param {import('./base.mjs').ExecuteOptions} opts
 * @returns {Promise<import('./base.mjs').BackendResult>}
 */
function runCodexExec(prompt, opts, imagePaths = []) {
  return new Promise((resolve, reject) => {
    const sandbox = 'read-only'

    const args = [
      'exec',
      '--sandbox', sandbox,
      '--json',              // structured JSONL output
    ]

    if (opts.model) args.push('--model', opts.model)
    for (const path of imagePaths) args.push('--image', path)
    args.push('-')

    // Codex reads prompt from the argument or stdin
    // Using stdin is safer (avoids arg injection)
    const proc = spawn('codex', args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(opts.apiKey ? { CODEX_API_KEY: opts.apiKey } : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    bindCancellation(proc, opts.signal)
    proc.stdin.on('error', () => {})

    let parseError
    const cancellation = new AbortController()
    bindCancellation(proc, cancellation.signal)
    const parser = createCodexEventParser(opts.onProgress)
    proc.stdout.on('data', chunk => {
      if (parseError) return
      try { parser.push(chunk) }
      catch (error) {
        parseError = error
        cancellation.abort(error)
      }
    })

    proc.stderr.resume()

    // Send prompt via stdin
    proc.stdin.write(prompt)
    proc.stdin.end()

    const timer = setTimeout(() => {
      cancellation.abort(new Error('Codex agent timed out'))
    }, opts.timeout || 120000)

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (opts.signal?.aborted) return reject(opts.signal.reason)

      if (parseError) return reject(parseError)
      if (cancellation.signal.aborted) return reject(cancellation.signal.reason)
      if (code !== 0) return reject(new Error(`Codex exited with code ${code}`))
      try { resolve(parseResult(parser.finish())) }
      catch (error) { reject(error) }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to spawn Codex: ${err.message}`))
    })
  })
}

export default codexAdapter
