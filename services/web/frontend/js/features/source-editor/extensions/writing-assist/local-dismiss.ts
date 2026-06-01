import { StateField, RangeSet, RangeValue } from '@codemirror/state'
import { addLocalDismissEffect } from './effects'

/**
 * Tracks LOCALLY-dismissed sentence spans — issues the user dismissed with the
 * card's "dismiss" button (as opposed to "dismiss all", which adds to the
 * Dismiss Notes). A locally-dismissed span suppresses writing-assist issues
 * inside it at that position only.
 *
 * Semantics ("until this text changes"): each span is mapped through document
 * edits so it follows its sentence when text above is inserted/deleted, but is
 * DROPPED as soon as an edit touches the span's own interior (the sentence text
 * changed → the suggestion may be relevant again). The same sentence elsewhere
 * in the document is never affected, because suppression is keyed by position,
 * not by text.
 */

class LocalDismissValue extends RangeValue {}
const LOCAL_DISMISS = new LocalDismissValue()

export const localDismissField = StateField.define<RangeSet<LocalDismissValue>>({
  create() {
    return RangeSet.empty
  },
  update(set, tr) {
    let next = set
    if (tr.docChanged) {
      // Map spans through the edit; drop any span whose interior was touched
      // (its text changed), so the suggestion can reappear there.
      next = next.map(tr.changes)
      const touched: Array<{ from: number; to: number }> = []
      tr.changes.iterChangedRanges((fromA, toA) => {
        touched.push({ from: fromA, to: toA })
      })
      if (touched.length > 0) {
        const keep: Array<{ from: number; to: number }> = []
        const cursor = next.iter()
        while (cursor.value) {
          const sFrom = cursor.from
          const sTo = cursor.to
          // A change at mapped coordinates touches this span if it overlaps the
          // span interior. We compare against the POST-edit touched ranges by
          // mapping them forward.
          const hit = touched.some(c => {
            const cFrom = tr.changes.mapPos(c.from, -1)
            const cTo = tr.changes.mapPos(c.to, 1)
            return cFrom < sTo && cTo > sFrom
          })
          if (!hit) keep.push({ from: sFrom, to: sTo })
          cursor.next()
        }
        next = RangeSet.of(
          keep.map(r => LOCAL_DISMISS.range(r.from, r.to)),
          true
        )
      }
    }
    for (const e of tr.effects) {
      if (e.is(addLocalDismissEffect)) {
        const { from, to } = e.value
        if (to > from) {
          next = next.update({
            add: [LOCAL_DISMISS.range(from, to)],
            sort: true,
          })
        }
      }
    }
    return next
  },
})

/**
 * True if document position `offset` falls inside any locally-dismissed span.
 * Used by the checker's emit to filter out suppressed issues.
 */
export function isLocallyDismissed(
  set: RangeSet<LocalDismissValue>,
  offset: number
): boolean {
  let found = false
  const cursor = set.iter()
  while (cursor.value) {
    if (offset >= cursor.from && offset < cursor.to) {
      found = true
      break
    }
    if (cursor.from > offset) break
    cursor.next()
  }
  return found
}
