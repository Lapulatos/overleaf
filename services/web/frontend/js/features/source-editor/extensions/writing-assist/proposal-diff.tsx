import { useMemo, useState } from 'react'
import { diffLines, diffWordsWithSpace } from 'diff'
import './proposal-diff.css'

type Segment = { text: string; changed: boolean }
export type DiffRow = {
  kind: 'added' | 'removed' | 'context'
  text: string
  oldLine?: number
  newLine?: number
  segments?: Segment[]
}

export function buildDiffRows(before: string, after: string, startLine = 1): DiffRow[] {
  let oldLine = startLine
  let newLine = startLine
  const parts = diffLines(before, after)
  const rows: DiffRow[] = []
  for (const part of parts) {
    const lines = part.value.split('\n')
    if (lines.at(-1) === '') lines.pop()
    for (const text of lines) {
      rows.push({
        kind: part.added ? 'added' : part.removed ? 'removed' : 'context', text,
        oldLine: part.added ? undefined : oldLine++, newLine: part.removed ? undefined : newLine++,
      })
    }
  }
  // Bound word-level work per replacement block; line-level diff remains exact.
  for (let i = 0; i < rows.length;) {
    if (rows[i].kind !== 'removed') { i++; continue }
    const removed: DiffRow[] = []
    const added: DiffRow[] = []
    while (i < rows.length && rows[i].kind === 'removed') removed.push(rows[i++])
    while (i < rows.length && rows[i].kind === 'added') added.push(rows[i++])
    if (removed.length !== added.length) continue
    for (let j = 0; j < removed.length; j++) {
      if (removed[j].text.length + added[j].text.length > 4000) continue
      const words = diffWordsWithSpace(removed[j].text, added[j].text)
      removed[j].segments = words.filter(w => !w.added).map(w => ({ text: w.value, changed: Boolean(w.removed) }))
      added[j].segments = words.filter(w => !w.removed).map(w => ({ text: w.value, changed: Boolean(w.added) }))
    }
  }
  return rows
}

export function ProposalDiff({ before, after, startLine = 1 }: { before: string; after: string; startLine?: number }) {
  const rows = useMemo(() => buildDiffRows(before, after, startLine), [before, after, startLine])
  const [full, setFull] = useState(false)
  const changed = rows.map((r, i) => r.kind === 'context' ? -1 : i).filter(i => i >= 0)
  const visible = new Set<number>()
  for (const i of changed) for (let j = Math.max(0, i - 3); j <= Math.min(rows.length - 1, i + 3); j++) visible.add(j)
  const hideContext = changed.length > 0 && visible.size < rows.length
  let skipped = 0
  return (
    <div className="paper-diff">
      <div className="paper-diff-legend">
        <span className="paper-diff-count-added">+{rows.filter(r => r.kind === 'added').length} added</span>
        <span className="paper-diff-count-removed">−{rows.filter(r => r.kind === 'removed').length} removed</span>
        {hideContext && <button className="btn btn-secondary" type="button" onClick={() => setFull(!full)}>{full ? 'Show changes only' : 'Show full file'}</button>}
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scrollable diff must be reachable for keyboard scrolling. */}
      <div className="paper-diff-scroll" role="region" aria-label="Line diff" tabIndex={0}>
        {rows.map((row, index) => {
          if (!full && hideContext && !visible.has(index)) {
            skipped++
            if (index < rows.length - 1 && !visible.has(index + 1)) return null
            const count = skipped; skipped = 0
            return <div key={`gap-${index}`} className="paper-diff-gap">··· {count} unchanged lines</div>
          }
          return <div key={index} className={`paper-diff-row paper-diff-${row.kind}`}>
            <span className="paper-diff-number" aria-label={row.oldLine ? `Original line ${row.oldLine}` : undefined}>{row.oldLine}</span>
            <span className="paper-diff-number" aria-label={row.newLine ? `New line ${row.newLine}` : undefined}>{row.newLine}</span>
            <span className="paper-diff-sign" aria-label={row.kind}>{row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}</span>
            <code>{row.segments ? row.segments.map((segment, i) => segment.changed ? <mark key={i}>{segment.text}</mark> : segment.text) : row.text || ' '}</code>
          </div>
        })}
        {before === after && <div className="paper-diff-gap">No changes</div>}
        {before !== after && before.endsWith('\n') !== after.endsWith('\n') && <div className="paper-diff-gap">{after.endsWith('\n') ? 'Final newline added' : 'Final newline removed'}</div>}
      </div>
    </div>
  )
}
