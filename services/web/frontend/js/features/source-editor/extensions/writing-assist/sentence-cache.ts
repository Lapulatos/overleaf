import type { Issue } from './types'

/**
 * In-memory per-sentence cache for writing-assist results.
 *
 * Two jobs:
 *  1. Skip re-checking unchanged sentences. Keyed by the EXACT sentence text:
 *     if a sentence's text is unchanged since last check, its issues are reused
 *     and no LLM call is made. Editing one sentence changes only that key, so
 *     only it is re-sent — applying a fix no longer re-checks the whole page.
 *  2. Non-regression gate. When the user applies a fix, we remember the
 *     resulting sentence text and the severity (category priority) that was
 *     just fixed. On the next check of that exact text we discard any new
 *     suggestion whose severity is >= the fixed one, so a fix can only move the
 *     sentence's worst problem DOWN in severity, never back up (prevents
 *     A→B→C→A loops and "improvements" that re-introduce bigger problems).
 *
 * Issue offsets are stored relative to the sentence (offset 0 = sentence start)
 * so they stay valid as the sentence moves around the document; the checker
 * re-bases them onto the document each render.
 */

interface CacheEntry {
  /** checked issues (sentence-relative offsets), or null if not yet checked
   *  (e.g. a gate-only entry recorded right after an apply). */
  issues: Issue[] | null
  /** category priority of the last applied fix on this exact text, if any */
  fixedPriority?: number
}

export class SentenceCache {
  private map = new Map<string, CacheEntry>()

  private key(text: string): string {
    return text.trim()
  }

  /**
   * Cached issues for a sentence (sentence-relative offsets), or null when the
   * sentence is unknown OR known only as a gate (must be re-checked). Returning
   * null makes the checker send it to the LLM.
   */
  get(text: string): Issue[] | null {
    const e = this.map.get(this.key(text))
    return e ? e.issues : null
  }

  /** The severity gate for a sentence: discard new issues at or above this. */
  fixedPriority(text: string): number | undefined {
    return this.map.get(this.key(text))?.fixedPriority
  }

  /** Store a freshly-checked sentence's issues (sentence-relative offsets). */
  set(text: string, issues: Issue[]): void {
    const k = this.key(text)
    const prev = this.map.get(k)
    this.map.set(k, { issues, fixedPriority: prev?.fixedPriority })
  }

  /**
   * Record that a fix of `priority` severity was applied, producing sentence
   * text `resultingText`. Future checks of that text drop issues >= priority.
   * issues is null so the checker still RE-CHECKS the new text (the gate only
   * filters what comes back; it must not pose as a cached empty result).
   */
  recordApplied(resultingText: string, priority: number): void {
    this.map.set(this.key(resultingText), { issues: null, fixedPriority: priority })
  }

  /** Drop entries whose sentences are no longer present (cap memory). */
  retain(currentTexts: Set<string>): void {
    if (this.map.size < 500) return
    for (const k of this.map.keys()) {
      if (!currentTexts.has(k)) this.map.delete(k)
    }
  }

  /**
   * Clear all cached issues so the next check re-fetches every sentence, while
   * PRESERVING the non-regression gates (fixedPriority). Used by the manual
   * "check now" button so the user can force a fresh re-scan even of sentences
   * whose results were cached, without re-introducing already-fixed problems.
   */
  clearIssues(): void {
    for (const [k, e] of this.map) {
      if (e.fixedPriority !== undefined) {
        this.map.set(k, { issues: null, fixedPriority: e.fixedPriority })
      } else {
        this.map.delete(k)
      }
    }
  }

  /**
   * Clear cached issues for just the given sentences (preserving their gates),
   * so a selection check force-refetches only the selected sentences and leaves
   * the rest of the viewport cache intact.
   */
  clearFor(texts: Iterable<string>): void {
    for (const text of texts) {
      const k = this.key(text)
      const e = this.map.get(k)
      if (!e) continue
      if (e.fixedPriority !== undefined) {
        this.map.set(k, { issues: null, fixedPriority: e.fixedPriority })
      } else {
        this.map.delete(k)
      }
    }
  }
}
