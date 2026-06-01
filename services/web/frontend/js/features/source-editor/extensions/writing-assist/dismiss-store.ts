import {
  listDismissals,
  addDismissal,
  updateDismissal,
  deleteDismissal,
  type DismissalItem,
} from '../../../../utils/api/writing-assist'
import { compileDismissMatcher, normalizeText } from './dismiss-pattern'

/**
 * Normalize a note for stable comparison. MUST match the backend rule in
 * WritingAssistDismissalManager.normalize: trim and collapse internal
 * whitespace runs to single spaces.
 */
export function normalizeDismissal(text: string): string {
  return normalizeText(text)
}

/**
 * Shared "dismiss notebook" state.
 *
 * A single module-level instance bridges two worlds:
 *  - the React rail panel (CRUD UI), and
 *  - the non-React CodeMirror checker (which calls `has()` to skip dismissed
 *    sentences before sending them to the LLM).
 *
 * It owns a normalized Set for O(1) membership tests, the full item list for
 * the panel, and a listener set so both sides re-render/re-check on change.
 * CRUD methods optimistically call the backend then refresh local state.
 */
class DismissStore {
  private items: DismissalItem[] = []
  private matchers: Array<(text: string) => boolean> = []
  private listeners = new Set<() => void>()
  private loaded = false

  /**
   * True if `text` matches any note. Notes are diff-patterns (may contain
   * "(a|b)" alternations and ".*" gaps) compiled to word-bounded,
   * case-insensitive matchers — so "(find|finds) .* (out|up)" also skips
   * "finds the way out". Used by the checker to skip sentences before the LLM.
   */
  has(text: string): boolean {
    return this.matchers.some(m => m(text))
  }

  getItems(): DismissalItem[] {
    return this.items
  }

  isLoaded(): boolean {
    return this.loaded
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  private setItems(items: DismissalItem[]): void {
    this.items = items
    this.matchers = items.map(i => compileDismissMatcher(i.text))
    this.emit()
  }

  /** Fetch the notebook from the backend (once unless `force`). */
  async load(force = false): Promise<void> {
    if (this.loaded && !force) return
    try {
      const items = await listDismissals()
      this.loaded = true
      this.setItems(items)
    } catch {
      // Leave state empty on failure; the backend still backstops checks.
    }
  }

  /**
   * Add a note (a diff-pattern like "(find|finds) .* (out|up)", or a plain
   * sentence typed in the panel). Updates local matchers immediately so an
   * in-flight re-check skips matching sentences at once, then persists. Skips
   * the network call when an identical note already exists.
   */
  async add(text: string): Promise<void> {
    const norm = normalizeDismissal(text)
    if (!norm) return
    if (this.items.some(i => normalizeDismissal(i.text) === norm)) return
    this.matchers = [...this.matchers, compileDismissMatcher(norm)]
    this.emit()
    const item = await addDismissal(norm)
    if (!this.items.some(i => i.id === item.id)) {
      this.setItems([item, ...this.items])
    }
  }

  async update(id: string, text: string): Promise<void> {
    const item = await updateDismissal(id, text)
    this.setItems(this.items.map(i => (i.id === id ? item : i)))
  }

  async remove(id: string): Promise<void> {
    await deleteDismissal(id)
    this.setItems(this.items.filter(i => i.id !== id))
  }
}

export const dismissStore = new DismissStore()
export type { DismissalItem }
