import { expect } from 'chai'
import sinon from 'sinon'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { transformRunner } from '@/features/source-editor/extensions/writing-assist-transform/transform-runner'
import { transformPreviewField } from '@/features/source-editor/extensions/writing-assist-transform/preview'
import {
  requestTransformEffect,
  setTransformPreviewEffect,
  rejectTransformEffect,
} from '@/features/source-editor/extensions/writing-assist-transform/effects'

describe('Selection transform stale-result protection', function () {
  let view: EditorView
  afterEach(function () {
    view?.destroy()
    sinon.restore()
    fetchMock.removeRoutes().clearHistory()
  })
  function createView() {
    view = new EditorView({
      state: EditorState.create({
        doc: 'They is ready.',
        extensions: [transformPreviewField, transformRunner('project')],
      }),
    })
    // JSDOM has no text layout; these tests verify state, not tooltip geometry.
    sinon.stub(view, 'coordsAtPos').returns(null)
  }

  it('removes a displayed proposal when the manuscript changes', function () {
    createView()
    view.dispatch({
      effects: setTransformPreviewEffect.of({
        from: 0,
        to: 14,
        original: 'They is ready.',
        suggested: 'They are ready.',
        action: 'polish',
      }),
    })
    expect(view.state.field(transformPreviewField)).not.to.equal(null)
    view.dispatch({ changes: { from: 0, to: 4, insert: 'She' } })
    expect(view.state.field(transformPreviewField)).to.equal(null)
    expect(view.state.doc.toString()).to.equal('She is ready.')
  })

  for (const event of ['edit', 'cancel']) {
    it(`ignores a delayed response after ${event}`, async function () {
      let complete!: (value: { result: string }) => void
      fetchMock.post(
        '/writing-assist/transform',
        () =>
          new Promise<{ result: string }>((resolve) => {
            complete = resolve
          })
      )
      createView()
      view.dispatch({
        effects: requestTransformEffect.of({
          from: 0,
          to: 14,
          action: 'polish',
        }),
      })
      await waitFor(() => expect(complete).to.be.a('function'))
      if (event === 'edit')
        view.dispatch({ changes: { from: 0, to: 4, insert: 'She' } })
      else view.dispatch({ effects: rejectTransformEffect.of(null) })
      complete({ result: 'They are ready.' })
      await fetchMock.callHistory.flush(true)
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(view.state.field(transformPreviewField)).to.equal(null)
      expect(view.state.doc.toString()).to.equal(
        event === 'edit' ? 'She is ready.' : 'They is ready.'
      )
    })
  }
})
