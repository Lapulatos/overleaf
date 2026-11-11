import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindCancellation } from '../src/backends/utils.mjs'

test('cancellation terminates a running CLI subprocess', async t => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'])
  t.after(() => child.kill('SIGKILL'))
  const controller = new AbortController()
  bindCancellation(child, controller.signal)
  const closed = once(child, 'close')
  controller.abort()
  const [code, signal] = await closed
  assert.equal(code, null)
  assert.equal(signal, 'SIGTERM')
})
