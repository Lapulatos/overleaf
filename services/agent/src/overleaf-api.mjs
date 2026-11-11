// @ts-check
/**
 * Overleaf API bridge for agent daemon.
 *
 * Provides HTTP client methods for reading/writing project files
 * via the WA Host Server proxy. All calls go through the WA Host's
 * agent-api routes, which validate the HMAC token and proxy to
 * the container's Private API.
 *
 * Usage:
 *   const api = createOverleafApi({ waHostUrl: 'http://127.0.0.1:3050' })
 *   const entities = await api.getEntities(projectId, apiToken)
 *   const doc = await api.getDoc(projectId, docId, apiToken)
 *   const result = await api.writeDoc(projectId, docId, lines, version, apiToken)
 */

import { createHmac } from 'node:crypto'

const DEFAULT_TIMEOUT_MS = 30000
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAYS_MS = [0, 500, 1000]

/**
 * @typedef {Object} OverleafApiConfig
 * @property {string} waHostUrl - WA Host Server base URL
 * @property {number} [timeout] - HTTP request timeout in ms
 * @property {string} [agentApiSecret] - Shared secret matching OVERLEAF_AGENT_API_SECRET.
 *   When provided, the API client refreshes expired tokens mid-task using
 *   the task's HMAC claims so long-running agents can outlive the 30-min TTL.
 * @property {{ projectId: string, userId: string, taskId: string }} [claims]
 *   Token claims for refresh. Required together with agentApiSecret.
 */

/**
 * Regenerate an X-Agent-Api-Token compatible with WritingAssistAgentApiToken.
 * Mirror of services/web/.../WritingAssistAgentApiToken.mjs generateToken().
 *
 * @param {string} projectId
 * @param {string} userId
 * @param {string} taskId
 * @param {string} secret
 * @returns {string}
 */
export function generateAgentApiToken(projectId, userId, taskId, secret) {
  const timestamp = Math.floor(Date.now() / 1000)
  const payload = `${projectId}|${userId}|${taskId}|${timestamp}`
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return Buffer.from(`${payload}|${signature}`).toString('base64url')
}

/**
 * @typedef {Object} DocContent
 * @property {string[]} lines - Document lines
 * @property {number} version - Current document version
 * @property {Object} [ranges] - Track changes / comments metadata
 * @property {string} [pathname] - File path in project
 */

/**
 * @typedef {Object} WriteResult
 * @property {boolean} modified - Whether the write succeeded
 * @property {number} [rev] - New revision number
 * @property {number} [version] - New document version
 */

/**
 * @typedef {Object} ConflictInfo
 * @property {string} docId - Document that had a conflict
 * @property {number} attemptedVersion - Version we tried to write
 * @property {number} currentVersion - Version docstore currently has
 * @property {string[]} currentLines - Current document content
 */

/**
 * Custom error for write conflicts after exhausting retries.
 */
export class ConflictError extends Error {
  /** @type {ConflictInfo} */
  conflictInfo

  /**
   * @param {string} message
   * @param {ConflictInfo} info
   */
  constructor(message, info) {
    super(message)
    this.name = 'ConflictError'
    this.conflictInfo = info
  }
}

/**
 * Create an Overleaf API client instance.
 *
 * @param {OverleafApiConfig} config
 * @returns {{ getEntities: Function, getDoc: Function, writeDoc: Function, applyDiffWithRetry: Function, compileProject: Function }}
 */
