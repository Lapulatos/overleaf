import { createPortal } from 'react-dom'
import { parsePatch } from 'diff'
import ComparisonEditor from './comparison-editor'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FileLabel } from './file-presentation'

export type DiffVersions = { before: string; after: string }
const shortVersion = (version: string) => version.replace(/[a-f0-9]{40,64}/g, hash => hash.slice(0, 8))

export function EditorDiff({ title, versions, onClose, children }: { title: string; versions?: DiffVersions; onClose: () => void; children: ReactNode }) {
  const host = document.getElementById('native-git-editor-diff-host')
  if (!host) return null
  return createPortal(<section className="native-git-editor-diff" role="region" aria-label="Git diff">
    <header className="native-git-editor-diff-tab"><FileLabel path={title} /><span className="native-git-diff-versions" title={versions ? `${versions.before} ↔ ${versions.after}` : "Diff"}>{versions ? `${shortVersion(versions.before)} ↔ ${shortVersion(versions.after)}` : "Diff"}</span>
      <button type="button" className="native-git-icon-button" aria-label="Close diff" title="Return to editor" onClick={onClose}>×</button></header>
    <nav className="native-git-diff-path" aria-label="File path" title={title}>{title.split("/").map((part, i) => <span key={i}>{i > 0 && <span aria-hidden="true"> › </span>}{part}</span>)}</nav>
    {children}
  </section>, host)
}

export function PatchComparison({ patch, busy, staged, onHunk, versions }: { patch: string; versions?: DiffVersions; busy?: boolean; staged?: boolean; onHunk?: (index: number) => void }) {
  const scroll = useRef<HTMLDivElement>(null)
  const [marks, setMarks] = useState<{ node: HTMLElement; top: number; height: number; kind: string; line: string }[]>([])
  const [cursor, setCursor] = useState<{ top: number; line: string; side: string } | null>(null)
  const [viewport, setViewport] = useState({ top: 0, height: 100 })
  useEffect(() => {
    const element = scroll.current
    if (!element) return
    const updateCursor = (event: Event) => {
      const detail = (event as CustomEvent<{ top: number; line: string; side: string }>).detail
      setCursor({ ...detail, top: Math.max(0, Math.min(100, (detail.top - element.getBoundingClientRect().top + element.scrollTop) / Math.max(1, element.scrollHeight) * 100)) })
    }
    setCursor(null)
    element.addEventListener('git-diff-cursor', updateCursor)
    const measure = () => {
      const height = Math.max(1, element.scrollHeight)
      const rect = element.getBoundingClientRect()
      setMarks(Array.from(element.querySelectorAll<HTMLElement>('.native-git-changed-row')).map(node => ({ node,
        top: (node.getBoundingClientRect().top - rect.top + element.scrollTop) / height * 100,
        height: Math.max(.4, node.offsetHeight / height * 100), kind: node.dataset.kind || 'modified', line: node.dataset.line || '' })))
      setViewport({ top: element.scrollTop / height * 100, height: element.clientHeight / height * 100 })
    }
    measure()
    element.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    if (element.firstElementChild) observer?.observe(element.firstElementChild)
    return () => { element.removeEventListener('git-diff-cursor', updateCursor); element.removeEventListener('scroll', measure); observer?.disconnect() }
  }, [patch])
  let parsed: ReturnType<typeof parsePatch> = []
  try { parsed = parsePatch(patch) } catch { /* Native binary/type changes do not have text hunks. */ }
  if (!parsed.some(file => file.hunks.length)) return <p className="native-git-empty">{patch.includes('Binary files') ? 'Binary file changed. Text comparison is unavailable.' : patch.trim() ? 'File metadata changed. No text differences.' : 'No text differences'}</p>
  let hunkIndex = 0
  return <div className="native-git-comparison-layout"><div ref={scroll} className="native-git-comparison-scroll">{parsed.map((file, fileIndex) => <div key={fileIndex}>
    <div className="native-git-comparison-labels"><span title={versions?.before}>{versions ? shortVersion(versions.before) : "Before"}</span><span title={versions?.after}>{versions ? shortVersion(versions.after) : "After"}</span></div>
    {file.hunks.map(hunk => {
      const index = hunkIndex++
      let old = hunk.oldStart, next = hunk.newStart
      const rows: { left?: string; right?: string; old?: number; next?: number; changed?: boolean }[] = []
      let removed: string[] = [], added: string[] = []
      const flush = () => {
        for (let i = 0; i < Math.max(removed.length, added.length); i++) rows.push({ left: removed[i], right: added[i], old: i < removed.length ? old++ : undefined, next: i < added.length ? next++ : undefined, changed: true })
        removed = []; added = []
      }
      for (const line of hunk.lines) {
        if (line.startsWith('-')) removed.push(line.slice(1))
        else if (line.startsWith('+')) added.push(line.slice(1))
        else if (line.startsWith(' ')) { flush(); rows.push({ left: line.slice(1), right: line.slice(1), old: old++, next: next++ }) }
      }
      flush()
      return <section className="native-git-comparison-hunk" key={index}>
        <div className="native-git-hunk-heading"><span>Lines {hunk.oldStart} → {hunk.newStart}</span>
          {onHunk && <button type="button" className="btn btn-default btn-sm" disabled={busy} aria-label={`${staged ? 'Unstage' : 'Stage'} change ${index + 1}`} onClick={() => onHunk(index)}>{staged ? 'Unstage change' : 'Stage change'}</button>}</div>
        <div className="native-git-editor-pair"><ComparisonEditor rows={rows} side="left" /><ComparisonEditor rows={rows} side="right" /></div>
      </section>
    })}
  </div>)}</div><aside className="native-git-change-overview" aria-label="Change overview">
    <div className="native-git-overview-viewport" style={{ top: `${viewport.top}%`, height: `${viewport.height}%` }} />
    {marks.map((mark, i) => <button type="button" key={i} className={`native-git-overview-mark is-${mark.kind}`} style={{ top: `${mark.top}%`, height: `${mark.height}%` }} title={`Line ${mark.line}`} aria-label={`Go to change at line ${mark.line}`} onClick={() => mark.node.scrollIntoView({ block: 'center' })} />)}
    {cursor && <div className="native-git-overview-cursor" role="status" aria-label={`Cursor: ${cursor.side}, line ${cursor.line}`} title={`${cursor.side} · Line ${cursor.line}`} style={{ top: `${cursor.top}%` }} />}
  </aside></div>
}
