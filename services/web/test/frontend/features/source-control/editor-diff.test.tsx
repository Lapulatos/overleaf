import { EditorView } from '@codemirror/view'
import { cursorCharRight, insertNewline } from '@codemirror/commands'
import { expect } from 'chai'
import sinon from 'sinon'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { EditorDiff, PatchComparison } from '@/features/source-control/editor-diff'

describe('Git comparison navigation', () => {
  afterEach(() => { cleanup(); document.getElementById('native-git-editor-diff-host')?.remove() })
  it('labels versions and path, marks changed lines and words, and exposes overview targets', async () => {
    const host = document.createElement('div'); host.id = 'native-git-editor-diff-host'; document.body.append(host)
    const versions = { before: 'a'.repeat(40), after: 'b'.repeat(40) }
    render(<EditorDiff title="tex/sections/main.tex" versions={versions} onClose={() => {}}><PatchComparison versions={versions} patch={'--- a/tex/sections/main.tex\n+++ b/tex/sections/main.tex\n@@ -2 +2 @@\n-version 4.0\n+version 4.1\n'} /></EditorDiff>)
    expect(screen.getByRole('navigation', { name: 'File path' }).getAttribute('title')).to.equal('tex/sections/main.tex')
    expect(document.querySelector('.native-git-diff-versions')?.getAttribute('title')).to.equal(`${versions.before} ↔ ${versions.after}`)
    expect(document.querySelector('.cm-gutters')?.textContent).to.contain('−')
    expect(document.querySelectorAll('.cm-gutters')[1]?.textContent).to.contain('+')
    expect(document.querySelector('.native-git-word-remove')?.textContent).to.equal('0')
    expect(document.querySelector('.native-git-word-add')?.textContent).to.equal('1')
    const target = document.querySelector<HTMLElement>('.native-git-changed-row')!
    target.scrollIntoView = sinon.spy()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Go to change at line 2' }))[0])
    expect(target.scrollIntoView).to.have.been.calledOnceWithExactly({ block: 'center' })
  })
  it('has a real read-only caret, supports keyboard movement and clears its overview on a new patch', async () => {
    const rendered = render(<PatchComparison patch={'--- a/a.tex\n+++ b/a.tex\n@@ -1,2 +1,2 @@\n same\n-old\n+new\n'} />)
    const content = screen.getByRole('textbox', { name: 'After version' })
    const view = EditorView.findFromDOM(content)!
    const coords = sinon.stub(view, 'coordsAtPos').returns({ top: 20, bottom: 40, left: 10, right: 10 })
    try {
      act(() => { view.focus(); view.dispatch({ selection: { anchor: view.state.doc.line(2).from } }); cursorCharRight(view) })
      expect(view.state.selection.main.head).to.equal(view.state.doc.line(2).from + 1)
      expect(view.state.readOnly).to.equal(true)
      act(() => { insertNewline(view) })
      expect(view.state.doc.toString()).to.equal('same\nnew')
      fireEvent(content, new CustomEvent('git-diff-cursor', { bubbles: true, detail: { top: 20, line: '2', side: 'After' } }))
      await waitFor(() => expect(screen.getByRole('status').getAttribute('aria-label')).to.equal('Cursor: After, line 2'))
      expect(content.getAttribute('contenteditable')).to.equal('true')
      expect(document.querySelector('.cm-cursorLayer')).to.exist
      rendered.rerender(<PatchComparison patch="" />)
      expect(screen.queryByRole('status')).to.equal(null)
    } finally { coords.restore() }
  })
})
