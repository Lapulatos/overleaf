import { useEffect, useRef, useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
export type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

export function VoiceInput({
  disabled,
  onInsert,
}: {
  disabled: boolean
  onInsert: (text: string) => boolean
}) {
  const browser = window as SpeechWindow
  const Constructor =
    browser.SpeechRecognition || browser.webkitSpeechRecognition
  const session = useRef<Recognition | null>(null)
  const [active, setActive] = useState(false)
  const [language, setLanguage] = useState('en-US')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => {
      const current = session.current
      session.current = null
      current?.abort()
      setActive(false)
      setInterim('')
      setError(
        'Dictation stopped after one minute. Review the captured text, or try again if the speech service did not respond.'
      )
    }, 60000)
    return () => clearTimeout(timer)
  }, [active])

  useEffect(() => {
    if (!disabled) return
    const current = session.current
    session.current = null
    current?.abort()
    setActive(false)
    setInterim('')
  }, [disabled])

  useEffect(
    () => () => {
      const current = session.current
      session.current = null
      current?.abort()
    },
    []
  )

  function start() {
    if (!Constructor || disabled || session.current) return
    setError('')
    setInterim('')
    let current: Recognition
    try {
      current = new Constructor()
    } catch {
      setError(
        'Speech recognition is unavailable. Type your instruction instead.'
      )
      return
    }
    session.current = current
    current.lang = language
    current.continuous = true
    current.interimResults = true
    const prefix = transcript.trim()
    current.onresult = (event) => {
      if (session.current !== current) return
      const results = Array.from(event.results)
      const final = results
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(' ')
      setTranscript([prefix, final].filter(Boolean).join(' '))
      setInterim(
        results
          .filter((result) => !result.isFinal)
          .map((result) => result[0].transcript)
          .join(' ')
      )
    }
    current.onend = () => {
      if (session.current !== current) return
      session.current = null
      setActive(false)
      setInterim('')
    }
    current.onerror = (event) => {
      if (session.current !== current) return
      session.current = null
      current.abort()
      setActive(false)
      setInterim('')
      const errors: Record<string, string> = {
        'not-allowed':
          'Microphone permission was denied. Allow microphone access in browser settings or type your instruction.',
        'service-not-allowed':
          'The browser speech service is unavailable. Type your instruction instead.',
        'audio-capture':
          'No microphone is available. Connect a microphone or type your instruction.',
        'no-speech':
          'No speech was detected. Try again or type your instruction.',
        network:
          'The speech service could not connect. Try again or type your instruction.',
      }
      setError(
        errors[event.error] ||
          'Speech recognition stopped. Review the captured text or try again.'
      )
    }
    try {
      setActive(true)
      current.start()
    } catch {
      session.current = null
      setActive(false)
      setError(
        'Speech recognition could not start. Check browser microphone permissions or type your instruction.'
      )
    }
  }

  if (!Constructor)
    return (
      <p>
        Voice input is unavailable in this browser. You can type your
        instruction above.
      </p>
    )

  return (
    <div style={{ marginTop: 12 }}>
      <p>
        Voice input uses your browser’s speech service, which may send audio to
        its provider. Review the text before sending.
      </p>
      <label htmlFor="assistant-voice-language">Voice language</label>
      <select
        id="assistant-voice-language"
        className="form-control"
        value={language}
        disabled={disabled || active}
        onChange={(event) => setLanguage(event.target.value)}
      >
        <option value="en-US">English</option>
        <option value="zh-CN">中文（普通话）</option>
      </select>
      <OLButton
        disabled={disabled}
        onClick={() => (active ? session.current?.stop() : start())}
      >
        {active ? 'Stop dictation' : 'Start dictation'}
      </OLButton>
      <p role="status">
        {active
          ? 'Listening… Stop dictation to edit and insert the text.'
          : 'Dictation is stopped.'}{' '}
        {interim}
      </p>
      <label htmlFor="assistant-voice-transcript">Voice transcript</label>
      <textarea
        id="assistant-voice-transcript"
        className="form-control"
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
          } else {
            setError(
              'The combined instruction exceeds 32,000 characters. Shorten the draft or transcript before inserting.'
            )
          }
        }}
      >
        Insert into instructions
      </OLButton>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
