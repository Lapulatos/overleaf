import { useRef, useState, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { diffLines } from 'diff'
import { ProposalDiff } from './proposal-diff'
import type { Proposal } from './agent-task-result'

export type EditorReview = {
  proposal: Proposal
  decide: (accept: boolean) => Promise<boolean>
  isCurrent: () => boolean
}
const setReview = StateEffect.define<EditorReview | null>()
const roots = new WeakMap<HTMLElement, Root>()

function InlineAgentReview({ view, review }: { view: EditorView; review: EditorReview }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  useLayoutEffect(() => { view.requestMeasure() }, [view, review])
  async function decide(accept: boolean) {
    if (inFlight.current) return
    if (!review.isCurrent() || view.state.field(agentEditorReviewField, false) !== review || view.state.doc.toString() !== review.proposal.before) {
      setError('This suggestion is no longer current. Review the latest conversation result.'); return
    }
    inFlight.current = true; setBusy(true); setError('')
    try {
      if (await review.decide(accept)) {
        if (view.state.field(agentEditorReviewField, false) === review) view.dispatch({ effects: setReview.of(null) })
      } else setError('The change was not confirmed. Check the conversation for details.')
    } catch { setError('The change was not confirmed. Check the conversation before retrying.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <div className="paper-inline-agent-content">
    <div className="paper-change-file"><strong>{review.proposal.path}</strong><span>Suggested changes</span></div>
    <ProposalDiff before={review.proposal.before} after={review.proposal.after} />
    {error && <p role="alert" className="paper-change-notice">{error}</p>}
    <div className="paper-change-actions">
      <button type="button" className="paper-review-open" disabled={busy} onClick={() => view.dispatch({ effects: setReview.of(null) })}>Close preview</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide(true)}>Accept change</button>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => decide(false)}>Reject</button>
    </div>
  </div>
}
class ReviewWidget extends WidgetType {
  constructor(readonly review: EditorReview) { super() }
  eq(other: ReviewWidget) { return other.review === this.review }
  get estimatedHeight() { return 260 }
  toDOM(view: EditorView) {
    const dom = document.createElement('div')
    dom.className = 'paper-inline-agent-review'
    dom.setAttribute('role', 'region'); dom.setAttribute('aria-label', `Source review: ${this.review.proposal.path}`)
    const root = createRoot(dom); roots.set(dom, root)
    root.render(<InlineAgentReview view={view} review={this.review} />)
    return dom
  }

  destroy(dom: HTMLElement) {
    const root = roots.get(dom); roots.delete(dom)
    if (root) queueMicrotask(() => root.unmount())
  }
}
export function firstChangedOffset(before: string, after: string) {
  const first = diffLines(before, after)[0]
  return first && !first.added && !first.removed ? first.value.length : 0
}
export const agentEditorReviewField = StateField.define<EditorReview | null>({
  create: () => null,
  update(value, tr) {
    if (tr.docChanged) return null
    for (const effect of tr.effects) if (effect.is(setReview)) value = effect.value
    return value
  },
  provide: field => EditorView.decorations.compute([field], state => {
    const review = state.field(field)
    if (!review || state.doc.toString() !== review.proposal.before) return Decoration.none
    const offset = Math.min(firstChangedOffset(review.proposal.before, review.proposal.after), state.doc.length)
    return Decoration.set([Decoration.widget({ widget: new ReviewWidget(review), block: true, side: -1 }).range(state.doc.lineAt(offset).from)])
  }),
})
export function showAgentEditorReview(view: EditorView, review: EditorReview) {
  if (!review.isCurrent() || review.proposal.status !== 'pending' || view.state.doc.toString() !== review.proposal.before) {
    throw new Error('The document changed. Run a new task to get a current suggestion.')
  }
  if (view.state.field(agentEditorReviewField, false) === undefined) view.dispatch({ effects: StateEffect.appendConfig.of(agentEditorReviewField) })
  const offset = Math.min(firstChangedOffset(review.proposal.before, review.proposal.after), view.state.doc.length)
  view.dispatch({ effects: [setReview.of(review), EditorView.scrollIntoView(offset, { y: 'center' })] })
  view.requestMeasure()
}
export function clearAgentEditorReview(view: EditorView) {
  if (view.state.field(agentEditorReviewField, false)) view.dispatch({ effects: setReview.of(null) })
}
