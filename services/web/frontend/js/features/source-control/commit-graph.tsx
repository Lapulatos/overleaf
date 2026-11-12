import { PresenceMarkers } from './git-presence-list'
import type { GitPresence } from './git-presence'
import { formatGitDate } from './format-date'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Overlay, Popover } from 'react-bootstrap'
import type { CommitDetails, CommitFile, GitCommit, GitWebRemote } from './types'
import { FileLabel, FileStatus, OpenFileIcon } from './file-presentation'

export const graphColors = ['#4285b4', '#9b62b5', '#389477', '#c08836', '#ce657b', '#638bc2']
export function graphRows(commits: GitCommit[]) {
  let lanes: string[] = []
  const colors = new Map<string, string>()
  let nextColor = 0
  return commits.map(commit => {
    if (!lanes.includes(commit.hash)) lanes.push(commit.hash)
    if (!colors.has(commit.hash)) colors.set(commit.hash, graphColors[nextColor++ % graphColors.length])
    const color = colors.get(commit.hash)!
    const before = [...lanes]
    const column = lanes.indexOf(commit.hash)
    lanes.splice(column, 1)
    commit.parents.forEach((parent, index) => {
      if (!colors.has(parent)) colors.set(parent, index === 0 ? color : graphColors[nextColor++ % graphColors.length])
    })
    for (const parent of [...commit.parents].reverse()) if (!lanes.includes(parent)) lanes.splice(column, 0, parent)
    return { commit, column, before, after: [...lanes], color, colors: new Map(colors) }
  })
}

