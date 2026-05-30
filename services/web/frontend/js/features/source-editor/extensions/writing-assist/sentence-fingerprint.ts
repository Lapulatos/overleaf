import type { SentenceCache, Issue } from '../../../../../../types/writing-assist'

const STORAGE_PREFIX = 'wa-cache-'
const MAX_CACHE_SIZE_BYTES = 5 * 1024 * 1024
const STALE_MS = 24 * 60 * 60 * 1000
const EVICT_FRACTION = 0.2

export function fingerprintSync(text: string): string {
  let hash = 5381
  const trimmed = text.trim()
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) + hash + trimmed.charCodeAt(i)) | 0
  }
  const abs = Math.abs(hash)
  return abs.toString(16).padStart(8, '0').slice(0, 12)
}

export class SentenceFingerprintCache {
  private projectId: string
  private cache: SentenceCache
  private storageKey: string
  private pendingWrites: Map<string, { text: string; issues: Issue[] }>

  constructor(projectId: string) {
    this.projectId = projectId
    this.storageKey = `${STORAGE_PREFIX}${projectId}`
    this.pendingWrites = new Map()
    this.cache = this.load()
  }

  private load(): SentenceCache {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return { version: 1, entries: {} }
      const parsed = JSON.parse(raw) as SentenceCache
      if (parsed.version !== 1) return { version: 1, entries: {} }
      return parsed
    } catch {
      return { version: 1, entries: {} }
    }
  }

  private persist(): void {
    try {
      let json = JSON.stringify(this.cache)
      if (json.length > MAX_CACHE_SIZE_BYTES) {
        this.evict()
        json = JSON.stringify(this.cache)
      }
      localStorage.setItem(this.storageKey, json)
    } catch {
      this.evict()
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.cache))
      } catch {
        // give up silently
      }
    }
  }

  private evict(): void {
    const entries = Object.entries(this.cache.entries)
    if (entries.length === 0) return
    entries.sort((a, b) => a[1].checkedAt - b[1].checkedAt)
    const evictCount = Math.max(1, Math.ceil(entries.length * EVICT_FRACTION))
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      delete this.cache.entries[entries[i][0]]
    }
  }

  has(hash: string): boolean {
    const entry = this.cache.entries[hash]
    if (!entry) return false
    if (Date.now() - entry.checkedAt > STALE_MS) {
      delete this.cache.entries[hash]
      return false
    }
    return true
  }

  get(hash: string): Issue[] | null {
    if (!this.has(hash)) return null
    return this.cache.entries[hash].issues
  }

  set(hash: string, text: string, issues: Issue[]): void {
    this.cache.entries[hash] = { text, checkedAt: Date.now(), issues }
    this.pendingWrites.set(hash, { text, issues })
  }

  flush(): void {
    this.persist()
    this.pendingWrites.clear()
  }

  invalidateRange(_from: number, _to: number): void {
    this.pendingWrites.clear()
  }

  clear(): void {
    this.cache = { version: 1, entries: {} }
    try { localStorage.removeItem(this.storageKey) } catch { /* ignore */ }
  }
}
