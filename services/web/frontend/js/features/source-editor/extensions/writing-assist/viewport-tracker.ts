import { EditorView } from '@codemirror/view'
import { SentenceFingerprintCache, fingerprintSync } from './sentence-fingerprint'
import type { Issue } from './types'

export function segmentSentences(text: string): string[] {
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    const segments = segmenter.segment(text)
    return Array.from(segments, s => s.segment.trim()).filter(s => s.length > 0)
  } catch {
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && /[a-zA-Z]/.test(s))
  }
}

export interface ViewportSnapshot {
  sentences: Array<{ text: string; hash: string }>
  unchecked: Array<{ text: string; hash: string }>
  cachedIssues: Map<string, Issue[]>
}

export class ViewportTracker {
  private lastFrom = -1
  private lastTo = -1
  private cache: SentenceFingerprintCache
  private onChangeCallback: ((snapshot: ViewportSnapshot) => void) | null = null

  constructor(projectId: string) {
    this.cache = new SentenceFingerprintCache(projectId)
  }

  onChange(callback: (snapshot: ViewportSnapshot) => void): void {
    this.onChangeCallback = callback
  }

  getCache(): SentenceFingerprintCache {
    return this.cache
  }

  update(view: EditorView): ViewportSnapshot | null {
    const vp = view.viewport
    if (vp.from === this.lastFrom && vp.to === this.lastTo) {
      return null
    }
    this.lastFrom = vp.from
    this.lastTo = vp.to

    const visibleText = view.state.sliceDoc(vp.from, vp.to)
    const sentences = segmentSentences(visibleText)

    const cachedIssues = new Map<string, Issue[]>()
    const unchecked: Array<{ text: string; hash: string }> = []
    const allSentences: Array<{ text: string; hash: string }> = []

    for (const s of sentences) {
      const hash = fingerprintSync(s)
      allSentences.push({ text: s, hash })
      const cached = this.cache.get(hash)
      if (cached) {
        cachedIssues.set(hash, cached)
      } else {
        unchecked.push({ text: s, hash })
      }
    }

    const snapshot: ViewportSnapshot = { sentences: allSentences, unchecked, cachedIssues }
    if (this.onChangeCallback) {
      this.onChangeCallback(snapshot)
    }
    return snapshot
  }

  invalidateRange(from: number, to: number): void {
    this.cache.invalidateRange(from, to)
    this.lastFrom = -1
    this.lastTo = -1
  }
}
