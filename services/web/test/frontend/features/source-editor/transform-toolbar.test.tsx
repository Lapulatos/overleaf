import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { TransformToolbar } from '@/features/source-editor/extensions/writing-assist-transform/toolbar-react'
import { requestTransformEffect } from '@/features/source-editor/extensions/writing-assist-transform/effects'

describe('Selection writing toolbar', function () {
  let view: EditorView
  let actions: unknown[]
  beforeEach(function () {
    actions = []
    view = new EditorView({ state: EditorState.create({ doc: 'Selected sentence.', selection: { anchor: 0, head: 18 }, extensions: [EditorView.updateListener.of(update => {
      for (const tr of update.transactions) for (const effect of tr.effects) {
        if (effect.is(requestTransformEffect)) actions.push(effect.value)
      }
    })] }) })
    render(<TransformToolbar view={view} />)
    fireEvent.click(screen.getByTitle('AI 写作助手'))
  })
  afterEach(function () { cleanup(); view.destroy() })
  it('reveals one adjustment at a time without submitting a task', function () {
    expect(screen.queryAllByRole('slider')).to.have.length(0)
    fireEvent.click(screen.getByRole('button', { name: '改写' }))
    expect(screen.getByRole('slider', { name: '保留原文程度' })).to.exist
    fireEvent.click(screen.getByRole('button', { name: '扩写' }))
    expect(screen.queryAllByRole('slider')).to.have.length(1)
    expect(screen.getByRole('slider', { name: '增加篇幅' })).to.exist
    fireEvent.click(screen.getByRole('button', { name: '翻译' }))
    expect(screen.queryAllByRole('slider')).to.have.length(0)
    expect(screen.getByRole('button', { name: 'English' })).to.exist
    expect(actions).to.have.length(0)
  })
  it('keeps length-ratio semantics and the selected source range', function () {
    fireEvent.click(screen.getByRole('button', { name: '缩写' }))
    fireEvent.change(screen.getByRole('slider', { name: '减少篇幅' }), { target: { value: '-0.5' } })
    fireEvent.click(screen.getByRole('button', { name: '开始缩写' }))
    expect(actions).to.have.length(1)
    expect(actions[0]).to.include({ from: 0, to: 18, action: 'condense', lengthRatio: -0.5 })
  })
  it('Escape from a secondary control closes the menu without changing text', function () {
    fireEvent.click(screen.getByRole('button', { name: '改写' }))
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).to.equal(null)
    expect(actions).to.have.length(0)
    expect(view.state.doc.toString()).to.equal('Selected sentence.')
  })
})
