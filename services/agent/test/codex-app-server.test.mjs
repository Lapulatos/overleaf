import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { createCodexAppServer } from '../src/codex-app-server.mjs'
function fakeProcess() {
  const proc = new EventEmitter()
  proc.stdin = new PassThrough(); proc.stdout = new PassThrough(); proc.stderr = new PassThrough()
  proc.kill = () => { queueMicrotask(() => proc.emit('close', 0)); return true }
  const sent = []
  proc.stdin.on('data', bytes => {
    const msg = JSON.parse(bytes.toString()); sent.push(msg)
    if (msg.method === 'initialize') queueMicrotask(() => proc.stdout.write(JSON.stringify({ id: msg.id, result: {} }) + '\n'))
  })
  return { proc, sent }
}
test('correlates out-of-order responses and accepts fragmented UTF8 events', async () => {
  const { proc, sent } = fakeProcess(); const events = []
  const client = await createCodexAppServer({ spawnProcess: () => proc, onNotification: (...event) => events.push(event) })
  try {
    const a = client.request('a'), b = client.request('b')
    const ai = sent.find(m => m.method === 'a').id, bi = sent.find(m => m.method === 'b').id
    proc.stdout.write(JSON.stringify({ id: bi, result: 2 }) + '\n'); proc.stdout.write(JSON.stringify({ id: ai, result: 1 }) + '\n')
    assert.deepEqual(await Promise.all([a,b]), [1,2])
    const data = Buffer.from(JSON.stringify({ method: 'progress', params: { text: '论文' } }) + '\n')
    for (const byte of data) proc.stdout.write(Buffer.from([byte]))
    assert.equal(events[0][1].text, '论文')
  } finally { await client.close() }
})
test('unsupported server requests fail closed and do not grant approval', async () => {
  const { proc, sent } = fakeProcess(); const client = await createCodexAppServer({ spawnProcess: () => proc })
  proc.stdout.write(JSON.stringify({ id: 'approval', method: 'item/commandExecution/requestApproval', params: {} }) + '\n')
  assert.equal(sent.find(x => x.id === 'approval').error.code, -32601)
  await client.close()
})
test('timeout and shutdown reject outstanding calls without leaking server error text', async () => {
  const { proc, sent } = fakeProcess(); const client = await createCodexAppServer({ spawnProcess: () => proc, requestTimeout: 20 })
  await assert.rejects(() => client.request('slow'), /timed out/)
  const failed = client.request('bad'); const id = sent.find(x => x.method === 'bad').id
  proc.stdout.write(JSON.stringify({ id, error: { code: 42, message: 'private details' } }) + '\n')
  await assert.rejects(failed, error => !error.message.includes('private details') && error.message.includes('42'))
  const outstanding = client.request('pending'); const rejected = assert.rejects(outstanding, /closed/)
  await client.close(); await rejected
})
