// @ts-check

const CMD = '⟨CMD⟩'
const MATH = '⟨MATH⟩'
const ENV = '⟨ENV⟩'
const CITE = '⟨CITE⟩'
const REF = '⟨REF⟩'

const CITE_CMDS = new Set(['cite','Cite','citep','citet','nocite','citeauthor','citeyear','bibliography','bibliographystyle'])
const REF_CMDS = new Set(['ref','Ref','eqref','label','pageref','autoref','cref','Cref','nameref'])

/**
 * Mask LaTeX constructs. Returns masked text and a remap function
 * that converts masked-text character offsets -> original-text offsets.
 */
function mask(text) {
  /** @type {Array<{ type: 'text', start: number, end: number } | { type: 'token', token: string, start: number }>} */
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
      i += 2
      while (i < len && !(text[i] === '\\' && text[i + 1] === ']')) i++
      if (i < len) i += 2
      segments.push({ type: 'token', token: MATH, start })
      continue
    }

    // $...$ inline math (not $$)
    if (ch === '$' && text[i + 1] !== '$') {
      i++
      while (i < len && text[i] !== '$') {
        if (text[i] === '\\') i++
        if (i < len) i++
      }
      if (i < len) i++
      segments.push({ type: 'token', token: MATH, start })
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
        segments.push({ type: 'token', token: ENV, start })
        continue
      }

      i = skipArgs(text, i)

      if (CITE_CMDS.has(cmd)) {
        segments.push({ type: 'token', token: CITE, start })
      } else if (REF_CMDS.has(cmd)) {
        segments.push({ type: 'token', token: REF, start })
      } else {
        segments.push({ type: 'token', token: CMD, start })
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

  for (const seg of segments) {
    if (seg.type === 'text') {
      for (let p = seg.start; p < seg.end; p++) {
        out.push(text[p])
        origMap.push(p)
      }
    } else {
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

  return { maskedText: out.join(''), remap }
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

export default { mask }
