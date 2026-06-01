import { StateField, Range } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import type { Issue } from './types'
import { CATEGORY_COLORS } from './types'
import { setIssuesEffect, removeRangeEffect } from './effects'

export { setIssuesEffect, removeRangeEffect } from './effects'

export const decorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    // Map surviving marks through the change first so they keep their positions.
    let mapped = decorations.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setIssuesEffect)) {
        return buildDecorations(e.value, tr.state.doc.length)
      }
      if (e.is(removeRangeEffect)) {
        // Drop only the mark(s) intersecting the applied range; keep the rest.
        const { from, to } = e.value
        mapped = mapped.update({
          filter: (mFrom, mTo) => mTo <= from || mFrom >= to,
        })
      }
    }
    return mapped
  },
  provide: f => EditorView.decorations.from(f),
})

/**
 * Build decorations: one solid underline mark per issue over its
 * [offset, offset+length) span. The suggestion/diff lives in the hover card,
 * so there is no inline widget here.
 *
 * Offsets are document-absolute (computed server-side by string-anchoring and
 * shifted by the viewport base in the checker), so they map directly.
 */
function buildDecorations(issues: Issue[], docLength: number): DecorationSet {
  if (!issues || issues.length === 0) return Decoration.none

  const marks: Array<Range<Decoration>> = []

  const sorted = [...issues].sort(
    (a, b) => a.offset - b.offset || a.length - b.length
  )

  let lastTo = -1
  for (const issue of sorted) {
    const from = Math.max(0, Math.min(issue.offset, docLength))
    const to = Math.max(from, Math.min(issue.offset + issue.length, docLength))
    if (from >= to) continue
    // Skip a span that overlaps the previous one — CM6 marks must be ordered
    // and non-nested for clean rendering.
    if (from < lastTo) continue
    lastTo = to

    const cat = CATEGORY_COLORS[issue.category]
    const cls = cat
      ? `wa-mark ${cat.className.replace('wa-', 'wa-mark-')}`
      : 'wa-mark wa-mark-correctness'

    marks.push(
      Decoration.mark({
        class: cls,
        attributes: { 'data-wa-category': issue.category },
      }).range(from, to)
    )
  }

  return Decoration.set(marks, true)
}
