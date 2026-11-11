// @ts-check
/**
 * Unit tests for overleaf-api.mjs
 *
 * Uses a custom global fetch override that is restored after each test.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createOverleafApi, ConflictError } from '../src/overleaf-api.mjs'

// ── Mock fetch ──────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch
let mockFetchFn = null

before(() => {
  // Replace global fetch with our mock dispatcher
  globalThis.fetch = async (url, opts) => {
    if (mockFetchFn) {
      return mockFetchFn(url, opts)
    }
    return originalFetch(url, opts)
  }
})

after(() => {
  // Restore original fetch
  globalThis.fetch = originalFetch
})

/**
 * Create a mock fetch that returns a fixed response.
 */
function setMockFetch(status, body) {
  mockFetchFn = async (_url, _opts) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', 'application/json']]),
    text: async () => JSON.stringify(body),
    json: async () => body,
  })
}

/**
 * Create a sequence of mock responses (for multi-step tests).
 */
function setMockSequence(responses) {
  let index = 0
  mockFetchFn = async (_url, _opts) => {
    if (index >= responses.length) {
      throw new Error('mock sequence exhausted')
    }
    const { status, body } = responses[index++]
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify(body),
      json: async () => body,
    }
  }
}

function resetMock() {
  mockFetchFn = null
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('createOverleafApi', () => {
  const config = { waHostUrl: 'http://127.0.0.1:3050' }

  it('getEntities returns project file listing', async () => {
    setMockFetch(200, {
      docs: [
        { _id: 'abc123', name: 'main.tex', pathname: 'main.tex' },
        { _id: 'def456', name: 'refs.bib', pathname: 'refs.bib' },
      ],
      files: [{ name: 'image.png', pathname: 'image.png' }],
    })

    const api = createOverleafApi(config)
    const result = await api.getEntities('proj1', 'token1')

    assert.equal(result.docs.length, 2)
    assert.equal(result.docs[0].name, 'main.tex')
    resetMock()
  })

  it('getDoc returns document content and version', async () => {
    setMockFetch(200, {
      lines: ['\\documentclass{article}', '\\begin{document}'],
      version: 5,
      pathname: 'main.tex',
    })

    const api = createOverleafApi(config)
    const result = await api.getDoc('proj1', 'abc123', 'token1')

    assert.equal(result.lines.length, 2)
    assert.equal(result.version, 5)
    resetMock()
  })

  it('writeDoc succeeds with modified:true', async () => {
    setMockFetch(200, { modified: true, version: 6 })

    const api = createOverleafApi(config)
    const result = await api.writeDoc(
      'proj1',
      'abc123',
      ['\\documentclass{article}', '\\begin{document}', 'modified'],
      5,
      'token1'
    )

    assert.equal(result.modified, true)
    resetMock()
  })

  it('writeDoc with auth error throws', async () => {
    setMockFetch(401, { error: 'invalid token' })

    const api = createOverleafApi(config)

    try {
      await api.writeDoc('proj1', 'abc123', ['content'], 5, 'bad-token')
      assert.fail('should have thrown')
    } catch (err) {
      assert.ok(err.message.includes('auth failed'))
    }
    resetMock()
  })

  it('writeDoc with 404 throws', async () => {
    setMockFetch(404, { error: 'doc not found' })

    const api = createOverleafApi(config)

    try {
      await api.writeDoc('proj1', 'abc123', ['content'], 5, 'token1')
      assert.fail('should have thrown')
    } catch (err) {
      assert.ok(err.message.includes('not found'))
    }
    resetMock()
  })
})

describe('applyDiffWithRetry', () => {
  const config = { waHostUrl: 'http://127.0.0.1:3050' }
  const hunk = {
    removeLines: ['\\usepackage{foo}'],
    addLines: ['\\usepackage{bar}'],
  }

  it('succeeds on first attempt', async () => {
    setMockFetch(200, { modified: true, version: 6 })

    const api = createOverleafApi(config)
    const result = await api.applyDiffWithRetry(
      'proj1',
      'abc123',
      ['\\documentclass{article}', '\\usepackage{bar}', '\\begin{document}'],
      5,
      'token1',
      hunk
    )

    assert.equal(result.modified, true)
    resetMock()
  })

  it('retry succeeds after version conflict + re-read + re-apply', async () => {
    // Sequence:
    // 1. First write → conflict (modified: false)
    // 2. Re-read → get current content with version 6
    // 3. Re-apply → write with version 6 → success
    setMockSequence([
      { status: 200, body: { modified: false } },
      { status: 200, body: {
        lines: ['\\documentclass{article}', '\\usepackage{foo}', '\\begin{document}'],
        version: 6,
      }},
      { status: 200, body: { modified: true, version: 7 } },
    ])

    const api = createOverleafApi(config)
    const result = await api.applyDiffWithRetry(
      'proj1',
      'abc123',
      ['\\documentclass{article}', '\\usepackage{bar}', '\\begin{document}'],
      5,
      'token1',
      hunk
    )

    assert.equal(result.modified, true)
    resetMock()
  })

  it('throws ConflictError when auto-merge fails', async () => {
    // Sequence:
    // 1. First write → conflict
    // 2. Re-read → current content where original lines are gone (can't auto-merge)
    setMockSequence([
      { status: 200, body: { modified: false } },
      { status: 200, body: {
        lines: ['\\documentclass{article}', '\\usepackage{baz}', '\\begin{document}'],
        version: 6,
      }},
    ])

    const api = createOverleafApi(config)

    try {
      await api.applyDiffWithRetry(
        'proj1',
        'abc123',
        ['content'],
        5,
        'token1',
        hunk
      )
      assert.fail('should have thrown')
    } catch (err) {
      assert.ok(err instanceof ConflictError)
      assert.equal(err.conflictInfo.docId, 'abc123')
    }
    resetMock()
  })

  it('compileProject returns not_implemented when WA Host returns 501', async () => {
    setMockFetch(501, { error: 'compile not yet implemented (Phase 2)' })

    const api = createOverleafApi(config)
    const result = await api.compileProject('proj1', 'token1')

    assert.equal(result.status, 'not_implemented')
    assert.ok(result.error && result.error.includes('501'))
    resetMock()
  })

  it('compileProject returns ok when WA Host returns 200', async () => {
    setMockFetch(200, { compileLog: 'pdf rendered' })

    const api = createOverleafApi(config)
    const result = await api.compileProject('proj1', 'token1')

    assert.equal(result.status, 'ok')
    assert.equal(result.compileLog, 'pdf rendered')
    resetMock()
  })

  it('compileProject returns error on network failure', async () => {
    // Simulate a non-501 error from WA Host
    setMockFetch(500, { error: 'internal' })

    const api = createOverleafApi(config)
    const result = await api.compileProject('proj1', 'token1')

    assert.equal(result.status, 'error')
    assert.ok(result.error && result.error.includes('500'))
    resetMock()
  })
})