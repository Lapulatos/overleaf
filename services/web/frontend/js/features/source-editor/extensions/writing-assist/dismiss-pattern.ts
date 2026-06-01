/**
 * Dismiss-pattern engine (shared logic; the matcher is mirrored on the backend
 * in WritingAssistDismissalManager.compileMatcher — keep them in sync).
 *
 * When a user dismisses a suggestion we store only the CHANGED part as a
 * pattern, not the whole sentence, so the note still matches future sentences
 * that share the same problem with different filler words between the changes.
 *
 * We anchor on the ORIGINAL words (the text as it appears in the document, which
 * is what the checker reads):
 *
 *   buildDismissPattern("find abc out", "finds abc up") => "find .* out"
 *     - word-diff the two sentences (LCS),
 *     - keep the ORIGINAL changed words verbatim,
 *     - replace each run of unchanged words BETWEEN changes with ".*",
 *     - drop unchanged words before the first / after the last change.
 *   A pure insertion (no original word changed) has no anchor, so we fall back
 *   to storing the whole original sentence.
 *
 * matchesDismissPattern compiles a note to a regex: ".*" becomes a non-greedy
 * any-text gap, every literal chunk is escaped and individually word-edge
 * bounded ((?<!\w)chunk(?!\w)) so "find" never matches inside "finds"/"refind"
 * and the trailing anchor never matches inside another word (e.g. "out" inside
 * "about"). Matching is case-insensitive and whitespace-normalized.
 */

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Split into word tokens (sequences of non-space), preserving order. */
function tokenize(text: string): string[] {
  const t = normalizeText(text)
  return t.length ? t.split(' ') : []
}

/** Escape a literal string for use inside a RegExp (spaces left intact). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * LCS word diff. Returns, per ORIGINAL token, true if it changed (i.e. is NOT
 * part of the longest common subsequence with the corrected tokens).
 */
function originalChangedFlags(orig: string[], corr: string[]): boolean[] {
  const n = orig.length
  const m = corr.length
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        orig[i].toLowerCase() === corr[j].toLowerCase()
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const unchanged = new Array(n).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (orig[i].toLowerCase() === corr[j].toLowerCase()) {
      unchanged[i] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return unchanged.map(u => !u)
}

/**
 * Build the dismiss pattern from an original/corrected sentence pair. Returns a
 * note string to store. Falls back to the whole normalized original sentence
 * when no original word changed (pure insertion / identical).
 */
export function buildDismissPattern(
  original: string,
  corrected: string
): string {
  const orig = tokenize(original)
  const corr = tokenize(corrected)
  if (orig.length === 0) return normalizeText(corrected)
  if (corr.length === 0) return normalizeText(original)

  const changed = originalChangedFlags(orig, corr)
  const firstChanged = changed.indexOf(true)
  if (firstChanged === -1) {
    // No original word changed (pure insertion / identical) — store the whole
    // sentence so the dismiss still has something to match on.
    return normalizeText(original)
  }
  const lastChanged = changed.lastIndexOf(true)

  const parts: string[] = []
  let inGap = false
  for (let k = firstChanged; k <= lastChanged; k++) {
    if (changed[k]) {
      parts.push(orig[k])
      inGap = false
    } else if (!inGap) {
      parts.push('.*')
      inGap = true
    }
  }
  return parts.join(' ')
}

/**
 * Compile a stored note pattern into a tester. ".*" is a non-greedy any-text
 * gap; every other chunk is an escaped literal, individually word-edge bounded
 * ((?<!\w)…(?!\w)). Case-insensitive; normalizes the input text itself.
 */
export function compileDismissMatcher(pattern: string): (text: string) => boolean {
  const norm = normalizeText(pattern)
  if (!norm) return () => false

  const chunks = norm.split(/\s*\.\*\s*/).filter(c => c.length > 0)
  if (chunks.length === 0) return () => false

  const body = chunks
    .map(c => `(?<!\\w)${escapeRegExp(c)}(?!\\w)`)
    .join('[\\s\\S]*?')
  let re: RegExp | null = null
  try {
    re = new RegExp(body, 'i')
  } catch {
    re = null
  }
  const compiled = re
  const lower = norm.toLowerCase()
  return (text: string) => {
    const t = normalizeText(text)
    if (compiled) return compiled.test(t)
    return t.toLowerCase().includes(lower)
  }
}
