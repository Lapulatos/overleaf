import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { withResponseCancellation, withWritingErrors } from '../../app/src/Features/WritingAssist/WritingAssistCancellation.mjs'

test('closing the HTTP response aborts pending model work and releases its listener', async () => {
  const response = new EventEmitter()
  let signal
  const request = withResponseCancellation(response, (value) => {
    signal = value
    return new Promise((resolve) =>
      value.addEventListener('abort', () => resolve('cancelled'), {
        once: true,
      })
    )
  })
  assert.equal(signal.aborted, false)
  response.emit('close')
  assert.equal(await request, 'cancelled')
  assert.equal(signal.aborted, true)
  assert.equal(response.listenerCount('close'), 0)
})

test('normal completion removes close listener without aborting successful work', async () => {
  const response = new EventEmitter()
  let signal
  assert.equal(
    await withResponseCancellation(response, (value) => {
      signal = value
      return 'done'
    }),
    'done'
  )
  response.emit('close')
  assert.equal(signal.aborted, false)
  assert.equal(response.listenerCount('close'), 0)
})


test('known provider failures retain HTTP status and hide arbitrary upstream text', async () => {
  let status, body
  const response = { status(value) { status = value; return this }, json(value) { body = value } }
  await withWritingErrors(async () => { throw Object.assign(new Error('private upstream detail'), { statusCode: 429 }) })({}, response)
  assert.equal(status, 429)
  assert.deepEqual(body, { message: 'Local agent is busy; try again shortly' })
})
