// @ts-check
/**
 * Integration / E2E SSE test for the agent daemon.
 *
 * Verifies the full request → SSE stream → terminal-state flow without
 * hitting any external LLM API. A fake backend is injected into
 * BACKEND_MAP so we control progress/result deterministically.
 */

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import net from 'node:net'

import { startServer } from '../src/index.mjs'
import { BACKEND_MAP } from '../src/backends/index.mjs'

const fetch = (url, options = {}) => globalThis.fetch(url, {
  ...options,
  headers: { 'X-Agent-Token': 'test-agent-token', ...options.headers },
})

// ── Pick a free port so parallel test runs don't collide ──
async function pickPort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = /** @type {any} */ (srv.address())
      const port = addr.port
      srv.close(() => resolve(port))
    })
  })
}

// ── Inject a deterministic backend ──
BACKEND_MAP.fake = {
  async execute(_prompt, opts) {
    opts.onProgress('[fake] step 1')
    await sleep(20)
    opts.onProgress('[fake] step 2')
    await sleep(20)
    return {
      summary: 'fake task completed',
      diffs: [],
      artifacts: [],
    }
  },
  async healthCheck() {
    return true
  },
}

/** @returns {Promise<{ baseUrl: string, server: any }>} */
async function startTestServer(overrides = {}) {
  const port = await pickPort()
  const server = await startServer({
    port,
    backend: 'fake',
    agentToken: 'test-agent-token',
    maxSteps: 200,
    timeout: 10000,
    waHostUrl: 'http://127.0.0.1:1',
    logLevel: 'error', // suppress info noise in test output
    maxConcurrentTasks: 4,
    ...overrides,
  })
  return { baseUrl: `http://127.0.0.1:${port}`, server }
}

/**
 * Consume an SSE stream and return collected events.
 * Stops on the daemon's "done" sentinel.
 * @param {string} url
 * @returns {Promise<{ events: any[], done: boolean }>}
 */
async function readSSE(url) {
  const resp = await fetch(url)
  assert.equal(resp.status, 200)
  assert.ok(resp.body, 'SSE response has no body stream')
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  /** @type {any[]} */
  const events = []
  let done = false
  let buffer = ''

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })

    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 2)
      if (!block || block.startsWith(':')) continue
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          const data = JSON.parse(line.slice(5).trim())
          if (data && data.type === 'done') {
            done = true
          } else {
            events.push(data)
          }
        } catch {
          // ignore malformed lines
        }
      }
    }
    if (done) break
  }
  reader.cancel().catch(() => {})
  return { events, done }
}

test('integration: health endpoint reports concurrency', async () => {
  const { baseUrl, server } = await startTestServer()
  try {
    const resp = await fetch(`${baseUrl}/agent/health`)
    const body = await resp.json()
    assert.equal(body.backend, 'fake')
    assert.equal(body.backendOk, true)
    assert.equal(body.concurrency.max, 4)
    assert.equal(body.concurrency.running, 0)
  } finally {
    server.close()
  }
})

test('integration: daemon refuses to start without authentication', async () => {
  await assert.rejects(startServer({ backend: 'fake', port: 0 }), /agent-token is required/)
})

test('integration: POST /agent/task creates running task', async () => {
  const { baseUrl, server } = await startTestServer()
  try {
    const resp = await fetch(`${baseUrl}/agent/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'int-1',
        type: 'check',
        instruction: 'hi',
        context: { projectId: 'p1', userId: 'u1' },
      }),
    })
    assert.equal(resp.status, 201)
    const body = await resp.json()
    assert.equal(body.taskId, 'int-1')
    assert.ok(body._links.stream.includes('/agent/task/int-1/stream'))
  } finally {
    server.close()
  }
})

test('integration: SSE stream delivers progress + done', async () => {
  const { baseUrl, server } = await startTestServer()
  try {
    await fetch(`${baseUrl}/agent/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'int-sse-1',
        type: 'check',
        instruction: 'hi',
        context: { projectId: 'p1', userId: 'u1' },
      }),
    })

    const { events, done } = await readSSE(`${baseUrl}/agent/task/int-sse-1/stream`)
    assert.ok(done, 'should receive done sentinel')
    assert.ok(events.length >= 2, 'should receive at least 2 events')
    const last = events[events.length - 1]
    assert.equal(last.taskId, 'int-sse-1')
    assert.ok(
      ['completed', 'failed', 'timeout'].includes(last.status),
      `last status should be terminal, got ${last.status}`
    )
  } finally {
    server.close()
  }
})

