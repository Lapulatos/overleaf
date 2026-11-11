import { Blob as NodeBlob, btoa as nodeBtoa } from 'node:buffer'
import { expect } from 'chai'
import sinon from 'sinon'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { LocalVoiceInput } from '@/features/source-editor/extensions/writing-assist/local-voice-input'

const endpoint = '/writing-assist/project/project/speech'
class FakeRecorder {
  static latest: FakeRecorder
  static isTypeSupported() {
    return true
  }
  mimeType = 'audio/webm;codecs=opus'
  state = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    FakeRecorder.latest = this
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])]),
    })
    this.onstop?.()
  }
}

describe('Local voice recording', function () {
  const originalBtoa = globalThis.btoa
  const originalBlob = globalThis.Blob
  const originalWindow = Object.getOwnPropertyDescriptor(
    window,
    'MediaRecorder'
  )
  const originalGlobal = Object.getOwnPropertyDescriptor(
    globalThis,
    'MediaRecorder'
  )
  const originalDevices = Object.getOwnPropertyDescriptor(
    navigator,
    'mediaDevices'
  )
  let stop: sinon.SinonSpy
  let getUserMedia: sinon.SinonStub
  beforeEach(function () {
    globalThis.btoa = nodeBtoa
    globalThis.Blob = NodeBlob as unknown as typeof Blob
    stop = sinon.spy()
    getUserMedia = sinon.stub().resolves({ getTracks: () => [{ stop }] })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: FakeRecorder,
    })
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: FakeRecorder,
    })
  })
  afterEach(function () {
    globalThis.btoa = originalBtoa
    globalThis.Blob = originalBlob
    cleanup()
    fetchMock.removeRoutes().clearHistory()
    for (const [object, key, descriptor] of [
      [window, 'MediaRecorder', originalWindow],
      [globalThis, 'MediaRecorder', originalGlobal],
      [navigator, 'mediaDevices', originalDevices],
    ] as const) {
      if (descriptor) Object.defineProperty(object, key, descriptor)
      else Reflect.deleteProperty(object, key)
    }
  })
  it('records, transcribes, preserves editing and requires explicit insertion', async function () {
    fetchMock.post(endpoint, {
      text: 'Preserve equations.',
      language: 'en',
      duration: 1,
    })
    const insert = sinon.stub().returns(true)
    render(
      <LocalVoiceInput disabled={false} onInsert={insert} endpoint={endpoint} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Record instruction' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Stop and transcribe' })
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Recorded transcript')).to.have.property(
        'value',
        'Preserve equations.'
      )
    )
    expect(stop.called).to.equal(true)
    expect(insert.called).to.equal(false)
    const body = JSON.parse(
      fetchMock.callHistory.calls(endpoint)[0].options.body as string
    )
    expect(body.mime).to.equal('audio/webm')
    expect(body.language).to.equal('en')
    fireEvent.change(screen.getByLabelText('Recorded transcript'), {
      target: { value: 'Preserve all equations.' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Insert recorded text' })
    )
    expect(insert.calledOnceWithExactly('Preserve all equations.')).to.equal(
      true
    )
  })
  it('releases a stream returned after cancellation without uploading audio', async function () {
    let resolve!: (value: unknown) => void
    getUserMedia.returns(
      new Promise((done) => {
        resolve = done
      })
    )
    render(
      <LocalVoiceInput
        disabled={false}
        onInsert={() => true}
        endpoint={endpoint}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Record instruction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel recording' }))
    await act(async () => {
      resolve({ getTracks: () => [{ stop }] })
    })
    expect(stop.calledOnce).to.equal(true)
    expect(fetchMock.callHistory.calls()).to.have.length(0)
  })
  it('reports denied microphone permission without sending a request', async function () {
    getUserMedia.rejects(new DOMException('Denied', 'NotAllowedError'))
    render(
      <LocalVoiceInput
        disabled={false}
        onInsert={() => true}
        endpoint={endpoint}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Record instruction' }))
    expect((await screen.findByRole('alert')).textContent).to.contain(
      'permission was denied'
    )
    expect(fetchMock.callHistory.calls()).to.have.length(0)
  })
  it('unmounting stops an active recording without uploading it', async function () {
    const view = render(
      <LocalVoiceInput
        disabled={false}
        onInsert={() => true}
        endpoint={endpoint}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Record instruction' }))
    await screen.findByRole('button', { name: 'Stop and transcribe' })
    view.unmount()
    expect(stop.called).to.equal(true)
    expect(fetchMock.callHistory.calls()).to.have.length(0)
  })
})
