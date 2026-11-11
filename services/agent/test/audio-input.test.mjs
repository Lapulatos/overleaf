import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAudio } from '../../../libraries/validation-tools/audio-input.mjs'

const wav = Buffer.from('RIFF0000WAVE').toString('base64')
const valid = { mime: 'audio/wav', language: 'en', data: wav }
test('audio transport retains only normalized recording fields', () => {
  assert.deepEqual(
    validateAudio({ ...valid, path: '/tmp/untrusted', name: 'ignored' }),
    valid
  )
})
test('audio transport rejects mismatched formats and unsupported languages', () => {
  assert.throws(
    () => validateAudio({ ...valid, mime: 'audio/webm' }),
    /declared format/
  )
  assert.throws(() => validateAudio({ ...valid, mime: 'text/plain' }), /WebM/)
  assert.throws(
    () => validateAudio({ ...valid, language: 'auto' }),
    /English or Mandarin/
  )
})
test('audio transport rejects oversize and noncanonical data before inference', () => {
  assert.throws(
    () => validateAudio({ ...valid, data: 'A'.repeat(3 * 1024 * 1024) }),
    /2 MiB/
  )
  assert.throws(() => validateAudio({ ...valid, data: wav + '\n' }), /base64/)
  assert.throws(() => validateAudio(null), /required/)
})