test('integration: terminal task result exposes diffs array', async () => {
  const { baseUrl, server } = await startTestServer()
  try {
    await fetch(`${baseUrl}/agent/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'int-r-1',
        type: 'check',
        instruction: 'hi',
        context: { projectId: 'p1', userId: 'u1' },
      }),
    })
    // wait for completion
    await sleep(120)
    const resp = await fetch(`${baseUrl}/agent/task/int-r-1`)
    const body = await resp.json()
    assert.equal(body.taskId, 'int-r-1')
    assert.equal(body.status, 'completed')
    assert.ok(Array.isArray(body.diffs))
    assert.ok(Array.isArray(body.artifacts))
    assert.equal(body.summary, 'fake task completed')
  } finally {
    server.close()
  }
})

test('integration: concurrency cap returns 429 when saturated', async () => {
  const { baseUrl, server } = await startTestServer({ maxConcurrentTasks: 1 })
  try {
    const first = await fetch(`${baseUrl}/agent/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'cap-1',
        type: 'check',
        instruction: 'hi',
        context: { projectId: 'p1', userId: 'u1' },
      }),
    })
    assert.equal(first.status, 201)

    const second = await fetch(`${baseUrl}/agent/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'cap-2',
        type: 'check',
        instruction: 'hi',
        context: { projectId: 'p1', userId: 'u1' },
      }),
    })
    assert.equal(second.status, 429)
    const body = await second.json()
    assert.equal(body.running, 1)
    assert.equal(body.max, 1)
  } finally {
    server.close()
  }
})

test('integration: duplicate taskId returns 409', async () => {
  const { baseUrl, server } = await startTestServer()
  try {
    const body = JSON.stringify({
      taskId: 'dup-1',
      type: 'check',
      instruction: 'hi',
      context: { projectId: 'p1', userId: 'u1' },
    })
    const first = await fetch(`${baseUrl}/agent/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    assert.equal(first.status, 201)
    const second = await fetch(`${baseUrl}/agent/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    assert.equal(second.status, 409)
  } finally {
    server.close()
  }
})

test('integration: token protects task results and submission', async () => {
  const { baseUrl, server } = await startTestServer({ agentToken: 'test-only-token' })
  try {
    for (const path of ['/agent/health', '/agent/tasks', '/agent/task/private']) {
      assert.equal((await fetch(`${baseUrl}${path}`)).status, 403)
    }
    const response = await fetch(`${baseUrl}/agent/health`, {
      headers: { 'X-Agent-Token': 'test-only-token' },
    })
    assert.equal(response.status, 200)
    assert.equal((await fetch(`${baseUrl}/agent/task`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })).status, 403)
  } finally { server.close() }
})

test('integration: malformed submissions return 400 rather than server errors', async () => {
  const { baseUrl, server } = await startTestServer()
  try {
    const valid = { taskId: 'validation', type: 'check', instruction: 'Check' }
    for (const body of [
      { ...valid, instruction: 123 }, { ...valid, taskId: '../private' },
      { ...valid, timeout: -1 }, { ...valid, timeout: 20000 },
      { ...valid, context: [] }, { ...valid, context: null },
    ]) {
      const response = await fetch(`${baseUrl}/agent/task`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      assert.equal(response.status, 400)
    }
  } finally { server.close() }
})

test('integration: cancelled task remains cancelled after backend finishes', async () => {
  const { baseUrl, server } = await startTestServer()
  try {
    await fetch(`${baseUrl}/agent/task`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: 'cancel', type: 'check', instruction: 'Check' }),
    })
    const response = await fetch(`${baseUrl}/agent/task/cancel`, { method: 'DELETE' })
    assert.equal((await response.json()).status, 'cancelled')
    const { events, done } = await readSSE(`${baseUrl}/agent/task/cancel/stream`)
    assert.equal(done, true)
    assert.equal(events.at(-1).status, 'cancelled')
    await sleep(70)
    const result = await (await fetch(`${baseUrl}/agent/task/cancel`)).json()
    assert.equal(result.status, 'cancelled')
    assert.deepEqual(result.diffs, [])
  } finally { server.close() }
})

test('integration: listener defaults to loopback and rejects occupied ports', async () => {
  const { server } = await startTestServer()
  try {
    assert.equal(server.address().address, '127.0.0.1')
    await assert.rejects(startTestServer({ port: server.address().port }), { code: 'EADDRINUSE' })
  } finally { server.close() }
})

test('integration: configurable listener still requires authentication', async () => {
  const { server, baseUrl } = await startTestServer({ host: '0.0.0.0' })
  try {
    assert.equal(server.address().address, '0.0.0.0')
    assert.equal((await globalThis.fetch(`${baseUrl}/agent/tasks`)).status, 403)
    assert.equal((await fetch(`${baseUrl}/agent/tasks`)).status, 200)
  } finally { server.close() }
  await assert.rejects(startTestServer({ host: 'http://localhost' }), /listen host/)
})

test('integration: missing tasks have a distinct recovery code', async () => {
  const { server, baseUrl } = await startTestServer()
  try {
    for (const [path, method] of [
      ['/agent/task/missing', 'GET'],
      ['/agent/task/missing', 'DELETE'],
      ['/agent/task/missing/stream', 'GET'],
    ]) {
      const response = await fetch(`${baseUrl}${path}`, { method })
      assert.equal(response.status, 404)
      assert.equal((await response.json()).code, 'TASK_NOT_FOUND')
    }
  } finally { server.close() }
})

after(() => {
  // Process exit will tear down any leaked listeners.
  delete BACKEND_MAP.fake
})

test('image capability is explicit and unsupported backends reject rather than ignore it', async t => {
  const { baseUrl, server } = await startTestServer()
  t.after(() => { server.close(); server.closeAllConnections() })
  const health = await (await fetch(`${baseUrl}/agent/health`)).json()
  assert.equal(health.capabilities.images, false)
  const image = { name: 'formula.png', mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO3sAAAAASUVORK5CYII=' }
  const submit = images => fetch(`${baseUrl}/agent/task`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: 'image-task', type: 'writing', instruction: 'Transcribe image', context: { images } }) })
  assert.equal((await submit([image])).status, 422)
  assert.equal((await submit([{ ...image, data: 'invalid' }])).status, 400)
  assert.deepEqual(await (await fetch(`${baseUrl}/agent/tasks`)).json(), [])
})

test('transcription requires the daemon token and reports absent configuration', async () => {
  const { baseUrl, server } = await startTestServer()
  try {
    const denied = await globalThis.fetch(`${baseUrl}/agent/transcribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    assert.equal(denied.status, 403)
    const health = await (await fetch(`${baseUrl}/agent/health`)).json()
    assert.equal(health.capabilities.speech, false)
    const unavailable = await fetch(`${baseUrl}/agent/transcribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    assert.equal(unavailable.status, 503)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
