import { expect } from 'chai'
import { fireEvent, waitFor, within } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { showAgentEditorReview, agentEditorReviewField, firstChangedOffset, type EditorReview } from '@/features/source-editor/extensions/writing-assist/agent-editor-review'

describe('Conversation proposal source review', function () {
  let parent: HTMLDivElement, view: EditorView, review: EditorReview
  beforeEach(function () {
    parent = document.createElement('div'); document.body.append(parent)
    view = new EditorView({ parent, state: EditorState.create({ doc: 'header\nold sentence\nfooter' }) })
    review = { proposal: { id: 'p', docId: 'd', path: 'main.tex', before: view.state.doc.toString(), after: 'header\nnew sentence\nfooter', status: 'pending' }, isCurrent: () => true, decide: async () => true }
  })
  afterEach(async function () { view.destroy(); await Promise.resolve(); parent.remove() })
  it('anchors at the first changed line and sends one explicit decision without local writes', async function () {
    let calls = 0
    let finish!: (value: boolean) => void
    review.decide = async accept => { expect(accept).to.equal(true); calls++; return new Promise(resolve => { finish = resolve }) }
    expect(firstChangedOffset(review.proposal.before, review.proposal.after)).to.equal(7)
    showAgentEditorReview(view, review)
    const accept = await within(parent).findByRole('button', { name: 'Accept change' })
    expect(view.state.doc.toString()).to.equal(review.proposal.before)
    fireEvent.click(accept); fireEvent.click(accept)
    expect(calls).to.equal(1)
    finish(true)
    await waitFor(() => expect(view.state.field(agentEditorReviewField)).to.equal(null))
    expect(view.state.doc.toString()).to.equal(review.proposal.before)
  })
  it('keeps the preview and exposes uncertainty when the decision is not confirmed', async function () {
    review.decide = async () => false
    showAgentEditorReview(view, review)
    fireEvent.click(await within(parent).findByRole('button', { name: 'Accept change' }))
    expect(await within(parent).findByRole('alert')).to.exist
    expect(view.state.field(agentEditorReviewField)).to.equal(review)
    expect(view.state.doc.toString()).to.equal(review.proposal.before)
  })
  it('rejects stale source or expired conversation identity before invoking decisions', async function () {
    expect(() => showAgentEditorReview(view, { ...review, isCurrent: () => false })).to.throw()
    expect(() => showAgentEditorReview(view, { ...review, proposal: { ...review.proposal, before: 'different' } })).to.throw()
    let calls = 0
    review.decide = async () => { calls++; return true }
    showAgentEditorReview(view, review)
    const accept = await within(parent).findByRole('button', { name: 'Accept change' })
    review.isCurrent = () => false
    fireEvent.click(accept)
    expect(calls).to.equal(0)
    expect(within(parent).getByRole('alert')).to.exist
    view.dispatch({ changes: { from: 7, to: 10, insert: 'edited' } })
    expect(view.state.field(agentEditorReviewField)).to.equal(null)
  })
})
