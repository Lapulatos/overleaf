import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { Checker } from './checker'
import { segmentWithOffsets } from './segment'
import { decorationField, setIssuesEffect, removeRangeEffect } from './decorations'
import { requestCheckEffect, addLocalDismissEffect } from './effects'
import { writingAssistHover } from './tooltip'
import { writingAssistTheme } from './theme'
import { writingAssistProgress, reportProgress } from './progress'
import { SentenceCache } from './sentence-cache'
import { setAppliedHook, setDismissedHook } from './apply'
import { dismissStore } from './dismiss-store'
import { buildDismissPattern } from './dismiss-pattern'
import { localDismissField, isLocallyDismissed } from './local-dismiss'
import { getConfig } from '@/utils/api/writing-assist'
import type { Category, Issue, WritingAssistPublicConfig } from './types'
import { CATEGORY_ORDER, CATEGORY_COLORS } from './types'

export { CATEGORY_COLORS, CATEGORY_ORDER } from './types'
export type { Category, Issue, WritingAssistPublicConfig }

export interface WritingAssistOptions {
  projectId: string
  config: WritingAssistPublicConfig
}

/**
 * Holds the issues currently shown, in document-absolute coordinates, so the
 * hover card can resolve which issues sit under a given position.
 */
class IssueStore {
  issues: Issue[] = []

  setIssues(issues: Issue[]): void {
    this.issues = issues
  }

  getIssuesAt(pos: number): Issue[] {
    return this.issues.filter(i => pos >= i.offset && pos <= i.offset + i.length)
  }

  /**
   * Drop the issue that was just applied and re-base the survivors for the edit
   * it caused: replacing [from, oldTo) with text of `newLen` shifts everything
   * after `from` by (newLen - (oldTo - from)). Issues overlapping the edit are
   * dropped (their span no longer matches the new text).
   */
  removeApplied(from: number, oldTo: number, newLen: number): Issue[] {
    const delta = newLen - (oldTo - from)
    const remaining: Issue[] = []
    for (const i of this.issues) {
      const iEnd = i.offset + i.length
      if (iEnd <= from) {
        remaining.push(i) // entirely before the edit — unchanged
      } else if (i.offset >= oldTo) {
        remaining.push({ ...i, offset: i.offset + delta }) // after — shift
      }
      // overlapping the edited span (incl. the applied one) → drop
    }
    this.issues = remaining
    return remaining
  }
}