export function createOverleafApi(config) {
  const waHostUrl = config.waHostUrl || 'http://127.0.0.1:3050'
  const timeout = config.timeout || DEFAULT_TIMEOUT_MS
  const agentApiSecret = config.agentApiSecret || ''
  const claims = config.claims || null

  /**
   * If the token can be re-signed locally (we have the shared secret and
   * the original claims), regenerate it. Otherwise return null so callers
   * propagate the auth failure to the user.
   * @returns {string|null}
   */
  function refreshToken() {
    if (!agentApiSecret || !claims) return null
    return generateAgentApiToken(
      claims.projectId,
      claims.userId,
      claims.taskId,
      agentApiSecret
    )
  }

  /**
   * Make an HTTP request to the WA Host proxy. Auto-refreshes the token
   * once on 401 when refresh material is available.
   *
   * @param {string} path - URL path (e.g. /writing-assist/agent-api/project/:id/entities)
   * @param {string} method - HTTP method
   * @param {string} apiToken - HMAC token for auth
   * @param {Object} [body] - Request body (for POST)
   * @param {{ allowRefresh?: boolean }} [opts]
   * @returns {Promise<any>} Parsed JSON response
   * @throws {Error} On network error, timeout, or non-2xx response
   */
  async function callWAHost(path, method, apiToken, body, opts) {
    const allowRefresh = opts?.allowRefresh !== false
    const url = `${waHostUrl}${path}`
    const headers = {
      'Content-Type': 'application/json',
      'X-Agent-Api-Token': apiToken,
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      let errorDetail = ''
      try {
        const parsed = JSON.parse(errorBody)
        errorDetail = parsed.error || errorBody
      } catch {
        errorDetail = errorBody
      }

      if (response.status === 401) {
        // Token expired or otherwise rejected — try once with a fresh token
        // if the daemon was started with the shared secret + task claims.
        if (allowRefresh) {
          const refreshed = refreshToken()
          if (refreshed) {
            return callWAHost(path, method, refreshed, body, { allowRefresh: false })
          }
        }
        throw new Error(`auth failed: ${errorDetail}`)
      }
      if (response.status === 404) {
        throw new Error(`not found: ${errorDetail}`)
      }
      if (response.status === 409) {
        const err = new Error(`version conflict: ${errorDetail}`)
        err.name = 'VersionConflictError'
        throw err
      }
      throw new Error(`WA host error ${response.status}: ${errorDetail}`)
    }

    return await response.json()
  }

  /**
   * Get project entities (file listing).
   *
   * @param {string} projectId - Overleaf project ID
   * @param {string} apiToken - HMAC token
   * @returns {Promise<{ docs: Array, files: Array, folders: Array }>}
   */
  async function getEntities(projectId, apiToken) {
    return callWAHost(
      `/writing-assist/agent-api/project/${projectId}/entities`,
      'GET',
      apiToken
    )
  }

  /**
   * Read a document's content and metadata.
   *
   * @param {string} projectId - Overleaf project ID
   * @param {string} docId - Document ID
   * @param {string} apiToken - HMAC token
   * @returns {Promise<DocContent>}
   */
  async function getDoc(projectId, docId, apiToken) {
    return callWAHost(
      `/writing-assist/agent-api/project/${projectId}/doc/${docId}`,
      'GET',
      apiToken
    )
  }

  /**
   * Write new content to a document.
   *
   * @param {string} projectId - Overleaf project ID
   * @param {string} docId - Document ID
   * @param {string[]} lines - New document lines
   * @param {number} version - Expected current version (for conflict detection)
   * @param {string} apiToken - HMAC token
   * @returns {Promise<WriteResult>}
   */
  async function writeDoc(projectId, docId, lines, version, apiToken) {
    return callWAHost(
      `/writing-assist/agent-api/project/${projectId}/doc/${docId}`,
      'POST',
      apiToken,
      { lines, version }
    )
  }

  /**
   * Apply a diff to a document with automatic conflict resolution.
   *
   * On version conflict:
   * 1. Re-read the doc to get current version
   * 2. Re-apply the diff against new content
   * 3. Retry write with new version
   * Max 3 retries before throwing ConflictError.
   *
   * @param {string} projectId
   * @param {string} docId
   * @param {string[]} newLines - Lines after diff applied
   * @param {number} version - Version at time of original read
   * @param {string} apiToken
   * @param {{ removeLines: string[], addLines: string[] }} hunk - Original diff hunk for re-application
   * @returns {Promise<WriteResult>}
   * @throws {ConflictError} When all retries exhausted
   */
  async function applyDiffWithRetry(projectId, docId, newLines, version, apiToken, hunk) {
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await writeDoc(projectId, docId, newLines, version, apiToken)
        if (result.modified) {
          return result
        }

        // Write succeeded but modified:false — version conflict
        // Re-read and retry
      } catch (err) {
        if (err.name !== 'VersionConflictError') {
          // Not a conflict error — don't retry
          throw err
        }
      }

      // Conflict detected — re-read doc
      const delay = RETRY_DELAYS_MS[attempt] || 0
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      try {
        const currentDoc = await getDoc(projectId, docId, apiToken)
        const currentLines = currentDoc.lines

        // Re-apply diff hunk against current content
        // Simple approach: try to find the removeLines in current content
        // and replace with addLines
        const removeText = (hunk?.removeLines || []).join('\n')
        const addText = (hunk?.addLines || []).join('\n')
        const currentText = currentLines.join('\n')

        const matchIndex = currentText.indexOf(removeText)
        if (matchIndex !== -1) {
          // Found the original text in the current content — re-apply
          const reappliedText =
            currentText.slice(0, matchIndex) +
            addText +
            currentText.slice(matchIndex + removeText.length)
          newLines = reappliedText.split('\n')
          version = currentDoc.version
          // Continue to next attempt (will write with new version)
        } else {
          // Cannot auto-merge — user edited the same area
          throw new ConflictError(
            `Cannot auto-merge: original lines not found in current doc ${docId}`,
            {
              docId,
              attemptedVersion: version,
              currentVersion: currentDoc.version,
              currentLines,
            }
          )
        }
      } catch (innerErr) {
        if (innerErr instanceof ConflictError) throw innerErr
        // Re-read failed — network error etc. — don't retry
        throw innerErr
      }
    }

    // All retries exhausted
    throw new ConflictError(
      `Write conflict on doc ${docId} after ${MAX_RETRY_ATTEMPTS} attempts`,
      {
        docId,
        attemptedVersion: version,
        currentVersion: 0, // Unknown — couldn't even re-read
        currentLines: [],
      }
    )
  }

  /**
   * Trigger a LaTeX compilation via the WA Host proxy.
   *
   * Current status: the proxy endpoint
   *   POST /writing-assist/agent-api/project/:project_id/compile
   * exists on the WA Host but returns 501 until the CLSI bridge is wired
   * up. We forward the call anyway so that:
   *   - frontend callers see a structured status, not an unhandled throw
   *   - flipping the WA Host side from stub to real CLSI requires no
   *     daemon change
   *
   * @param {string} projectId
   * @param {string} apiToken
   * @returns {Promise<{ status: 'ok'|'not_implemented'|'error', compileLog?: string, error?: string }>}
   */
  async function compileProject(projectId, apiToken) {
    try {
      const result = await callWAHost(
        `/writing-assist/agent-api/project/${projectId}/compile`,
        'POST',
        apiToken,
        {}
      )
      return { status: 'ok', ...result }
    } catch (err) {
      // WA Host returns 501 → callWAHost throws "WA host error 501: ..."
      if (err && typeof err.message === 'string' && err.message.startsWith('WA host error 501')) {
        return { status: 'not_implemented', error: err.message }
      }
      return { status: 'error', error: err?.message || String(err) }
    }
  }

  return { getEntities, getDoc, writeDoc, applyDiffWithRetry, compileProject }
}