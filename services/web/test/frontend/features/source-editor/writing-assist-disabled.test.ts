import { expect } from 'chai'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import fetchMock from 'fetch-mock'
import { writingAssist } from '@/features/source-editor/extensions/writing-assist'
import { requestCheckEffect } from '@/features/source-editor/extensions/writing-assist/effects'
import { DEFAULT_CONFIG } from '../../../../types/writing-assist'

describe('Writing Assist saved disabled setting', function () {
  let view: EditorView
  afterEach(function () {
    view?.destroy()
    fetchMock.removeRoutes().clearHistory()
  })
  it('does not launch checks using defaults before the saved configuration loads', async function () {
    let resolveConfig!: (value: typeof DEFAULT_CONFIG) => void
    fetchMock.get('/writing-assist/config', () => new Promise<typeof DEFAULT_CONFIG>(resolve => { resolveConfig = resolve }))
    fetchMock.get('begin:/writing-assist/dismissals?', { items: [] })
    fetchMock.post('/writing-assist/check', { issues: [] })
    view = new EditorView({ state: EditorState.create({ doc: 'They is ready.', extensions: [writingAssist({ projectId: 'disabled-test', config: DEFAULT_CONFIG })] }) })
    // Cover both the initial-check delay and its debounce timer.
    await new Promise(resolve => setTimeout(resolve, 2300))
    expect(fetchMock.callHistory.calls('/writing-assist/check')).to.have.length(0)
    resolveConfig({ ...DEFAULT_CONFIG, enabled: false })
    await fetchMock.callHistory.flush(true)
    view.dispatch({ changes: { from: 0, to: 4, insert: 'She' } })
    await new Promise(resolve => setTimeout(resolve, 1700))
    expect(fetchMock.callHistory.calls('/writing-assist/check')).to.have.length(0)
  })
  it('suppresses readonly checks and restores the manual control when editable', async function () {
    fetchMock.get('/writing-assist/config', { ...DEFAULT_CONFIG, enabled: true })
    fetchMock.get('begin:/writing-assist/dismissals?', { items: [] })
    fetchMock.post('/writing-assist/check', { issues: [] })
    const permission = new Compartment()
    view = new EditorView({
      state: EditorState.create({
        doc: 'They is ready.',
        extensions: [
          permission.of(EditorState.readOnly.of(true)),
          writingAssist({ projectId: 'readonly-test', config: DEFAULT_CONFIG }),
        ],
      }),
    })
    await fetchMock.callHistory.flush(true)
    view.dispatch({ effects: requestCheckEffect.of(null) })
    await new Promise(resolve => setTimeout(resolve, 2300))
    expect(fetchMock.callHistory.calls('/writing-assist/check')).to.have.length(0)
    const button = view.dom.querySelector<HTMLButtonElement>('button[title^="立即检查"]')!
    expect(button.parentElement!.style.display).to.equal('none')
    view.dispatch({ effects: permission.reconfigure(EditorState.readOnly.of(false)) })
    expect(button.parentElement!.style.display).to.equal('inline-flex')
    view.dispatch({ effects: requestCheckEffect.of(null) })
    await new Promise(resolve => setTimeout(resolve, 200))
    await fetchMock.callHistory.flush(true)
    expect(fetchMock.callHistory.calls('/writing-assist/check').length).to.be.greaterThan(0)
  })

})