export function writingAssist(options: WritingAssistOptions): Extension {
  const { projectId, config } = options
  // eslint-disable-next-line no-console
  console.log('[WA] init projectId:', projectId, 'enabled:', config?.enabled)

  if (!projectId) {
    console.warn('[WA] missing projectId')
    return []
  }
  if (!config?.enabled) {
    // eslint-disable-next-line no-console
    console.log('[WA] disabled')
    return []
  }

  const store = new IssueStore()
  const cache = new SentenceCache()
  let activeView: EditorView | null = null
  // Mutable runtime config — seeded from the (default) config passed in, then
  // overwritten once the user's saved config is fetched (see below). Kept in
  // closure vars so check() reads the latest without reconstructing anything.
  let analysisMode: 'lazy' | 'eager' = config.analysisMode ?? 'lazy'
  let enabled: boolean = config.enabled
  // When a selection check is in flight, the checker only sees the selected
  // sentences. To avoid wiping the other visible underlines, we preserve the
  // issues OUTSIDE the selection here and merge them with the fresh results.
  // null = no selection check active (normal full-set replace).
  let selectionMerge: { range: { from: number; to: number }; outside: Issue[] } | null =
    null

  const checker = new Checker(
    config.debounceMs ?? 1500,
    enabledCategories(config),
    config.concurrency ?? 4,
    cache,
    issues => {
      // Drop issues inside locally-dismissed sentence spans (the card's
      // "dismiss" button) so a re-check never re-surfaces them at that position.
      let incoming = issues
      if (activeView) {
        const localSet = activeView.state.field(localDismissField, false)
        if (localSet && localSet.size > 0) {
          incoming = issues.filter(i => !isLocallyDismissed(localSet, i.offset))
        }
      }
      let next = incoming
      if (selectionMerge) {
        // Fresh `issues` cover only the selected range; keep everything that was
        // outside the selection so other underlines don't vanish.
        const { from, to } = selectionMerge.range
        const inside = incoming.filter(
          i => i.offset < to && i.offset + i.length > from
        )
        next = [...selectionMerge.outside, ...inside].sort(
          (a, b) => a.offset - b.offset
        )
      }
      store.setIssues(next)
      activeView?.dispatch({ effects: setIssuesEffect.of(store.issues) })
    },
    progress => {
      if (activeView) reportProgress(activeView, progress)
    },
    projectId
  )

  // When a fix is applied, record the fixed severity against the resulting
  // sentence so the next check of that sentence drops equal/worse suggestions
  // (non-regression — severity must move down). The hook runs AFTER the edit
  // dispatch, so the doc already contains the new text.
  setAppliedHook((issue, from, to) => {
    if (!activeView) return
    // Keep the store in sync (drop the applied issue, shift survivors) so the
    // hover resolver and any later full re-render stay correct. The visible
    // decorations update via the decorationField's own change-mapping plus the
    // removeRange effect below — we do NOT re-dispatch setIssuesEffect here, so
    // the other underlines never flicker.
    const oldTo = Math.min(
      issue.offset + issue.length,
      activeView.state.doc.length
    )
    store.removeApplied(from, oldTo, issue.suggestion.length)
    activeView.dispatch({ effects: removeRangeEffect.of({ from, to }) })

    const priority = CATEGORY_COLORS[issue.category]?.priority ?? 0
    const text = enclosingSentenceText(activeView, to)
    if (text) cache.recordApplied(text, priority)
  })

  // When the user dismisses an issue, always remove this underline. The scope
  // decides persistence:
  //  - 'local': suppress only THIS occurrence at this position (a mapped range
  //    in localDismissField), not added to the Dismiss Notes — the same sentence
  //    elsewhere/later can still be flagged.
  //  - 'all': additionally store a diff-pattern in the Dismiss Notes so every
  //    matching sentence is skipped from now on.
  // Dismiss makes no doc edit, so the document still holds the original text and
  // from/to index into it; the "corrected" sentence is reconstructed in-memory.
  setDismissedHook((issue, from, to, scope) => {
    if (!activeView) return
    const oldTo = Math.min(
      issue.offset + issue.length,
      activeView.state.doc.length
    )
    store.removeApplied(from, oldTo, issue.length) // length unchanged (no edit)

    const range = enclosingSentenceRange(activeView, from)
    // Locally suppress the whole enclosing sentence span so a re-check of this
    // exact sentence at this position does not re-surface the issue (until the
    // text changes). Applies to BOTH scopes — 'all' just adds the notebook entry
    // on top.
    const localFrom = range ? range.from : from
    const localTo = range ? range.to : to
    activeView.dispatch({
      effects: [
        removeRangeEffect.of({ from, to }),
        addLocalDismissEffect.of({ from: localFrom, to: localTo }),
      ],
    })

    if (scope === 'all' && range) {
      const original = activeView.state.sliceDoc(range.from, range.to)
      const relFrom = Math.max(0, Math.min(from - range.from, original.length))
      const relTo = Math.max(relFrom, Math.min(to - range.from, original.length))
      const corrected =
        original.slice(0, relFrom) + issue.suggestion + original.slice(relTo)
      const pattern = buildDismissPattern(original.trim(), corrected.trim())
      if (pattern) void dismissStore.add(pattern)
    }
  })

  // Load the notebook once so the checker can skip dismissed sentences and the
  // rail panel has data on first open. Re-check when it changes (e.g. the user
  // removes an entry in the panel — that sentence should be checked again).
  // `triggerRecheck` is wired to the live view plugin's check() below.
  let triggerRecheck: (() => void) | null = null
  // Bind the dismiss store to this project (dismissals are project-scoped) and
  // load its notebook. init() reloads if the project changed since last time.
  dismissStore.init(projectId)
  const unsubscribeDismiss = dismissStore.subscribe(() => {
    triggerRecheck?.()
  })

  // The editor is constructed synchronously with the default config (CM needs
  // the extension immediately), so fetch the user's SAVED config asynchronously
  // and apply it once: real categories drive what gets checked, the analysis
  // mode (lazy/eager) drives the checked range, and `enabled:false` turns
  // checking off. On success we trigger a re-check so the saved settings take
  // effect without needing an edit/scroll. On failure we keep the defaults.
  void getConfig()
    .then(saved => {
      analysisMode =
        saved.analysisMode === 'eager' || saved.analysisMode === 'lazy'
          ? saved.analysisMode
          : 'lazy'
      enabled = saved.enabled
      checker.updateConfig(
        saved.debounceMs ?? 1500,
        enabledCategories(saved),
        saved.concurrency ?? 4
      )
      // Re-check with the real settings (or clear, if now disabled).
      if (enabled) {
        triggerRecheck?.()
      } else {
        store.setIssues([])
        activeView?.dispatch({ effects: setIssuesEffect.of([]) })
      }
    })
    .catch(() => {
      // Keep defaults; the feature still works with the passed-in config.
    })

  const viewPlugin = ViewPlugin.fromClass(
    class {
      private initRetries = 0

      constructor(readonly view: EditorView) {
        activeView = view
        triggerRecheck = () => this.check()
        // Document content often loads asynchronously (realtime sync) AFTER the
        // plugin mounts. Retry until the doc has content (or give up).
        this.scheduleInitialCheck()
      }

      scheduleInitialCheck() {
        setTimeout(() => {
          const hasContent = this.view.state.doc.length > 0
          this.check()
          if (!hasContent && this.initRetries < 10) {
            this.initRetries++
            this.scheduleInitialCheck()
          }
        }, 600)
      }

      update(update: ViewUpdate) {
        // While a non-empty selection exists, checking is RESTRICTED to that
        // selection (driven only by the manual button), so suppress the
        // automatic viewport check on scroll/edit. When there is no selection,
        // behave as before.
        const hasSelection = !update.state.selection.main.empty
        const hadSelection = !update.startState.selection.main.empty
        // Selection just cleared → resume normal viewport checking (also resets
        // the selection-merge state).
        const selectionCleared = hadSelection && !hasSelection
        if (!hasSelection && (update.viewportChanged || update.docChanged || selectionCleared)) {
          this.check()
        }
        // Manual "check now" button → run an immediate (non-debounced) check,
        // scoped to the selection if there is one.
        for (const tr of update.transactions) {
          if (tr.effects.some(e => e.is(requestCheckEffect))) {
            this.check(true)
            break
          }
        }
      }

      check(immediate = false) {
        if (!enabled) return

        const sel = this.view.state.selection.main
        if (!sel.empty) {
          // Selection-scoped check: analyze only the sentences overlapping the
          // selection, and MERGE the fresh results with the issues outside the
          // selection so the rest of the viewport's underlines are preserved.
          const range = expandToSentenceBounds(this.view, sel.from, sel.to)
          const text = this.view.state.sliceDoc(range.from, range.to)
          const sentences = segmentWithOffsets(text, range.from).filter(
            s => !dismissStore.has(s.text)
          )
          const outside = store.issues.filter(
            i => i.offset + i.length <= range.from || i.offset >= range.to
          )
          selectionMerge = { range, outside }
          // Force a fresh fetch of just the selected sentences.
          cache.clearFor(sentences.map(s => s.text))
          checker.runNow(sentences)
          return
        }

        // No selection → normal viewport (lazy/eager) check, full-set replace.
        selectionMerge = null
        // Lazy: only the strictly-visible window. Eager: the viewport plus a
        // wide look-ahead/behind margin. Both ends are expanded to whole
        // sentences so an edge sentence is never cut. (Off-screen sentences keep
        // their cached results, so scrolling back never re-checks them.)
        const range = computeCheckRange(this.view, analysisMode)
        const text = this.view.state.sliceDoc(range.from, range.to)
        // Split into sentences with document offsets; the checker fans them out
        // concurrently and shifts each result by its sentence's start. Drop
        // sentences in the dismiss notebook so they are never sent for checking.
        const sentences = segmentWithOffsets(text, range.from).filter(
          s => !dismissStore.has(s.text)
        )
        if (immediate) {
          // Manual check → force a fresh re-scan: clear cached issues (keeping
          // non-regression gates) so even unchanged sentences are re-fetched.
          cache.clearIssues()
          checker.runNow(sentences)
        } else {
          checker.schedule(sentences)
        }
      }

      destroy() {
        checker.cancel()
        unsubscribeDismiss()
        triggerRecheck = null
        if (activeView === this.view) activeView = null
      }
    }
  )

  // eslint-disable-next-line no-console
  console.log('[WA] extension ready')
  return [
    viewPlugin,
    decorationField,
    localDismissField,
    writingAssistTheme,
    writingAssistProgress(),
    writingAssistHover({ issuesAt: pos => store.getIssuesAt(pos) }),
  ]
}

