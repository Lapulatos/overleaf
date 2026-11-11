import { expect } from 'chai'
import { fireEvent, waitFor, within } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history, undo } from '@codemirror/commands'
import { transformPreviewField } from '@/features/source-editor/extensions/writing-assist-transform/preview'
import { setTransformPreviewEffect } from '@/features/source-editor/extensions/writing-assist-transform/effects'

describe('Source-position selection review', function () {
  let view: EditorView
  let parent: HTMLDivElement
  const original = 'Before\nThey is ready.\nAfter'
  beforeEach(function () {
    parent = document.createElement('div'); document.body.append(parent)
    view = new EditorView({ parent, state: EditorState.create({ doc: original, extensions: [history(), transformPreviewField] }) })
    view.dispatch({ effects: setTransformPreviewEffect.of({ from: 7, to: 21, original: 'They is ready.', suggested: 'They are ready.', action: 'polish' }) })
  })
  afterEach(async function () { view.destroy(); await Promise.resolve(); parent.remove() })
  it('renders an inline diff while the original document remains unchanged', async function () {
    await waitFor(() => expect(parent.querySelector('.paper-diff-added')).not.to.equal(null))
    expect(parent.querySelector('.wa-transform-inline-review')?.closest('.cm-content')).not.to.equal(null)
    expect(parent.querySelector('.wa-transform-source-under-review')).not.to.equal(null)
    expect(parent.querySelector('.wa-transform-preview-tooltip')).to.equal(null)
    expect(view.state.doc.toString()).to.equal(original)
    fireEvent.click(within(parent).getByRole('button', { name: '拒绝' }))
    expect(view.state.doc.toString()).to.equal(original)
    expect(view.state.field(transformPreviewField)).to.equal(null)
  })
  it('unmounts a reused widget after a selection-only transaction', async function () {
    await within(parent).findByRole('button', { name: '拒绝' })
    const widget = parent.querySelector('.wa-transform-inline-review')!
    view.dispatch({ selection: { anchor: 0 } })
    expect(parent.querySelector('.wa-transform-inline-review')).to.equal(widget)
    fireEvent.click(within(parent).getByRole('button', { name: '拒绝' }))
    await waitFor(() => expect(widget.childElementCount).to.equal(0))
  })
  it('accepts only the selected text and native Undo restores the original', async function () {
    const accept = await within(parent).findByRole('button', { name: '接受' })
    fireEvent.click(accept)
    expect(view.state.doc.toString()).to.equal('Before\nThey are ready.\nAfter')
    expect(view.state.field(transformPreviewField)).to.equal(null)
    expect(undo(view)).to.equal(true)
    expect(view.state.doc.toString()).to.equal(original)
  })
  it('removes the inline review after another edit and rejects a stale click', async function () {
    const accept = await within(parent).findByRole('button', { name: '接受' })
    view.dispatch({ changes: { from: 7, to: 11, insert: 'She' } })
    expect(view.state.field(transformPreviewField)).to.equal(null)
    fireEvent.click(accept)
    expect(view.state.doc.toString()).to.equal('Before\nShe is ready.\nAfter')
    expect(parent.querySelector('.wa-transform-inline-review')).to.equal(null)
  })
})
