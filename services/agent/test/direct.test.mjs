import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { resolveDirectConfig } from '../src/backends/direct-config.mjs'
import { createBackendAdapter } from '../src/backends/index.mjs'

test('unknown OpenAI-compatible model names do not select Anthropic', () => {
  const config = resolveDirectConfig({ model: 'custom-research-model' }, {
    OPENAI_API_KEY: 'openai-test', ANTHROPIC_API_KEY: 'anthropic-test',
    OPENAI_BASE_URL: 'https://gateway.example/v1',
    ANTHROPIC_BASE_URL: 'https://anthropic.example',
  })
  assert.equal(config.provider, 'openai')
  assert.equal(config.apiKey, 'openai-test')
  assert.equal(config.endpoint, 'https://gateway.example/v1')
})

test('explicit protocol overrides model name inference', () => {
  assert.equal(resolveDirectConfig({ model: 'claude-custom', provider: 'openai', apiKey: 'test' }, {}).provider, 'openai')
})

test('missing credentials cannot fall back to another provider key', () => {
  assert.throws(() => resolveDirectConfig({ model: 'custom' }, { ANTHROPIC_API_KEY: 'wrong-provider' }), /Missing API key for openai/)
})

test('normalizes version paths without duplicating Anthropic v1', () => {
  assert.equal(resolveDirectConfig({ model: 'claude-test', apiKey: 'test', endpoint: 'https://gateway.example/v1/' }, {}).endpoint, 'https://gateway.example')
  assert.equal(resolveDirectConfig({ model: 'custom', apiKey: 'test', endpoint: 'https://gateway.example/' }, {}).endpoint, 'https://gateway.example/v1')
})

test('rejects invalid configuration before sending credentials', () => {
  assert.throws(() => resolveDirectConfig({ apiKey: 'test' }, {}), /requires --model/)
  assert.throws(() => resolveDirectConfig({ model: 'custom', provider: 'unknown' }, {}), /Provider must/)
  for (const endpoint of ['file:///tmp/example', 'https://user:pass@example.com', 'https://example.com?apiKey=secret']) {
    assert.throws(() => resolveDirectConfig({ model: 'custom', apiKey: 'test', endpoint }, {}), /Endpoint must/)
  }
})

async function localProvider(t, provider, finish = true) {
  const requests = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ path: req.url, method: req.method, headers: req.headers, body: body && JSON.parse(body) })
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/v1/models') res.end(JSON.stringify({ data: [] }))
    else if (provider === 'anthropic' && req.url === '/v1/messages') res.end(JSON.stringify({
      content: [{ type: 'text', text: 'Checked the manuscript.' }], stop_reason: finish ? 'end_turn' : 'max_tokens',
    }))
    else if (provider === 'openai' && req.url === '/v1/chat/completions') res.end(JSON.stringify({
      choices: [{ message: { content: 'Checked the manuscript.' }, finish_reason: finish ? 'stop' : 'length' }],
    }))
    else { res.statusCode = 404; res.end('{}') }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.close(); server.closeAllConnections() })
  const config = { backend: 'direct', provider, model: 'custom-model', apiKey: 'test-key',
    endpoint: `http://127.0.0.1:${server.address().port}/v1`, timeout: 1000 }
  const adapter = createBackendAdapter(config)
  return { adapter, requests, options: { timeout: 1000, onProgress() {} } }
}

for (const provider of ['openai', 'anthropic']) {
  test(`${provider}: health and task use the same configured endpoint and protocol`, async t => {
    const { adapter, requests, options } = await localProvider(t, provider)
    assert.equal(await adapter.healthCheck(), true)
    const result = await adapter.execute('Check my paper', options)
    assert.equal(result.summary, 'Checked the manuscript.')
    assert.deepEqual(requests.map(r => r.method), ['GET', 'POST'])
    assert.equal(requests[0].path, '/v1/models')
    assert.equal(requests[1].body.model, 'custom-model')
    assert.equal(requests[1].headers[provider === 'openai' ? 'authorization' : 'x-api-key'], provider === 'openai' ? 'Bearer test-key' : 'test-key')
  })
  test(`${provider}: truncated responses are not returned as complete suggestions`, async t => {
    const { adapter, options } = await localProvider(t, provider, false)
    await assert.rejects(adapter.execute('Check my paper', options), /incomplete/)
  })
}
