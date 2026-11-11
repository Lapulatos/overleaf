import { useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView, WidgetType } from '@codemirror/view'
import type { TransformState } from './types'
import { TransformPreview } from './preview-react'

function InlinePreview({ view, state }: { view: EditorView; state: TransformState }) {
  useLayoutEffect(() => { view.requestMeasure() }, [view, state])
  return <TransformPreview view={view} state={state} />
}

// A non-editable block below the selected source, not a document mutation.
// Each widget owns its React root so offscreen disposal cannot leak listeners.
export class InlineTransformPreview extends WidgetType {
  private roots = new WeakMap<HTMLElement, Root>()
  constructor(readonly state: TransformState) { super() }
  eq(other: InlineTransformPreview) { return this.state === other.state }
  get estimatedHeight() { return 220 }
  toDOM(view: EditorView) {
    const dom = document.createElement('div')
    dom.className = 'wa-transform-inline-review'
    dom.setAttribute('aria-label', '选区修改审阅')
    dom.setAttribute('role', 'region')
    const root = createRoot(dom)
    this.roots.set(dom, root)
    root.render(<InlinePreview view={view} state={this.state} />)
    return dom
  }

  destroy(dom: HTMLElement) {
    const root = this.roots.get(dom)
    this.roots.delete(dom)
    // CodeMirror may remove this widget during another React render.
    if (root) queueMicrotask(() => root.unmount())
  }
}
