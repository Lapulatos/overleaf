import { StateField, StateEffect } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import type { Issue } from './types'
import { CATEGORY_COLORS } from './types'

export const setIssuesEffect = StateEffect.define<Issue[]>()

export const decorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    let mapped = decorations.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setIssuesEffect)) {
        return buildDecorations(e.value, tr.startState.doc.length)
      }
    }
    return mapped
  },
  provide: f => EditorView.decorations.from(f),
})

function buildDecorations(issues: Issue[], docLength: number): DecorationSet {
  if (!issues || issues.length === 0) return Decoration.none

  const ranges: Array<{ from: number; to: number }> = []

  for (const issue of issues) {
    const from = Math.max(0, Math.min(issue.offset, docLength))
    const to = Math.max(from, Math.min(issue.offset + issue.length, docLength))
    if (from < to) {
      ranges.push({ from, to })
    }
  }

  ranges.sort((a, b) => a.from - b.from)

  const marks: Array<{ from: number; to: number; value: Decoration }> = []

  for (const r of ranges) {
    // Find the dominant category — we don't have per-offset category info here,
    // but the tooltip layer resolves that. Use generic mark with data attributes.
    const mark = Decoration.mark({
      class: 'wa-underline',
      attributes: { 'data-wa-issue': 'true' },
    })
    marks.push(mark.range(r.from, r.to))
  }

  return Decoration.set(marks, true)
}
