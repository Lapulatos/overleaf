import { useEffect, useRef, useState } from 'react'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import OLButton from '@/shared/components/ol/ol-button'
import { VoiceInput } from './voice-input'
import { message } from './agent-task-result'

type Props = { disabled: boolean; onInsert: (text: string) => boolean }
type Recording = {
  controller: AbortController
  stream?: MediaStream
  recorder?: MediaRecorder
  timer?: ReturnType<typeof setTimeout>
}

function release(current: Recording) {
  clearTimeout(current.timer)
  current.stream?.getTracks().forEach((track) => track.stop())
}

export function LocalVoiceInput({
  disabled,
  onInsert,
  endpoint,
}: Props & { endpoint: string }) {
  const session = useRef<Recording | null>(null)
  const [phase, setPhase] = useState<
    'idle' | 'requesting' | 'recording' | 'transcribing'
  >('idle')
  const [language, setLanguage] = useState('en')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const supported = Boolean(
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  )

  function cancel() {
    const current = session.current
    session.current = null
    if (current) {
      current.controller.abort()
      if (current.recorder?.state === 'recording') current.recorder.stop()
      release(current)
    }
  }
  useEffect(() => () => cancel(), [])
  useEffect(() => {
    if (disabled) {
      cancel()
      setPhase('idle')
    }
  }, [disabled])

  async function start() {
    if (disabled || session.current) return
    const current: Recording = { controller: new AbortController() }
    session.current = current
    setError('')
    setPhase('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      current.stream = stream
      if (session.current !== current) {
        release(current)
        return
      }
      const mime = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((value) => MediaRecorder.isTypeSupported(value))
      if (!mime)
        throw new Error('This browser cannot record a supported audio format.')
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 64000,
      })
      current.recorder = recorder
      const chunks: Blob[] = []
      let size = 0
      recorder.ondataavailable = (event) => {
        if (session.current !== current || !event.data.size) return
        size += event.data.size
        if (size > 2 * 1024 * 1024) {
          cancel()
          setPhase('idle')
          setError('Recording exceeds 2 MiB. Try a shorter recording.')
          return
        }
        chunks.push(event.data)
      }
      recorder.onerror = () => {
        if (session.current !== current) return
        cancel()
        setPhase('idle')
        setError(
          'Microphone recording failed. Try again or type your instruction.'
        )
      }
      recorder.onstop = async () => {
        release(current)
        if (session.current !== current) return
        setPhase('transcribing')
        try {
          const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
          if (session.current !== current) return
          if (!bytes.length)
            throw new Error('No audio was recorded. Try again.')
          const parts: string[] = []
          for (let i = 0; i < bytes.length; i += 8192)
            parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
          const result = await postJSON<{ text: string }>(endpoint, {
            body: {
              data: btoa(parts.join('')),
              mime: recorder.mimeType.split(';')[0],
              language,
            },
            signal: current.controller.signal,
          })
          if (session.current !== current) return
          if (!result?.text?.trim())
            setError(
              'No speech was recognized. Try again or type your instruction.'
            )
          else
            setTranscript((previous) =>
              [previous, result.text.trim()].filter(Boolean).join('\n')
            )
        } catch (error) {
          if (session.current === current) setError(message(error))
        } finally {
          if (session.current === current) {
            session.current = null
            setPhase('idle')
          }
        }
      }
      recorder.start(1000)
      setPhase('recording')
      current.timer = setTimeout(() => {
        if (session.current === current && recorder.state === 'recording')
          recorder.stop()
      }, 59000)
    } catch (error) {
      if (session.current !== current) return
      cancel()
      setPhase('idle')
      setError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access or type your instruction.'
          : message(error)
      )
    }
  }

  if (!supported)
    return (
      <p>
        This browser cannot record audio here. Use HTTPS or localhost with a
        microphone-capable browser, or type your instruction.
      </p>
    )
  const active = phase !== 'idle'
  return (
    <div>
      <p>
        Record up to 59 seconds. Audio is transcribed by the configured local
        agent and removed afterward. Review the text before sending.
      </p>
      <label htmlFor="local-voice-language">Recording language</label>
      <select
        id="local-voice-language"
        className="form-control"
        disabled={disabled || active}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      >
        <option value="en">English</option>
        <option value="zh">中文（普通话）</option>
      </select>
      <OLButton
        disabled={disabled || (active && phase !== 'recording')}
        onClick={() =>
          phase === 'recording'
            ? session.current?.recorder?.state === 'recording' &&
              session.current.recorder.stop()
            : start()
        }
      >
        {phase === 'recording' ? 'Stop and transcribe' : 'Record instruction'}
      </OLButton>
      {active && (
        <OLButton
          onClick={() => {
            cancel()
            setPhase('idle')
          }}
        >
          Cancel recording
        </OLButton>
      )}
      <p role="status">
        {phase === 'requesting'
          ? 'Waiting for microphone permission…'
          : phase === 'recording'
            ? 'Recording…'
            : phase === 'transcribing'
              ? 'Transcribing…'
              : 'Recording is stopped.'}
      </p>
      <label htmlFor="local-voice-transcript">Recorded transcript</label>
      <textarea
        id="local-voice-transcript"
        className="form-control"
        rows={3}
        value={transcript}
        maxLength={32000}
        disabled={disabled || active}
        onChange={(event) => setTranscript(event.target.value)}
      />
      <OLButton
        disabled={disabled || active || !transcript.trim()}
        onClick={() => {
          if (onInsert(transcript.trim())) {
            setTranscript('')
            setError('')
          } else
            setError(
              'The combined instruction exceeds 32,000 characters. Shorten the draft or transcript before inserting.'
            )
        }}
      >
        Insert recorded text
      </OLButton>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export function PaperVoiceInput({
  projectId,
  ...props
}: Props & { projectId: string }) {
  const endpoint = `/writing-assist/project/${encodeURIComponent(projectId)}/speech`
  const [available, setAvailable] = useState(false)
  const [local, setLocal] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    getJSON<{ available: boolean }>(endpoint, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setAvailable(value?.available === true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false)
      })
    return () => controller.abort()
  }, [endpoint])
  return (
    <div>
      {available && (
        <>
          <label htmlFor="voice-recognition-service">
            Voice recognition service
          </label>
          <select
            id="voice-recognition-service"
            className="form-control"
            value={local ? 'local' : 'browser'}
            disabled={props.disabled}
            onChange={(event) => setLocal(event.target.value === 'local')}
          >
            <option value="browser">Browser speech service</option>
            <option value="local">Local agent transcription</option>
          </select>
          <p>Switching services clears the uninserted transcript.</p>
        </>
      )}
      {local && available ? (
        <LocalVoiceInput {...props} endpoint={endpoint} />
      ) : (
        <VoiceInput {...props} />
      )}
    </div>
  )
}