function enabledCategories(config: WritingAssistPublicConfig): Category[] {
  return CATEGORY_ORDER.filter(c => config?.categories?.[c])
}

// Eager mode look-ahead/behind beyond the viewport, in characters (~a few
// screens of prose). NOT the whole document — eager is "visible + wide margin".
const EAGER_MARGIN = 8000

/**
 * The document range to analyze, per analysis mode:
 *  - lazy: the strictly-visible window (union of `view.visibleRanges`), so only
 *    what the user can see is sent to the LLM; scrolling reveals new regions.
 *  - eager: the viewport plus a wide margin on each side.
 * Both ends are expanded outward to the nearest sentence boundary so an edge
 * sentence is analyzed whole (matching segmentWithOffsets' boundary rule).
 */
function computeCheckRange(
  view: EditorView,
  mode: 'lazy' | 'eager'
): { from: number; to: number } {
  const docLen = view.state.doc.length
  let from: number
  let to: number
  if (mode === 'eager') {
    from = Math.max(0, view.viewport.from - EAGER_MARGIN)
    to = Math.min(docLen, view.viewport.to + EAGER_MARGIN)
  } else {
    const ranges = view.visibleRanges
    if (ranges.length > 0) {
      from = ranges[0].from
      to = ranges[ranges.length - 1].to
    } else {
      from = view.viewport.from
      to = view.viewport.to
    }
  }
  return expandToSentenceBounds(view, from, to)
}

