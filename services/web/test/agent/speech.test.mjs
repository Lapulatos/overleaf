import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSpeechProxy } from '../../app/src/Features/WritingAssist/WritingAssistSpeechService.mjs'
const audio = {
  mime: 'audio/wav',
  language: 'en',
  data: Buffer.from('RIFF0000WAVE').toString('base64'),
}
function fixture(
  response = { text: 'Example', language: 'en', duration: 1 },
  status = 200
) {
  const calls = []
  const proxy = createSpeechProxy({
    canWrite: async (user) => user === 'owner',
    configuration: () => ({
      agentEndpoint: 'http://127.0.0.1:47291',
      agentToken: 'private-token',
    }),
    fetcher: async (...args) => {
      calls.push(args)
      return new Response(JSON.stringify(response), { status })
    },
  })
  return { proxy, calls }
}
test('speech proxy checks project permissions before sending recording or probing capabilities', async () => {
  const f = fixture()
  await assert.rejects(f.proxy.transcribe('other', 'p', audio), { status: 403 })
  await assert.rejects(f.proxy.capabilities('other', 'p'), { status: 403 })
  assert.equal(f.calls.length, 0)
})
test('speech proxy sends credentials only to configured daemon and strips extraneous input/output', async () => {
  const f = fixture({
    text: 'Example',
    language: 'en',
    duration: 1,
    private: 'ignored',
  })
  assert.deepEqual(
    await f.proxy.transcribe('owner', 'p', { ...audio, projectId: 'injected' }),
    { text: 'Example', language: 'en', duration: 1 }
  )
  assert.equal(f.calls[0][0], 'http://127.0.0.1:47291/agent/transcribe')
  assert.equal(f.calls[0][1].headers['X-Agent-Token'], 'private-token')
  assert.equal(f.calls[0][1].redirect, 'error')
  assert.deepEqual(JSON.parse(f.calls[0][1].body), audio)
})
test('speech proxy rejects invalid audio before contacting daemon', async () => {
  const f = fixture()
  await assert.rejects(
    f.proxy.transcribe('owner', 'p', { ...audio, data: 'invalid' }),
    { status: 400 }
  )
  assert.equal(f.calls.length, 0)
})
test('speech proxy maps daemon errors without exposing provider details', async () => {
  const f = fixture({ error: 'private-token internal server path' }, 429)
  await assert.rejects(
    f.proxy.transcribe('owner', 'p', audio),
    (error) => error.status === 429 && !error.message.includes('private-token')
  )
  const wrong = fixture({ text: 'Example', language: 'zh', duration: 1 })
  await assert.rejects(wrong.proxy.transcribe('owner', 'p', audio), {
    status: 502,
  })
})
test('speech capability exposes only availability', async () => {
  const f = fixture({ capabilities: { speech: true }, private: 'ignore' })
  assert.deepEqual(await f.proxy.capabilities('owner', 'p'), {
    available: true,
  })
})
