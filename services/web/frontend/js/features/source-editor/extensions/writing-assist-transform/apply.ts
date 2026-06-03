import { EditorView } from '@codemirror/view'
import type { TransformPreview } from './types'
import {
  acceptTransformEffect,
  clearTransformToolbarEffect,
} from './effects'

/**
 * Apply a transform: replace the original text with the suggestion and
 * clear both the toolbar and preview tooltips.
 *
 * Follows the `applyIssue` pattern from the grammar-check extension:
 * clamp positions, single dispatch with both text change and effects.
 */
export function applyTransform(view: EditorView, preview: TransformPreview): boolean {
  const docLen = view.state.doc.length
  const from = Math.max(0, Math.min(preview.from, docLen))
  const to = Math.max(from, Math.min(preview.to, docLen))
  if (from === to && preview.suggested.length === 0) return false

  view.dispatch({
    changes: { from, to, insert: preview.suggested },
    effects: [
      acceptTransformEffect.of(null),
      clearTransformToolbarEffect.of(null),
    ],
  })
  return true
}