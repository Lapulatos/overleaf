// @ts-check

const CMD = '⟨CMD⟩'
const MATH = '⟨MATH⟩'
const ENV = '⟨ENV⟩'
const CITE = '⟨CITE⟩'
const REF = '⟨REF⟩'

const TOKEN_LIST = [CITE, REF, MATH, ENV, CMD]

const CITE_CMDS = new Set(['cite','Cite','citep','citet','nocite','citeauthor','citeyear','bibliography','bibliographystyle'])
const REF_CMDS = new Set(['ref','Ref','eqref','label','pageref','autoref','cref','Cref','nameref'])

/**
 * Mask LaTeX constructs. Returns masked text, a remap function
 * that converts masked-text character offsets -> original-text offsets,
 * and a tokens array for unmasking later.
 */
function mask(text) {
  /** @type {Array<{ type: 'text', start: number, end: number } | { type: 'token', token: string, original: string, start: number }>} */
  const segments = []
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]
    const start = i

    // % comment -> strip
    if (ch === '%' && (i === 0 || text[i - 1] !== '\\')) {
      while (i < len && text[i] !== '\n') i++
      continue
    }

    // \[ ... \] display math
    if (text.startsWith('\\[', i)) {
      const original = text.slice(start, i < len ? text.indexOf('\\]', i) + 2 : len)
      i += 2
      while (i < len && !(text[i] === '\\' && text[i + 1] === ']')) i++
      if (i < len) i += 2
      // Recompute original from start to current i
      const actualOriginal = text.slice(start, i)
      segments.push({ type: 'token', token: MATH, original: actualOriginal, start })
      continue
    }

    // $...$ inline math (not $$)
    if (ch === '$' && text[i + 1] !== '$') {
      const dollarStart = i
      i++
      while (i < len && text[i] !== '$') {
        if (text[i] === '\\') i++
        if (i < len) i++
      }
      if (i < len) i++
      const actualOriginal = text.slice(dollarStart, i)
      segments.push({ type: 'token', token: MATH, original: actualOriginal, start: dollarStart })
      continue
    }

    // \<command>
    if (ch === '\\' && i + 1 < len && /[a-zA-Z]/.test(text[i + 1])) {
      i++
      while (i < len && /[a-zA-Z@]/.test(text[i])) i++
      const cmd = text.slice(start + 1, i)

      // \begin{env} ... \end{env}
      if (cmd === 'begin') {
        const envName = readDelimited(text, i, '{', '}')
        if (envName !== null) {
          i += envName.length + 2
          const endTag = `\\end{${envName}}`
          while (i < len && !text.startsWith(endTag, i)) i++
          if (i < len) i += endTag.length
        }
        const actualOriginal = text.slice(start, i)
        segments.push({ type: 'token', token: ENV, original: actualOriginal, start })
        continue
      }

      i = skipArgs(text, i)
      const actualOriginal = text.slice(start, i)

      if (CITE_CMDS.has(cmd)) {
        segments.push({ type: 'token', token: CITE, original: actualOriginal, start })
      } else if (REF_CMDS.has(cmd)) {
        segments.push({ type: 'token', token: REF, original: actualOriginal, start })
      } else {
        segments.push({ type: 'token', token: CMD, original: actualOriginal, start })
      }
      continue
    }

    // Plain text run
    const runStart = i
    i++
    while (i < len) {
      const c = text[i]
      if (c === '\\' || c === '$' || c === '%') break
      i++
    }
    segments.push({ type: 'text', start: runStart, end: i })
  }

  // Build output
  const out = []
  const origMap = []
  const tokens = [] // ordered list of { token, original } for unmask

  for (const seg of segments) {
    if (seg.type === 'text') {
      for (let p = seg.start; p < seg.end; p++) {
        out.push(text[p])
        origMap.push(p)
      }
    } else {
      tokens.push({ token: seg.token, original: seg.original })
      for (let k = 0; k < seg.token.length; k++) {
        out.push(seg.token[k])
        origMap.push(seg.start)
      }
    }
  }

  function remap(offset) {
    if (offset < 0) return 0
    if (offset >= origMap.length) return len
    return origMap[offset]
  }

  return { maskedText: out.join(''), remap, tokens }
}

/**
 * Unmask token placeholders in the LLM response, converting them back
 * to the original LaTeX commands.
 *
 * @param {string} text - LLM response containing ⟨CITE⟩, ⟨REF⟩, etc.
 * @param {Array<{ token: string, original: string }>} tokens - ordered token
 *   list returned by mask(), preserving the original LaTeX for each occurrence.
 * @returns {string} - text with all tokens replaced by their original LaTeX.
 */
function unmask(text, tokens) {
  // Build a queue of originals per token type, preserving order.
  const queues = {}
  for (const t of tokens) {
    if (!queues[t.token]) queues[t.token] = []
    queues[t.token].push(t.original)
  }

  // Replace each token placeholder with the next original from its queue.
  // Use a global regex that matches any of the known tokens.
  const tokenPattern = new RegExp(
    TOKEN_LIST.map(t => t.replace(/[⟨⟩]/g, '\\u27e8|\\u27e9')).join('|'),
    'g'
  )
  // The actual tokens use Unicode angle brackets ⟨ (U+27E8) and ⟩ (U+27E9).
  // Build a regex that matches any of them literally.
  const pattern = new RegExp(TOKEN_LIST.join('|'), 'g')

  return text.replace(pattern, (match) => {
    const queue = queues[match]
    if (queue && queue.length > 0) {
      return queue.shift()
    }
    // Fallback: if we run out of originals (shouldn't happen with well-behaved
    // LLMs), leave the token as-is so the user can see something went wrong.
    return match
  })
}

function readDelimited(text, pos, open, close) {
  if (pos >= text.length || text[pos] !== open) return null
  let i = pos + 1, depth = 1
  const start = i
  while (i < text.length && depth > 0) {
    if (text[i] === open) depth++
    else if (text[i] === close) depth--
    if (depth > 0) i++
  }
  return text.slice(start, i)
}

function skipArgs(text, pos) {
  while (pos < text.length) {
    const ch = text[pos]
    if (ch === ' ' || ch === '\t' || ch === '\n') { pos++; continue }
    if (ch === '[') {
      const inner = readDelimited(text, pos, '[', ']')
      if (inner === null) break
      pos += inner.length + 2
      continue
    }
    if (ch === '{') {
      const inner = readDelimited(text, pos, '{', '}')
      if (inner === null) break
      pos += inner.length + 2
      continue
    }
    break
  }
  return pos
}

export default { mask, unmask }