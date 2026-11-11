import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateAudio } from '../../../libraries/validation-tools/audio-input.mjs'

function failure(status, message) {
  return Object.assign(new Error(message), { status })
}

export function createSpeechService({
  python,
  model,
  workerPath = fileURLToPath(
    new URL('../speech/transcribe.py', import.meta.url)
  ),
  timeoutMs = 120000,
}) {
  let busy = false
  return {
    configured: Boolean(python && model),
    async transcribe(input, signal) {
      if (!python || !model)
        throw failure(503, 'Local transcription is not configured')
      let audio
      try {
        audio = validateAudio(input)
      } catch (error) {
        throw failure(400, error.message)
      }
      if (busy)
        throw failure(
          429,
          'A transcription is already running; try again shortly'
        )
      if (signal?.aborted) throw failure(499, 'Transcription cancelled')
      busy = true
      let directory
      try {
        directory = await mkdtemp(join(tmpdir(), 'overleaf-agent-audio-'))
        const path = join(directory, 'recording')
        await writeFile(path, Buffer.from(audio.data, 'base64'), {
          mode: 0o600,
          flag: 'wx',
        })
        const combined = signal
          ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs)
        if (combined.aborted) throw failure(499, 'Transcription cancelled')
        const output = await new Promise((resolve, reject) => {
          const child = spawn(
            python,
            [
              workerPath,
              '--model',
              model,
              '--audio',
              path,
              '--language',
              audio.language,
            ],
            { stdio: ['ignore', 'pipe', 'ignore'] }
          )
          let text = ''
          let oversized = false
          const abort = () => child.kill('SIGKILL')
          combined.addEventListener('abort', abort, { once: true })
          if (combined.aborted) abort()
          child.stdout.setEncoding('utf8')
          child.stdout.on('data', (chunk) => {
            if (oversized) return
            text += chunk.toString('utf8')
            if (Buffer.byteLength(text) > 128000) {
              oversized = true
              child.kill('SIGKILL')
            }
          })
          child.on('error', () => {
            /* close follows error; cleanup waits for it */
          })
          child.on('close', (code) => {
            combined.removeEventListener('abort', abort)
            if (combined.aborted)
              return reject(
                failure(
                  signal?.aborted ? 499 : 504,
                  signal?.aborted
                    ? 'Transcription cancelled'
                    : 'Transcription timed out'
                )
              )
            if (code !== 0 || oversized)
              return reject(
                failure(
                  422,
                  'Audio could not be transcribed within supported limits'
                )
              )
            resolve(text)
          })
        })
        let result
        try {
          result = JSON.parse(output)
        } catch {
          throw failure(502, 'Transcription returned an invalid result')
        }
        if (
          typeof result.text !== 'string' ||
          result.text.length > 32000 ||
          result.language !== audio.language ||
          !Number.isFinite(result.duration) ||
          result.duration <= 0 ||
          result.duration > 60
        ) {
          throw failure(502, 'Transcription returned an invalid result')
        }
        return {
          text: result.text.trim(),
          language: result.language,
          duration: result.duration,
        }
      } finally {
        try {
          if (directory) await rm(directory, { recursive: true, force: true })
        } finally {
          busy = false
        }
      }
    },
  }
}