/**
 * Expand [from, to) outward to the enclosing sentence boundaries using the same
 * `[.!?]\s | \n` rule as segmentWithOffsets / enclosingSentenceRange, so the
 * edge sentences at the top and bottom of the window are never cut mid-sentence.
 */
function expandToSentenceBounds(
  view: EditorView,
  from: number,
  to: number
): { from: number; to: number } {
  const docLen = view.state.doc.length
  // Walk back from `from` to the previous boundary.
  const backStart = Math.max(0, from - 400)
  const back = view.state.sliceDoc(backStart, from)
  let start = backStart
  for (let i = back.length - 2; i >= 0; i--) {
    const two = back.slice(i, i + 2)
    if (/[.!?]\s/.test(two) || back[i] === '\n') {
      start = backStart + i + (back[i] === '\n' ? 1 : 2)
      break
    }
  }
  // Walk forward from `to` to the next boundary.
  const fwdEnd = Math.min(docLen, to + 400)
  const fwd = view.state.sliceDoc(to, fwdEnd)
  let end = fwdEnd
  for (let i = 0; i < fwd.length - 1; i++) {
    const two = fwd.slice(i, i + 2)
    if (/[.!?]\s/.test(two) || fwd[i] === '\n') {
      end = to + i + 1
      break
    }
  }
  return { from: start, to: Math.max(end, start) }
}

/**
 * Document [from, to) of the sentence containing `pos`, matching how
 * segmentWithOffsets splits (scan ±400 chars to a sentence boundary).
 */
function enclosingSentenceRange(
  view: EditorView,
  pos: number
): { from: number; to: number } | null {
  const docLen = view.state.doc.length
  const backStart = Math.max(0, pos - 400)
  const back = view.state.sliceDoc(backStart, pos)
  let start = backStart
  for (let i = back.length - 2; i >= 0; i--) {
    const two = back.slice(i, i + 2)
    if (/[.!?]\s/.test(two) || back[i] === '\n') {
      start = backStart + i + (back[i] === '\n' ? 1 : 2)
      break
    }
  }
  const fwdEnd = Math.min(docLen, pos + 400)
  const fwd = view.state.sliceDoc(pos, fwdEnd)
  let end = fwdEnd
  for (let i = 0; i < fwd.length - 1; i++) {
    const two = fwd.slice(i, i + 2)
    if (/[.!?]\s/.test(two) || fwd[i] === '\n') {
      end = pos + i + 1
      break
    }
  }
  return end > start ? { from: start, to: end } : null
}

/**
 * Return the trimmed text of the sentence containing document position `pos`,
 * matching how segmentWithOffsets splits, so the cache key lines up.
 */
function enclosingSentenceText(view: EditorView, pos: number): string | null {
  const range = enclosingSentenceRange(view, pos)
  if (!range) return null
  const text = view.state.sliceDoc(range.from, range.to).trim()
  return text.length > 0 ? text : null
}
