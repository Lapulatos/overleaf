import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAgentProvider } from '../../app/src/Features/WritingAssist/providers/AgentProvider.mjs'

const settings = () => ({
  agentEndpoint: 'http://localhost:1234/',
  agentToken: 'server-secret',
})
const params = {
  text: 'They is ready.',
  systemPrompt: 'Return JSON issues.',
  enabledCategories: ['correctness'],
}
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status })

test('local provider uses server credentials and returns the completed JSON without document writes', async () => {
  const calls = []
  let polls = 0
  const provider = createAgentProvider(
    settings,
    async (url, options) => {
      calls.push({ url, ...options })
      if (options.method === 'POST') return response({}, 201)
      return response(
        ++polls === 1
          ? { status: 'running' }
          : { status: 'completed', summary: '{"issues":[]}' }
      )
    },
    async () => {}
  )
  assert.equal(await provider.check(params), '{"issues":[]}')
  assert.equal(calls.length, 3)
  assert.equal(calls[0].headers['X-Agent-Token'], 'server-secret')
  const body = JSON.parse(calls[0].body)
  assert.equal(body.type, 'writing-assist-json')
  assert.equal(body.instruction, params.systemPrompt)
  assert.match(body.context.userMessage, /They is ready/)
  assert.match(body.context.userMessage, /correctness/)
  assert.equal(calls[1].url, `http://localhost:1234/agent/task/${body.taskId}`)
  assert.equal(JSON.stringify(body).includes('server-secret'), false)
})

test('transform passes its own message, with no grammar wrapper', async () => {
  let body
  const provider = createAgentProvider(settings, async (_url, options) => {
    if (options.method === 'POST') {
      body = JSON.parse(options.body)
      return response({}, 201)
    }
    return response({
      status: 'completed',
      summary: '{"result":"They are ready."}',
    })
  })
  await provider.check({
    ...params,
    userMessage: 'Rewrite the masked sentence.',
  })
  assert.equal(body.context.userMessage, 'Rewrite the masked sentence.')
})

test('lost creation response attempts cleanup of the exact generated task', async () => {
  const calls = []
  const provider = createAgentProvider(settings, async (url, options) => {
    calls.push({ url, ...options })
    if (options.method === 'POST') throw new Error('connection closed')
    return response({})
  })
  await assert.rejects(provider.check(params), { statusCode: 502 })
  assert.equal(calls[1].method, 'DELETE')
  assert.ok(calls[1].url.endsWith(JSON.parse(calls[0].body).taskId))
  assert.equal(calls[1].signal.aborted, false)
})

for (const status of ['failed', 'cancelled', 'timeout']) {
  test(`terminal ${status} is an error, never a successful grammar check`, async () => {
    const methods = []
    const provider = createAgentProvider(settings, async (_url, options) => {
      methods.push(options.method)
      return response(options.method === 'POST' ? {} : { status })
    })
    await assert.rejects(provider.check(params), {
      statusCode: status === 'timeout' ? 504 : 502,
    })
    assert.deepEqual(methods, ['POST', 'GET'])
  })
}

test('busy daemon remains a retriable busy error', async () => {
  const provider = createAgentProvider(
    settings,
    async () => response({}, 429),
    async () => {}
  )
  await assert.rejects(provider.check(params), { statusCode: 429 })
})

test('missing configuration makes no network requests', async () => {
  const provider = createAgentProvider(
    () => ({}),
    async () => {
      throw new Error('must not request')
    }
  )
  await assert.rejects(provider.check(params), { statusCode: 503 })
})

test('request deadline cancels the task using a fresh cleanup signal', async () => {
  let cleanup = false
  const provider = createAgentProvider(settings, async (_url, options) => {
    if (options.method === 'POST') return response({}, 201)
    if (options.method === 'DELETE') {
      cleanup = !options.signal.aborted
      return response({})
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 5000)
      options.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          reject(options.signal.reason)
        },
        { once: true }
      )
    })
    return response({ status: 'running' })
  })
  await assert.rejects(provider.check({ ...params, timeout: 2000 }), {
    statusCode: 504,
  })
  assert.equal(cleanup, true)
})

for (const summary of ['not JSON', '{}', '{"result":"unexpected"}', 'null']) {
  test(`invalid grammar response cannot be reported as a clean check: ${summary}`, async () => {
    const provider = createAgentProvider(settings, async (_url, options) =>
      response(
        options.method === 'POST' ? {} : { status: 'completed', summary }
      )
    )
    await assert.rejects(provider.check(params), { statusCode: 502 })
  })
}

test('short busy admission retries the same task without duplicate accepted work', async () => {
  let attempts = 0
  const ids = []
  const provider = createAgentProvider(
    settings,
    async (_url, options) => {
      if (options.method === 'POST') {
        ids.push(JSON.parse(options.body).taskId)
        return ++attempts < 3 ? response({}, 429) : response({}, 201)
      }
      return response({ status: 'completed', summary: '{"issues":[]}' })
    },
    async () => {}
  )
  assert.equal(await provider.check(params), '{"issues":[]}')
  assert.equal(attempts, 3)
  assert.equal(new Set(ids).size, 1)
})

test('browser cancellation aborts polling and removes only its own task', async () => {
  const controller = new AbortController()
  const calls = []
  const provider = createAgentProvider(settings, async (url, options) => {
    calls.push({ url, ...options })
    if (options.method === 'POST') return response({}, 201)
    if (options.method === 'DELETE') return response({})
    controller.abort()
    options.signal.throwIfAborted()
  })
  await assert.rejects(
    provider.check({ ...params, signal: controller.signal }),
    { statusCode: 499 }
  )
  assert.deepEqual(
    calls.map((c) => c.method),
    ['POST', 'GET', 'DELETE']
  )
  assert.equal(calls[2].signal.aborted, false)
  assert.equal(calls[1].url, calls[2].url)
})
