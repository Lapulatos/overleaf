import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { createSpeechService } from '../src/speech-service.mjs'

const audio = {
  mime: 'audio/wav',
  language: 'en',
  data: Buffer.from('RIFF0000WAVE').toString('base64'),
}
async function setup(t, action, timeoutMs = 10000) {
  const dir = await mkdtemp(join(tmpdir(), 'overleaf-speech-worker-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const workerPath = join(dir, 'worker.mjs')
  const metadata = join(dir, 'metadata.json')
  await writeFile(
    workerPath,
    `import fs from 'node:fs'; const args=process.argv.slice(2); const get=name=>args[args.indexOf(name)+1]; const path=get('--audio'); fs.writeFileSync(get('--model'),JSON.stringify({path,mode:fs.statSync(path).mode & 0o777})); ${action}`
  )
  const service = createSpeechService({
    python: process.execPath,
    model: metadata,
    workerPath,
    timeoutMs,
  })
  return { service, metadata }
}
async function waitMetadata(path) {
  for (let i = 0; i < 200; i++) {
    try {
      return JSON.parse(await readFile(path, 'utf8'))
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  throw new Error('Worker did not start')
}
async function gone(path) {
  await assert.rejects(access(dirname(path)), { code: 'ENOENT' })
}

test('speech worker returns only transcript fields and removes private audio', async (t) => {
  const f = await setup(
    t,
    `console.log(JSON.stringify({text:' Example ',language:'en',duration:1,private:'ignored'}))`
  )
  assert.deepEqual(await f.service.transcribe(audio), {
    text: 'Example',
    language: 'en',
    duration: 1,
  })
  const metadata = await waitMetadata(f.metadata)
  assert.equal(metadata.mode, 0o600)
  await gone(metadata.path)
})

test('speech worker enforces admission, cancellation and cleanup', async (t) => {
  const f = await setup(t, 'setTimeout(()=>{},10000)')
  const controller = new AbortController()
  const job = f.service.transcribe(audio, controller.signal)
  const failure = assert.rejects(job, { status: 499 })
  const metadata = await waitMetadata(f.metadata)
  await assert.rejects(f.service.transcribe(audio), { status: 429 })
  controller.abort()
  await failure
  await gone(metadata.path)
})

test('speech worker enforces deadline and removes audio after termination', async (t) => {
  const f = await setup(t, 'setTimeout(()=>{},10000)', 300)
  await assert.rejects(f.service.transcribe(audio), { status: 504 })
  await gone((await waitMetadata(f.metadata)).path)
})

test('invalid worker result is rejected and audio is removed', async (t) => {
  const f = await setup(
    t,
    `console.log(JSON.stringify({text:'x',language:'en',duration:61}))`
  )
  await assert.rejects(f.service.transcribe(audio), { status: 502 })
  await gone((await waitMetadata(f.metadata)).path)
})

test('unconfigured transcription stays explicitly unavailable', async () => {
  const service = createSpeechService({})
  assert.equal(service.configured, false)
  await assert.rejects(service.transcribe(audio), { status: 503 })
})
