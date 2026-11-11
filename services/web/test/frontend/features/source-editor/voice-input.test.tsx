import { expect } from 'chai'
import sinon from 'sinon'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  VoiceInput,
  type Recognition,
} from '@/features/source-editor/extensions/writing-assist/voice-input'

class FakeRecognition implements Recognition {
  static latest: FakeRecognition
  lang = ''
  continuous = false
  interimResults = false
  onresult: Recognition['onresult'] = null
  onerror: Recognition['onerror'] = null
  onend: Recognition['onend'] = null
  start = sinon.spy()
  stop = sinon.spy(() => this.onend?.())
  abort = sinon.spy()
  constructor() {
    FakeRecognition.latest = this
  }
}

describe('Paper Assistant voice input', function () {
  beforeEach(function () {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: FakeRecognition,
    })
  })
  afterEach(function () {
    cleanup()
    Reflect.deleteProperty(window, 'SpeechRecognition')
  })

  it('deduplicates final results, allows editing, and requires explicit insertion', function () {
    const insert = sinon.stub().returns(true)
    render(<VoiceInput disabled={false} onInsert={insert} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }))
    const current = FakeRecognition.latest
    const event = {
      results: [
        { isFinal: true, 0: { transcript: 'Improve this paragraph.' } },
      ],
    }
    act(() => current.onresult?.(event))
    act(() => current.onresult?.(event))
    expect(insert.called).to.equal(false)
    fireEvent.click(screen.getByRole('button', { name: 'Stop dictation' }))
    const input = screen.getByLabelText(
      'Voice transcript'
    ) as HTMLTextAreaElement
    expect(input.value).to.equal('Improve this paragraph.')
    fireEvent.change(input, { target: { value: 'Improve the abstract.' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Insert into instructions' })
    )
    expect(insert.calledOnceWithExactly('Improve the abstract.')).to.equal(true)
    expect(input.value).to.equal('')
  })

  it('reports permission denial and ignores late results', function () {
    render(<VoiceInput disabled={false} onInsert={() => true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }))
    const current = FakeRecognition.latest
    act(() => current.onerror?.({ error: 'not-allowed' }))
    expect(screen.getByRole('alert').textContent).to.contain(
      'permission was denied'
    )
    act(() =>
      current.onresult?.({
        results: [{ isFinal: true, 0: { transcript: 'late' } }],
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }))
    expect(screen.getByLabelText('Voice transcript')).to.have.property(
      'value',
      ''
    )
    expect(current.abort.calledOnce).to.equal(true)
  })

  it('aborts on unmount and does not insert late speech', function () {
    const insert = sinon.stub().returns(true)
    const view = render(<VoiceInput disabled={false} onInsert={insert} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }))
    const current = FakeRecognition.latest
    view.unmount()
    act(() =>
      current.onresult?.({
        results: [{ isFinal: true, 0: { transcript: 'late' } }],
      })
    )
    expect(current.abort.calledOnce).to.equal(true)
    expect(insert.called).to.equal(false)
  })

  it('aborts when a task disables input and ignores a late result', function () {
    const insert = sinon.stub().returns(true)
    const view = render(<VoiceInput disabled={false} onInsert={insert} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }))
    const current = FakeRecognition.latest
    view.rerender(<VoiceInput disabled onInsert={insert} />)
    act(() =>
      current.onresult?.({
        results: [{ isFinal: true, 0: { transcript: 'late' } }],
      })
    )
    expect(current.abort.calledOnce).to.equal(true)
    expect(screen.getByLabelText('Voice transcript')).to.have.property(
      'value',
      ''
    )
    expect(insert.called).to.equal(false)
  })

  it('stops a speech service that never returns and preserves captured text', function () {
    const clock = sinon.useFakeTimers()
    try {
      render(<VoiceInput disabled={false} onInsert={() => true} />)
      fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }))
      const current = FakeRecognition.latest
      act(() =>
        current.onresult?.({
          results: [{ isFinal: true, 0: { transcript: 'Keep this text.' } }],
        })
      )
      act(() => clock.tick(60000))
      expect(current.abort.calledOnce).to.equal(true)
      expect(screen.getByRole('alert').textContent).to.contain('one minute')
      expect(screen.getByLabelText('Voice transcript')).to.have.property(
        'value',
        'Keep this text.'
      )
      expect(screen.getByRole('button', { name: 'Start dictation' })).to.exist
    } finally {
      clock.restore()
    }
  })

  it('preserves the transcript when the instruction is full', function () {
    render(<VoiceInput disabled={false} onInsert={() => false} />)
    fireEvent.change(screen.getByLabelText('Voice transcript'), {
      target: { value: 'Keep this text' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Insert into instructions' })
    )
    expect(screen.getByLabelText('Voice transcript')).to.have.property(
      'value',
      'Keep this text'
    )
    expect(screen.getByRole('alert').textContent).to.contain('32,000')
  })

  it('shows a typing fallback when recognition is unavailable', function () {
    Reflect.deleteProperty(window, 'SpeechRecognition')
    render(<VoiceInput disabled={false} onInsert={() => true} />)
    expect(screen.getByText(/Voice input is unavailable/)).to.exist
    expect(screen.queryByRole('button', { name: 'Start dictation' })).to.equal(
      null
    )
  })
})
