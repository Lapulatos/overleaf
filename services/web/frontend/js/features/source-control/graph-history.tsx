import { useEffect, useRef, useState, type ReactNode, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import { Modal, Dropdown } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import CommitGraph from './commit-graph'
import { errorMessage, type GitApi } from './api'
import type { GitBranch, GitCommit } from './types'

type Props = Omit<ComponentProps<typeof CommitGraph>, 'commits'> & {
  extraTools?: ReactNode
  graphOptions?: Record<string, unknown>
  initialSelection?: { mode: string; refs: string[] }
  inlineToolbar?: boolean
  currentRef?: string
  onRefresh?: () => unknown
  onFetchAll?: () => unknown
  onPull?: () => unknown
  onPublish?: () => unknown
  api: GitApi
  commits: GitCommit[]
  branches: GitBranch[]
}
const pageSize = 100

export default function GraphHistory({ api, commits, branches, extraTools, graphOptions, initialSelection, inlineToolbar = false, currentRef = 'HEAD', onRefresh, onFetchAll, onPull, onPublish, ...graphProps }: Props) {
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setToolbarHost(inlineToolbar ? null : document.getElementById('native-git-graph-toolbar-host')) }, [inlineToolbar])
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [ref, setRef] = useState('')
  const [refs, setRefs] = useState<string[]>([])
  const [picker, setPicker] = useState(false)
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState<string[]>([])
  const [mode, setMode] = useState('all')
  const [draftMode, setDraftMode] = useState('all')
  const [tree, setTree] = useState(true)
  const [locate, setLocate] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!initialSelection) return; setMode(initialSelection.mode); setRef(initialSelection.mode === 'auto' ? currentRef : ''); setRefs(initialSelection.mode === 'selected' ? initialSelection.refs : []) }, [initialSelection?.mode, JSON.stringify(initialSelection?.refs)]) // eslint-disable-line react-hooks/exhaustive-deps
  const refOptions = refs.length ? { refs } : ref ? { ref } : {}
  const goCurrent = () => { setLoaded([]); setRefreshVersion(value => value + 1); setQuery(''); setSearch(''); setRefs([]); setRef(currentRef); setMode('auto'); setLocate(true) }
  useEffect(() => { if (mode === 'auto') setRef(currentRef) }, [currentRef, mode])
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  const [loaded, setLoaded] = useState<GitCommit[]>(commits)
  const [more, setMore] = useState(commits.length >= pageSize)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  // Refresh only when native history/refs actually change, not on each status object.
  const version = JSON.stringify(commits.map(commit => [commit.hash, commit.refs]))
  const refsVersion = JSON.stringify(branches.map(branch => [branch.ref, branch.commit]))
  useEffect(() => {
    const request = ++generation.current
    setError('')
    if (!ref && !refs.length && !search && !graphOptions) {
      setLoaded(commits); setMore(commits.length >= pageSize); setLoading(false)
    } else {
      setLoaded([]); setLoading(true)
      api.command({ command: 'graph', ...graphOptions, ...refOptions, ...(search ? { query: search } : {}), limit: pageSize, skip: 0 }).then(result => {
        if (request !== generation.current) return
        const rows = result.result as GitCommit[]
        setLoaded(rows); setMore(rows.length === pageSize)
      }).catch(error => { if (request === generation.current) setError(errorMessage(error)) })
        .finally(() => { if (request === generation.current) setLoading(false) })
    }
    return () => { generation.current++ }
    // commits are represented by their native hash/ref signature above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ref, JSON.stringify(refs), search, version, refsVersion, refreshVersion, JSON.stringify(graphOptions)])
  // Parent links may point outside the currently loaded page or branch filter.
  useEffect(() => {
    const hash = graphProps.selectedHash
    if (!hash || loaded.some(commit => commit.hash === hash)) return
    setQuery(''); setSearch(''); setRefs([]); setRef(hash); setMode('selected')
  }, [graphProps.selectedHash]) // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore = async () => {
    if (loading) return
    const request = generation.current
    setLoading(true); setError('')
    try {
      const result = await api.command({ command: 'graph', ...graphOptions, ...refOptions, ...(search ? { query: search } : {}), limit: pageSize, skip: loaded.length })
      if (request !== generation.current) return
      const rows = result.result as GitCommit[]
      setLoaded(previous => [...previous, ...rows.filter(row => !previous.some(item => item.hash === row.hash))])
      setMore(rows.length === pageSize)
    } catch (error) { if (request === generation.current) setError(errorMessage(error)) }
    finally { if (request === generation.current) setLoading(false) }
  }
  useEffect(() => {
    if (!locate || loading || !loaded.length) return
    const hash = branches.find(branch => branch.ref === currentRef)?.commit || loaded[0].hash
    const target = root.current?.querySelector<HTMLButtonElement>(`[data-commit="${hash}"]`)
    if (target) { target.scrollIntoView({ block: 'nearest' }); target.focus(); setLocate(false) }
  }, [locate, loading, loaded, currentRef, branches])
  const toolbarButton = (label: string, icon: string, action?: () => unknown) => <button type="button" className="native-git-icon-button" title={label} aria-label={label} disabled={graphProps.busy || !action} onClick={() => action?.()}><MaterialIcon type={icon} /></button>
  const toolbar = (
<div className="native-git-graph-toolbar" role="toolbar" aria-label="Graph actions">
      {inlineToolbar ? <div className="native-git-branch-combobox" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setPicker(false) }}>
        <label htmlFor="native-git-branch-search">Branches:</label>
        <div className="native-git-branch-input">
          <input id="native-git-branch-search" className="form-control" role="combobox" aria-label="Filter graph branches" aria-expanded={picker} aria-controls="native-git-branch-options" aria-autocomplete="list" autoComplete="off"
            value={picker ? filter : mode === 'all' ? 'Show All' : mode === 'auto' ? currentRef.replace('refs/heads/', '') : branches.find(branch => branch.ref === (refs[0] || ref))?.name || refs[0] || ref}
            onFocus={() => { setFilter(''); setPicker(true) }} onChange={event => { setFilter(event.target.value); setPicker(true) }}
            onKeyDown={event => { if (event.key === 'Escape') { setPicker(false); event.currentTarget.blur() } if (event.key === 'ArrowDown') { event.preventDefault(); root.current?.querySelector<HTMLButtonElement>('#native-git-branch-options button')?.focus() } }} />
          {picker && <div id="native-git-branch-options" className="native-git-branch-options" role="listbox" aria-label="Matching branches">
            {[{ ref: '', name: 'Show All' }, ...branches.filter(branch => !branch.tag)].filter(branch => branch.name.toLowerCase().includes(filter.toLowerCase())).map(branch => <button type="button" role="option" aria-selected={branch.ref ? refs.includes(branch.ref) : mode === 'all'} key={branch.ref} onClick={() => { setMode(branch.ref ? 'selected' : 'all'); setRefs(branch.ref ? [branch.ref] : []); setRef(''); setPicker(false) }}
              onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const next = event.key === 'ArrowDown' ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling; (next as HTMLElement | null)?.focus() } if (event.key === 'Escape') { setPicker(false); root.current?.querySelector<HTMLInputElement>('#native-git-branch-search')?.blur() } }}>{branch.name}</button>)}
            {!branches.some(branch => !branch.tag && branch.name.toLowerCase().includes(filter.toLowerCase())) && !'show all'.includes(filter.toLowerCase()) && <p>No matching branches</p>}
          </div>}
        </div>
      </div> : <button type="button" className="native-git-reference-button" aria-label="Select history references" title="Select history references" onClick={() => { setDraft(refs.length ? refs : ref ? [ref] : []); setDraftMode(mode); setFilter(''); setPicker(true) }}><MaterialIcon type="account_tree" /><span>{mode === 'all' ? 'All' : mode === 'auto' ? 'Auto' : refs.length === 1 ? branches.find(b => b.ref === refs[0])?.name || refs[0] : `${refs.length} refs`}</span></button>}
      {extraTools || <>{toolbarButton('Go to Current History Item', 'my_location', goCurrent)}
      {toolbarButton('Fetch From All Remotes', 'cloud_download', onFetchAll)}
      {toolbarButton('Pull', 'south', onPull)}
      {toolbarButton('Publish Branch', 'cloud_upload', onPublish)}
      {toolbarButton('Refresh', 'refresh', () => { onRefresh?.(); setRefreshVersion(value => value + 1) })}
      {toolbarButton(tree ? 'View as List' : 'View as Tree', tree ? 'format_list_bulleted' : 'account_tree', () => setTree(value => !value))}
      <Dropdown className="native-git-compact-graph-actions"><Dropdown.Toggle variant="link" className="native-git-icon-button" aria-label="More graph actions">⋯</Dropdown.Toggle>{createPortal(<Dropdown.Menu className="native-git-repository-menu" flip>
        <Dropdown.Item onClick={goCurrent}>Go to Current History Item</Dropdown.Item>
        <Dropdown.Item disabled={graphProps.busy || !onFetchAll} onClick={() => onFetchAll?.()}>Fetch From All Remotes</Dropdown.Item>
        <Dropdown.Item disabled={graphProps.busy || !onPull} onClick={() => onPull?.()}>Pull</Dropdown.Item>
        <Dropdown.Item disabled={graphProps.busy || !onPublish} onClick={() => onPublish?.()}>Publish Branch</Dropdown.Item>
        <Dropdown.Item onClick={() => { onRefresh?.(); setRefreshVersion(value => value + 1) }}>Refresh</Dropdown.Item>
        <Dropdown.Item onClick={() => setTree(value => !value)}>{tree ? 'View as List' : 'View as Tree'}</Dropdown.Item>
      </Dropdown.Menu>, document.body)}</Dropdown></>}
    </div>
  )
  return <div ref={root}>
    {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
    <Modal show={picker && !inlineToolbar} onHide={() => setPicker(false)} aria-label="History references">
      <Modal.Header closeButton><Modal.Title>Select history references</Modal.Title></Modal.Header>
      <Modal.Body><input className="form-control" aria-label="Filter history references" placeholder="Type to filter branches and tags" value={filter} onChange={e => setFilter(e.target.value)} />
        <label className="native-git-ref-choice"><input type="checkbox" checked={draftMode === 'all'} onChange={() => { setDraftMode('all'); setDraft([]) }} />All — all references</label>
        <label className="native-git-ref-choice"><input type="checkbox" checked={draftMode === 'auto'} onChange={() => { setDraftMode('auto'); setDraft([]) }} />Auto — current branch</label>
        <div className="native-git-ref-choices">{branches.filter(branch => `${branch.name} ${branch.commit}`.toLowerCase().includes(filter.toLowerCase())).map(branch => <label key={branch.ref} className="native-git-ref-choice"><input type="checkbox" checked={draftMode === 'selected' && draft.includes(branch.ref)} onChange={e => { setDraftMode('selected'); setDraft(previous => e.target.checked ? [...previous, branch.ref] : previous.filter(ref => ref !== branch.ref)) }} /><span>{branch.name}</span><code>{branch.commit.slice(0, 8)}</code></label>)}</div>
      </Modal.Body><Modal.Footer><button className="btn btn-primary" disabled={draftMode === 'selected' && !draft.length} onClick={() => { setMode(draftMode); setRef(draftMode === 'auto' ? currentRef : ''); setRefs(draftMode === 'selected' ? draft : []); setPicker(false) }}>OK</button></Modal.Footer>
    </Modal>
    <input type="search" className="form-control native-git-history-search" aria-label="Search history" placeholder="Search history" value={query} onChange={event => setQuery(event.target.value)} />
    {error && <p role="alert" className="native-git-error">{error}</p>}
    <CommitGraph {...graphProps} branches={branches} tree={tree} commits={loaded} emptyMessage={loading ? 'Loading history…' : search ? 'No matching commits' : 'No commits yet'} />
    {more && <button type="button" className="btn btn-default btn-sm" disabled={loading} onClick={loadMore}>{loading ? 'Loading history…' : 'Load earlier commits'}</button>}
    {loading && !more && <p role="status">Loading history…</p>}
  </div>
}
