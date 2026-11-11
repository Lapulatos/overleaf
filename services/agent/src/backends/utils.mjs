// @ts-check
/**
 * Shared utilities for CLI backend adapters.
 */

import { spawn } from 'node:child_process'

/** Stop CLI work on cancellation, escalating if the child ignores SIGTERM.
 * @param {import('node:child_process').ChildProcess} proc
 * @param {AbortSignal} [signal]
 */
export function bindCancellation(proc, signal) {
  if (!signal) return
  let escalation
  const abort = () => {
    proc.kill('SIGTERM')
    escalation = setTimeout(() => proc.kill('SIGKILL'), 2000)
    escalation.unref()
  }
  signal.addEventListener('abort', abort, { once: true })
  proc.once('close', () => {
    signal.removeEventListener('abort', abort)
    clearTimeout(escalation)
  })
  if (signal.aborted) abort()
}

/**
 * Parse LLM response text into structured result.
 * Extracts unified diff blocks and separates them from the summary.
 * Resolves file paths from diff headers (--- a/path / +++ b/path).
 * @param {string} text
 * @returns {import('./base.mjs').BackendResult}
 */
export function parseResult(text) {
  const diffs = []
  const diffRegex = /```diff\n([\s\S]*?)```/g
  let match
  while ((match = diffRegex.exec(text)) !== null) {
    const diffContent = match[1].trim()
    // Try to extract file path from the diff header (--- a/path or +++ b/path)
    const pathMatch = diffContent.match(/^---\s+a\/(.+?)[\s\n]/m) ||
                      diffContent.match(/^\+\+\+\s+b\/(.+?)[\s\n]/m)
    const path = pathMatch ? pathMatch[1].trim() : 'main.tex'
    diffs.push({ path, content: diffContent })
  }

  // Also check for bare diff blocks (no ```diff wrapper)
  if (diffs.length === 0) {
    const bareDiffRegex = /^---\s+[^\n]+\n\+\+\+\s+[^\n]+\n@@[\s\S]*?(?=^---|\n\n\n|$)/gm
    while ((match = bareDiffRegex.exec(text)) !== null) {
      const diffContent = match[0].trim()
      const pathMatch = diffContent.match(/^---\s+a\/(.+?)[\s\n]/m) ||
                        diffContent.match(/^\+\+\+\s+b\/(.+?)[\s\n]/m)
      const path = pathMatch ? pathMatch[1].trim() : 'main.tex'
      diffs.push({ path, content: diffContent })
    }
  }

  const summary = text
    .replace(/```diff\n[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { summary: summary || 'Task completed', diffs, artifacts: [] }
}

/**
 * Spawn a command and capture stdout, with timeout.
 * @param {string} cmd
 * @param {string[]} args
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
export function spawnAsync(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`spawn '${cmd}' timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.stdout.on('data', (c) => { stdout += c.toString() })

    proc.on('close', () => {
      clearTimeout(timer)
      resolve(stdout)
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}
