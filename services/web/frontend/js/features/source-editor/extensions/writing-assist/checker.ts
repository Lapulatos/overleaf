import { checkWriting } from '../../../../utils/api/writing-assist'
import type { Category, Issue } from './types'
import { CATEGORY_COLORS } from './types'
import { SentenceCache } from './sentence-cache'

export type IssueCallback = (issues: Issue[]) => void

export type ProgressState = 'idle' | 'checking' | 'done' | 'error'
export interface Progress {
  state: ProgressState
  total: number
  completed: number
  failed: number
}
export type ProgressCallback = (p: Progress) => void

/** A sentence to check, with its absolute document start offset. */
export interface Sentence {
  text: string
  from: number
}

/**
 * Per-sentence concurrent writing checker with caching.
 *
 * The viewport is split into sentences; each is checked in its own request so
 * a slow model never blocks the whole viewport and results appear
 * progressively. A concurrency limit caps simultaneous requests.
 *
 * Caching: sentences whose exact text was already checked are served from the
 * SentenceCache — no LLM call. Only new/edited sentences are sent, so applying
 * a fix re-checks just the changed sentence, not the whole page.
 *
 * Severity gate: after a fix is applied, the cache holds the fixed severity for
 * the resulting sentence; new suggestions at or above that severity are dropped
 * so a fix never re-introduces an equal/worse problem (no A→B→C→A loops).
 *
 * Offsets: each sentence is sent alone, so backend offsets are sentence-
 * relative; they are stored that way in the cache and re-based by the
 * sentence's document start at render time. A monotonic run token discards
 * results from a superseded run.
 */
export class Checker {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private runNowTimer: ReturnType<typeof setTimeout> | null = null
  private debounceMs: number
  private enabledCategories: Category[]
  private concurrency: number
  private onIssues: IssueCallback
  private onProgress: ProgressCallback
  private cache: SentenceCache
  private runToken = 0
  private abortController: AbortController | null = null
  private projectId: string

  constructor(
    debounceMs: number,
    enabledCategories: Category[],
    concurrency: number,
    cache: SentenceCache,
    onIssues: IssueCallback,
    onProgress: ProgressCallback,
    projectId: string
  ) {
    this.debounceMs = debounceMs
    this.enabledCategories = enabledCategories
    this.concurrency = Math.max(1, concurrency || 4)
    this.cache = cache
    this.onIssues = onIssues
    this.onProgress = onProgress
    this.projectId = projectId
  }

  updateConfig(
    debounceMs: number,
    enabledCategories: Category[],
    concurrency: number
  ): void {
    this.debounceMs = debounceMs
    this.enabledCategories = enabledCategories
    this.concurrency = Math.max(1, concurrency || 4)
  }

  /** Schedule a check of the given sentences after the debounce window. */
  schedule(sentences: Sentence[]): void {
    if (sentences.length === 0) return
    if (this.enabledCategories.length === 0) return

    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.execute(sentences)
    }, this.debounceMs)
  }

  /**
   * Run a check immediately, bypassing the debounce window. Used by the manual
   * "check now" button so a user-triggered check (e.g. retrying after a
   * failure) feels instant. Failed sentences were never cached, so they are
   * re-sent automatically.
   */
  runNow(sentences: Sentence[]): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.runNowTimer) {
      clearTimeout(this.runNowTimer)
      this.runNowTimer = null
    }
    if (sentences.length === 0) return
    if (this.enabledCategories.length === 0) return
    this.runNowTimer = setTimeout(() => {
      this.runNowTimer = null
      void this.execute(sentences)
    }, 0)
  }

  private gate(text: string, issues: Issue[]): Issue[] {
    const fixed = this.cache.fixedPriority(text)
    if (fixed === undefined) return issues
    return issues.filter(i => {
      const p = CATEGORY_COLORS[i.category]?.priority ?? 0
      return p < fixed
    })
  }

  private async execute(sentences: Sentence[]): Promise<void> {
    const token = ++this.runToken
    // Create a new AbortController for this run
    this.abortController = new AbortController()
    const { signal } = this.abortController

    const rebase = (s: Sentence, rel: Issue[]): Issue[] =>
      rel.map(i => ({ ...i, offset: i.offset + s.from }))

    const docIssues = new Map<number, Issue[]>()
    const emit = () => {
      const all: Issue[] = []
      for (const arr of docIssues.values()) all.push(...arr)
      this.onIssues(all.sort((a, b) => a.offset - b.offset))
    }

    const toFetch: number[] = []
    sentences.forEach((s, idx) => {
      const cached = this.cache.get(s.text)
      if (cached !== null) {
        docIssues.set(idx, rebase(s, this.gate(s.text, cached)))
      } else {
        toFetch.push(idx)
      }
    })

    const total = toFetch.length
    let completed = 0
    let failed = 0

    emit()
    if (total === 0) {
      this.onProgress({ state: 'done', total: 0, completed: 0, failed: 0 })
      return
    }
    this.onProgress({ state: 'checking', total, completed, failed })

    let next = 0
    const worker = async (): Promise<void> => {
      while (true) {
        if (token !== this.runToken) return
        if (signal.aborted) return
        const qi = next++
        if (qi >= toFetch.length) return
        const idx = toFetch[qi]
        const s = sentences[idx]
        try {
          const rel = await checkWriting(s.text, this.enabledCategories, this.projectId, signal)
          if (token !== this.runToken) return
          if (signal.aborted) return
          this.cache.set(s.text, rel)
          docIssues.set(idx, rebase(s, this.gate(s.text, rel)))
        } catch (err: unknown) {
          // AbortError means the request was cancelled — not a failure
          if (err instanceof DOMException && err.name === 'AbortError') return
          failed++
        } finally {
          if (token === this.runToken && !signal.aborted) {
            completed++
            emit()
            this.onProgress({ state: 'checking', total, completed, failed })
          }
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(this.concurrency, toFetch.length) },
      () => worker()
    )
    await Promise.all(workers)

    if (token !== this.runToken) return
    if (signal.aborted) return
    this.onProgress({
      state: failed > 0 ? 'error' : 'done',
      total,
      completed,
      failed,
    })
  }

  cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.runNowTimer) {
      clearTimeout(this.runNowTimer)
      this.runNowTimer = null
    }
    this.runToken++
    // Abort all in-flight HTTP requests
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}