export default function CommitGraph({ commits, presence = [], detailed = false, selectedHash, selectedDetails, branches = [], onCheckout, onSelect, onFile, onOpenFile, onInspect, expanded = {}, details = {}, webRemotes = [], tree = true, emptyMessage = 'No commits yet', busy }: {
  presence?: GitPresence[]
  detailed?: boolean
  branches?: import('./types').GitBranch[]
  onCheckout?: (branch: import('./types').GitBranch) => void
  selectedHash?: string
  selectedDetails?: ReactNode
  tree?: boolean
  emptyMessage?: string
  webRemotes?: GitWebRemote[]
  commits: GitCommit[]; onSelect: (commit: GitCommit) => void; busy: boolean
  onFile?: (commit: GitCommit, file: CommitFile) => void
  onOpenFile?: (path: string) => void
  onInspect?: (commit: GitCommit) => void
  expanded?: Record<string, boolean>; details?: Record<string, CommitDetails>
}) {
  const rows = graphRows(commits)
  const columns = Math.max(1, ...rows.map(row => Math.max(row.before.length, row.after.length)))
  const x = (column: number) => 10 + column * 16
  const [hover, setHover] = useState<{ commit: GitCommit; target: HTMLElement }>()
  const historyIdentity = commits.map(commit => commit.hash).join(',')
  useEffect(() => { setHover(undefined) }, [historyIdentity])
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!hover) return
    const dismiss = () => { clearTimeout(timer.current); setHover(undefined) }
    // A portalled card must not outlive its row's visible scroll position.
    const onScroll = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.native-git-commit-popover')) return
      dismiss()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('blur', dismiss)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('blur', dismiss)
    }
  }, [hover])
  const keep = () => { clearTimeout(timer.current) }
  const leave = () => { timer.current = setTimeout(() => setHover(undefined), 180) }
  return <div className="native-git-graph" aria-label="Commit history" style={{ '--graph-lane-width': `${columns * 16 + 4}px` } as React.CSSProperties}>
    {detailed && <div className="native-git-graph-columns"><span>Graph</span><span>Description</span><span className="native-git-column-centered">Date</span><span className="native-git-column-centered">Author</span><span>Commit</span></div>}
    {rows.map(({ commit, column, before, after, color, colors }) => <div key={commit.hash}>
      <button type="button" data-commit={commit.hash} className={`native-git-commit ${expanded[commit.hash] || selectedHash === commit.hash ? 'is-expanded' : ''} ${detailed ? 'native-git-commit-detailed' : ''}`} disabled={busy}
        aria-expanded={!!expanded[commit.hash]} onClick={() => { setHover(undefined); onSelect(commit) }}
        onMouseEnter={event => { keep(); setCopied(false); setHover({ commit, target: event.currentTarget }); onInspect?.(commit) }}
        onMouseLeave={leave} onFocus={event => { keep(); setHover({ commit, target: event.currentTarget }); onInspect?.(commit) }} onBlur={leave}>
        <svg viewBox={`0 0 ${columns * 16 + 4} 32`} preserveAspectRatio="none" width={columns * 16 + 4} height="32" aria-hidden="true" className="native-git-graph-lines">
          {before.map((hash, index) => hash === commit.hash
            ? <path key={hash} stroke={colors.get(hash)} d={`M${x(index)} 0V16`} />
            : <path key={hash} stroke={colors.get(hash)} d={`M${x(index)} 0C${x(index)} 16 ${x(after.indexOf(hash))} 16 ${x(after.indexOf(hash))} 32`} />)}
          {commit.parents.map(parent => <path key={parent} stroke={colors.get(parent)} d={`M${x(column)} 16C${x(column)} 25 ${x(after.indexOf(parent))} 25 ${x(after.indexOf(parent))} 32`} />)}
          <circle cx={x(column)} cy="16" r={expanded[commit.hash] ? 5 : 4} stroke={color} />
        </svg>
        {detailed && <span className="native-git-commit-dot" aria-hidden="true" style={{ left: x(column) - 5, borderColor: color }} />}
        <span className="native-git-commit-description">{detailed && commit.refs && <span className="native-git-full-refs">{commit.refs.split(', ').map(ref => { const name = ref.replace(/^HEAD -> /, ''); const branch = branches.find(branch => branch.name === name && !branch.tag); return <span className="native-git-ref" key={ref} title={branch ? `Double-click to checkout ${name}` : name} onClick={event => event.stopPropagation()} onDoubleClick={event => { event.stopPropagation(); if (branch && !busy) onCheckout?.(branch) }}>{name}</span> })}</span>}<span>{commit.subject}</span><PresenceMarkers sessions={presence} hash={commit.hash} /></span>
        {detailed && <time className="native-git-commit-date" dateTime={commit.date} title={formatGitDate(commit.date)}>{formatGitDate(commit.date)}</time>}
        <span className="native-git-commit-author" title={commit.author}>{commit.author}</span>
        {!detailed && commit.refs && <span className="native-git-ref">{commit.refs.replace(/^HEAD -> /, '')}</span>}
        {detailed && <code className="native-git-commit-hash" title={commit.hash}>{commit.hash.slice(0, 8)}</code>}
      </button>
      {selectedHash === commit.hash && selectedDetails && <div className="native-git-inline-details">
        <svg width={columns * 16 + 4} height="100%" aria-hidden="true" className="native-git-expanded-lines">{after.map((hash, i) => <line key={hash} x1={x(i)} x2={x(i)} y1="0" y2="100%" stroke={colors.get(hash)} />)}</svg>
        <div className="native-git-inline-details-content">{selectedDetails}</div>
      </div>}
      {expanded[commit.hash] && <div className="native-git-commit-files">
        <svg width={columns * 16 + 4} height="100%" aria-hidden="true" className="native-git-expanded-lines">{after.map((hash, i) => <line key={hash} x1={x(i)} x2={x(i)} y1="0" y2="100%" stroke={colors.get(hash)} />)}</svg>
        <div style={{ paddingLeft: columns * 16 + 4 }}>
          {!details[commit.hash] ? <p className="native-git-empty" role="status">Loading changed files…</p> : details[commit.hash].files.length ? <CommitFiles files={details[commit.hash].files} tree={tree} renderFile={file => <div className="native-git-graph-file-row" key={file.path}><button type="button" className="native-git-graph-file" disabled={busy} title={file.path} aria-label={`${file.path} at ${commit.hash.slice(0, 8)}`} onClick={() => onFile?.(commit, file)}>
            <FileLabel path={file.path} />
          </button>{onOpenFile && <button type="button" className="native-git-icon-button native-git-open-file" title="Open file in editor" aria-label={`Open file ${file.path}`} onClick={() => onOpenFile(file.path)}><OpenFileIcon /></button>}<FileStatus status={file.status} /></div>} /> : <p className="native-git-empty">No file changes against first parent</p>}
        </div>
      </div>}
    </div>)}
    <Overlay target={hover?.target} show={!!hover} placement="right" flip>
      <Popover className="native-git-commit-popover" onMouseEnter={keep} onMouseLeave={leave}>
        {hover && <Popover.Body>
          <p><strong>{hover.commit.author}</strong> · <time dateTime={hover.commit.date}>{formatGitDate(hover.commit.date)}</time></p>
          <p>{hover.commit.subject}</p>
          {details[hover.commit.hash] && <p>{details[hover.commit.hash].files.length} files changed · <span className="native-git-status-A">+{details[hover.commit.hash].insertions}</span> · <span className="native-git-status-D">−{details[hover.commit.hash].deletions}</span></p>}
          {hover.commit.refs && <p className="native-git-hover-refs">{hover.commit.refs}</p>}
          {/^[a-f0-9]{40,64}$/i.test(hover.commit.hash) && webRemotes.map(remote => <a key={remote.name} className="btn btn-link btn-sm" href={`${remote.commitBaseUrl}${hover.commit.hash}`} target="_blank" rel="noopener noreferrer">Open on {remote.provider}{webRemotes.length > 1 ? ` (${remote.name})` : ''}</a>)}
          <code>{hover.commit.hash.slice(0, 8)}</code>{' '}
          <button type="button" className="btn btn-link btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(hover.commit.hash); setCopied(true) } catch { setCopied(false) } }}>{copied ? 'Copied' : 'Copy commit ID'}</button>
          <button type="button" className="btn btn-link btn-sm" onClick={() => { onSelect(hover.commit); setHover(undefined) }}>{expanded[hover.commit.hash] ? 'Collapse files' : 'Show changed files'}</button>
        </Popover.Body>}
      </Popover>
    </Overlay>
    {commits.length === 0 && <p className="native-git-empty">{emptyMessage}</p>}
  </div>
}

export function CommitFiles<T extends { path: string }>({ files, tree, renderFile }: { files: T[]; tree: boolean; renderFile: (file: T) => React.ReactNode }) {
  if (!tree) return <>{files.map(renderFile)}</>
  const renderDirectory = (prefix: string): React.ReactNode => {
    const direct = files.filter(file => file.path.startsWith(prefix) && !file.path.slice(prefix.length).includes('/'))
    const directories = Array.from(new Set(files.filter(file => file.path.startsWith(prefix) && file.path.slice(prefix.length).includes('/')).map(file => file.path.slice(prefix.length).split('/')[0]))).sort()
    return <>{directories.map(name => <details key={prefix + name} className="native-git-file-folder" open><summary><span aria-hidden="true">▸</span>{name}</summary><div>{renderDirectory(prefix + name + '/')}</div></details>)}{direct.map(renderFile)}</>
  }
  return <div className="native-git-file-tree">{renderDirectory('')}</div>
}
