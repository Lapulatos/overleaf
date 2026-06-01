import { EditorView } from '@codemirror/view'
import type { Issue } from './types'
import { closeHoverEffect } from './effects'

/** Optional hook fired after a successful apply, with the applied issue and the
 * document range [from, to) of the newly inserted text. */
export type AppliedHook = (issue: Issue, from: number, to: number) => void

let appliedHook: AppliedHook | null = null

/** Register a callback invoked whenever a suggestion is applied. Set by the
 * extension wiring so the store can drop just this issue (keeping the rest) and
 * the sentence cache can record the fixed severity. */
export function setAppliedHook(hook: AppliedHook | null): void {
  appliedHook = hook
}

/** How a dismiss should scope: 'local' suppresses only this occurrence at this
 * position (not added to Dismiss Notes); 'all' adds a diff-pattern to the
 * Dismiss Notes so every matching sentence is skipped. */
export type DismissScope = 'local' | 'all'

/** Optional hook fired when an issue is dismissed, with the issue, its document
 * span [from, to), and the scope. Set by the extension wiring so the issue's
 * enclosing sentence can be locally suppressed and/or added to the dismiss
 * notebook, and the underline removed. */
export type DismissedHook = (
  issue: Issue,
  from: number,
  to: number,
  scope: DismissScope
) => void

let dismissedHook: DismissedHook | null = null

export function setDismissedHook(hook: DismissedHook | null): void {
  dismissedHook = hook
}

/**
 * Apply a single suggestion: replace the WHOLE flagged span
 * [offset, offset+length) with the suggestion text in one edit and close the
 * hover card immediately (closeHoverEffect).
 *
 * It does NOT clear all decorations — the other underlines must stay put. The
 * applied issue is removed from the rendered set by the AppliedHook (see
 * index.ts), and the remaining decorations are mapped through this change so
 * they keep their positions. Replacing the whole span (not inserting at a
 * point) makes multi-word fixes work; offsets are clamped so a stale issue
 * can't throw.
 */
export function applyIssue(view: EditorView, issue: Issue): boolean {
  const docLen = view.state.doc.length
  const from = Math.max(0, Math.min(issue.offset, docLen))
  const to = Math.max(from, Math.min(issue.offset + issue.length, docLen))
  if (from === to && issue.suggestion.length === 0) return false

  view.dispatch({
    changes: { from, to, insert: issue.suggestion },
    effects: closeHoverEffect.of(null),
  })

  if (appliedHook) {
    appliedHook(issue, from, from + issue.suggestion.length)
  }
  return true
}

/**
 * Dismiss a single suggestion: close the hover card immediately and fire the
 * DismissedHook with the issue's document span and the scope so the wiring can
 * locally suppress this occurrence and/or add the enclosing sentence to the
 * dismiss notebook, and remove this underline.
 *
 * Unlike apply, this makes NO document edit — the user is saying "this is fine
 * as written", so the text is untouched; only the suggestion goes away.
 *  - scope 'local': suppress only this occurrence (not added to Dismiss Notes).
 *  - scope 'all': also add a diff-pattern to the Dismiss Notes.
 */
export function dismissIssue(
  view: EditorView,
  issue: Issue,
  scope: DismissScope
): void {
  const docLen = view.state.doc.length
  const from = Math.max(0, Math.min(issue.offset, docLen))
  const to = Math.max(from, Math.min(issue.offset + issue.length, docLen))

  view.dispatch({ effects: closeHoverEffect.of(null) })

  if (dismissedHook) {
    dismissedHook(issue, from, to, scope)
  }
}
