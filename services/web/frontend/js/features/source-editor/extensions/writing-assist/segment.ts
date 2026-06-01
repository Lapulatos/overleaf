import type { Sentence } from './checker'

/**
 * Split `text` (the visible viewport) into sentences, preserving each
 * sentence's absolute document offset.
 *
 * `baseOffset` is the document position of `text`'s first character; the
 * returned `from` values are document-absolute so issue offsets computed
 * against a single sentence map straight back onto the document.
 *
 * Uses Intl.Segmenter when available (keeps original spans, unlike a trimming
 * splitter), falling back to a regex split that tracks positions manually.
 */
export function segmentWithOffsets(
  text: string,
  baseOffset: number
): Sentence[] {
  const out: Sentence[] = []

  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    for (const seg of segmenter.segment(text)) {
      const raw = seg.segment
      const trimmedStart = raw.length - raw.trimStart().length
      const inner = raw.trim()
      if (inner.length === 0 || !/[a-zA-Z]/.test(inner)) continue
      out.push({ text: inner, from: baseOffset + seg.index + trimmedStart })
    }
    return out
  } catch {
    // Fallback: split on sentence-ending punctuation followed by whitespace.
    const re = /[^.!?\n]*[.!?\n]+|\S[^.!?\n]*$/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const raw = m[0]
      const trimmedStart = raw.length - raw.trimStart().length
      const inner = raw.trim()
      if (inner.length === 0 || !/[a-zA-Z]/.test(inner)) continue
      out.push({ text: inner, from: baseOffset + m.index + trimmedStart })
    }
    return out
  }
}
