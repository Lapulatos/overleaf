import { replaceRecoveredTask } from './recovered-task'
import { ReferenceTools } from './reference-tools'
import { useCallback, useEffect, useRef, useState } from 'react'
import ZoteroLogo from '@/shared/svgs/zotero-logo'
import MaterialIcon from '@/shared/components/material-icon'
import { ZoteroConnection } from './zotero-connection'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import OLButton from '@/shared/components/ol/ol-button'
import {
  AgentTaskResult,
  message,
  type Task,
  type Proposal,
} from './agent-task-result'

type Citation = {
  doi: string | null
  itemKey?: string
  title: string
  authors: { family: string; given: string; name: string }[]
  year: number | null
  venue: string
  url: string
  key: string
  bibtex: string
  source: string
}
const citationIdentity = (citation: Citation) => citation.itemKey || citation.doi || citation.key
type Destination = { id: string; path: string }
export function LiteratureView({ projectId }: { projectId: string }) {
  const base = `/writing-assist/project/${encodeURIComponent(projectId)}`
  const storageKey = `writing-assist-citation:${projectId}`
  const [tab, setTab] = useState<'settings' | 'search' | 'check'>('search')
  const [checkVisited,setCheckVisited]=useState(false)
  useEffect(()=>{if(tab==='check')setCheckVisited(true)},[tab])
  const [errorStage, setErrorStage] = useState<'search' | 'citation'>('citation')
  const [bibtex, setBibtex] = useState('')
  const [fileName, setFileName] = useState('')
  const [enrich, setEnrich] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [source, setSource] = useState('crossref')
  const [connected, setConnected] = useState(false)
  const [nextStart, setNextStart] = useState<number | null>(null)
  const connectionChanged = useCallback((value: boolean) => {
    setConnected(value)
    setResults(null)
    setSelected(new Set())
    setNextStart(null)
  }, [])
  const [results, setResults] = useState<Citation[] | null>(null)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [destination, setDestination] = useState('')
  const [newName, setNewName] = useState('references.bib')
  const [task, setTask] = useState<Task | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const currentTaskId = useRef('')
  useEffect(() => {
    const controller = new AbortController()
    getJSON<Destination[]>(`${base}/literature/bibliographies`, {
      signal: controller.signal,
    })
      .then((values) => {
        if (!values || controller.signal.aborted) return
        setDestinations(values)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(message(error))
      })
    let taskId = ''
    try {
      taskId = sessionStorage.getItem(storageKey) || ''
    } catch {}
    currentTaskId.current = taskId
    if (taskId)
      getJSON<Task>(`${base}/tasks/${taskId}`, { signal: controller.signal })
        .then((value) => {
          if (
            value &&
            !controller.signal.aborted &&
            currentTaskId.current === taskId
          )
            setTask(value)
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(message(error))
        })
    return () => controller.abort()
  }, [base, storageKey, refresh])
  async function search(start = 0) {
    if (busy || (source === 'zotero' ? !connected : !query.trim())) return
    setBusy(true)
    setError('')
    setErrorStage('search')
    if (!start) setSelected(new Set())
    try {
      const value = await getJSON<{
        results: Citation[]
        nextStart?: number | null
      }>(
        source === 'zotero'
          ? `${base}/zotero/items?q=${encodeURIComponent(query.trim())}&start=${start}`
          : `${base}/literature?q=${encodeURIComponent(query.trim())}`
      )
      setResults((current) =>
        start
          ? [...(current || []), ...(value?.results || [])]
          : value?.results || []
      )
      setNextStart(value?.nextStart ?? null)
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  async function preview(selection: Citation | Citation[]) {
    const batch = Array.isArray(selection)
    const citations = batch ? selection : [selection]
    if (!citations.length || busy || pending) return
    const citation = citations[0]
    setErrorStage('citation')
    setBusy(true)
    setError('')
    try {
      const value = await postJSON<{ task: Task }>(
        `${base}/${citation.source === 'Zotero' ? 'zotero' : 'literature'}/preview`,
        {
          body: {
            ...(citation.source === 'Zotero'
              ? batch ? { itemKeys: citations.map(item => item.itemKey) } : { itemKey: citation.itemKey }
              : batch ? { dois: citations.map(item => item.doi) } : { doi: citation.doi }),
            destination: destination ? { docId: destination } : { newName },
          },
        }
      )
      currentTaskId.current = value.task.taskId
      setTask(value.task)
      setSelected(new Set())
      try {
        sessionStorage.setItem(storageKey, value.task.taskId)
      } catch {}
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  async function loadReferenceFile(file?: File) {
    if (!file || busy || pending) return
    setError('')
    if (file.size > 200000) { setError('Choose a reference file smaller than 200 KB'); return }
    try {
      const text = await file.text()
      if (text.includes('\u0000')) throw new Error('Choose a text reference export; binary files are not supported')
      setBibtex(text); setFileName(file.name); setSource('bibtex')
    } catch (error) { setError(message(error)) }
  }
  async function importBibtex() {
    if (busy || pending || !bibtex.trim()) return
    setBusy(true); setError(''); setErrorStage('citation')
    try {
      const value = await postJSON<{ task: Task }>(`${base}/references/import`, { body: { bibtex, enrich, destination: destination ? { docId: destination } : { newName } } })
      currentTaskId.current = value.task.taskId; setTask(value.task)
      try { sessionStorage.setItem(storageKey, value.task.taskId) } catch { /* Session-only fallback. */ }
    } catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  async function decide(proposal: Proposal, accept: boolean) {
    setErrorStage('citation')
    if (!task) return
    setBusy(true)
    setError('')
    try {
      setTask(
        await postJSON<Task>(
          `${base}/tasks/${task.taskId}/proposals/${proposal.id}`,
          { body: { accept } }
        )
      )
      setRefresh((value) => value + 1)
    } catch (error) {
      setError(message(error))
      setRefresh((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }
  const pending = task?.proposals.some((proposal) =>
    ['pending', 'applying'].includes(proposal.status)
  )
  return (
    <div className="paper-assistant-view paper-literature-view">
      <div className="paper-literature-tabs" role="tablist" aria-label="References views">
        <button type="button" role="tab" id="literature-settings-tab" aria-controls="literature-settings-panel" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>
        <button type="button" role="tab" id="literature-search-tab" aria-controls="literature-search-panel" aria-selected={tab === 'search'} onClick={() => setTab('search')}>Search</button>
        <button type="button" role="tab" id="references-check-tab" aria-controls="references-check-panel" aria-selected={tab === 'check'} onClick={() => setTab('check')}>Check</button>
      </div>
      <div role="tabpanel" id="references-check-panel" aria-labelledby="references-check-tab" hidden={tab !== 'check'}>
        {(checkVisited || tab === 'check') && <ReferenceTools projectId={projectId} />}
      </div>
      <div role="tabpanel" id="literature-settings-panel" aria-labelledby="literature-settings-tab" hidden={tab !== 'settings'}>
      <label htmlFor="reference-source">Reference source</label>
      <div className={`paper-reference-source ${source === 'zotero' ? 'paper-reference-source-zotero' : ''}`}>
      {source === 'zotero' && <span aria-hidden="true" className="paper-reference-source-icon"><ZoteroLogo size={20} /></span>}
      <select
        id="reference-source"
        className="form-control"
        value={source}
        disabled={busy}
        onChange={(event) => {
          setSource(event.target.value)
          setConnected(false)
          setResults(null)
          setSelected(new Set())
          setNextStart(null)
          setError('')
        }}
      >
        <option value="crossref">Crossref</option>
        <option value="zotero">My Zotero library</option>
        <option value="bibtex">Reference file or text</option>
      </select>
      </div>
      {source === 'zotero' && (
        <ZoteroConnection
          endpoint={`${base}/zotero`}
          disabled={busy}
          onConnectionChange={connectionChanged}
        />
      )}
      <button type="button" className="paper-literature-start" onClick={() => setTab('search')}>{source === 'bibtex' ? 'Import reference files' : 'Search this library'} <span aria-hidden="true">→</span></button>
      </div>
      <div role="tabpanel" id="literature-search-panel" aria-labelledby="literature-search-tab" hidden={tab !== 'search'}>
      <div className="paper-literature-source-badge">{source === 'zotero' && <ZoteroLogo size={18} />}<span>{source === 'zotero' ? 'My Zotero library' : source === 'bibtex' ? 'Reference file import' : 'Crossref'}</span><button type="button" onClick={() => setTab('settings')}>Change source</button></div>
      {source !== 'bibtex' && <button type="button" className="paper-reference-import-shortcut" onClick={() => {setSource('bibtex');setError('')}}>Import reference files</button>}
      {source === 'zotero' && !connected && <p>Connect your Zotero library in Settings to search.</p>}
      {source !== 'bibtex' && <>
      <label htmlFor="literature-query">
        {source === 'zotero' ? 'Title, author or year' : 'Title, author or DOI'}
      </label>
      <div className="paper-literature-input-row">
      <input
        id="literature-query"
        className="form-control"
        maxLength={300}
        value={query}
        disabled={busy}
        onChange={(event) => {
          setQuery(event.target.value)
          setNextStart(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') search()
        }}
      />
      <OLButton
        className="paper-literature-icon-button" aria-label="Search references" title="Search references"
        disabled={busy || (source === 'zotero' ? !connected : !query.trim())}
        onClick={() => search()}
      >
        <MaterialIcon type="search" />
      </OLButton>
      </div>
      </>}
      {source === 'bibtex' && <div className="paper-reference-import">
        <section className="paper-reference-drop" aria-label="Drop reference file"
          onDragOver={event => event.preventDefault()}
          onDrop={event => {event.preventDefault(); if(event.dataTransfer.files.length!==1){setError('Import one reference file at a time');return} loadReferenceFile(event.dataTransfer.files[0])}}>
          <strong>Drop a reference file here</strong>
          <p>BibTeX · RIS · EndNote tagged · CSL-JSON</p>
          <label htmlFor="reference-bibtex-file">Choose reference file</label>
          <input id="reference-bibtex-file" type="file" accept=".bib,.bibtex,.ris,.enw,.txt,.json" disabled={busy || pending}
            onChange={event => {loadReferenceFile(event.target.files?.[0]);event.target.value=''}} />
          {fileName && <p role="status">{fileName}</p>}
        </section>
        <details><summary>Paste or inspect reference text</summary>
          <label htmlFor="reference-bibtex-input">Reference file contents</label>
          <textarea id="reference-bibtex-input" rows={8} value={bibtex} maxLength={200000} disabled={busy || pending} onChange={event => {setBibtex(event.target.value);setFileName('')}} placeholder="Paste BibTeX, RIS, EndNote tagged text or CSL-JSON…" />
        </details>
        <label className="paper-reference-enrich"><input type="checkbox" checked={enrich} disabled={busy || pending} onChange={event=>setEnrich(event.target.checked)}/>Check DOI metadata and fill missing fields</label>
        <p className="paper-reference-note">Review normalized BibTeX and source differences before importing. Up to 50 references · 200 KB.</p>
        <OLButton disabled={busy || pending || !bibtex.trim()} onClick={importBibtex}>Preview reference import</OLButton>
      </div>}
      {busy && <p role="status">Loading references…</p>}
      <details
        className="paper-assistant-destination"
        open={source === 'bibtex' || undefined}
      >
        <summary>
          Save references to {destination ? 'existing bibliography' : newName}
        </summary>
        <label htmlFor="bibliography-destination">
          Bibliography destination
        </label>
        <select
          id="bibliography-destination"
          className="form-control"
          value={destination}
          disabled={busy}
          onChange={(event) => setDestination(event.target.value)}
        >
          <option value="">Create a new bibliography</option>
          {destinations.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.path}
            </option>
          ))}
        </select>
        {!destination && (
          <>
            <label htmlFor="bibliography-name">New bibliography filename</label>
            <input
              id="bibliography-name"
              className="form-control"
              value={newName}
              maxLength={124}
              disabled={busy}
              onChange={(event) => setNewName(event.target.value)}
            />
          </>
        )}
      </details>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <OLButton
            disabled={busy}
            onClick={() => {
              if (errorStage === 'search') search()
              else { setError(''); setRefresh((value) => value + 1) }
            }}
          >
            {errorStage === 'search' ? 'Retry search' : 'Refresh citation'}
          </OLButton>
        </div>
      )}
      {task && <AgentTaskResult onRecovered={value=>setTask(current=>replaceRecoveredTask(current,value))} task={task} busy={busy} act={decide} />}
      {pending && (
        <p>Accept or reject the current import before preparing another.</p>
      )}
      {results?.length === 0 && <p>No references found.</p>}
      {!!results?.length && <div className="paper-literature-selection" role="region" aria-label="Selected references">
        <div className="paper-literature-selection-count"><strong>{selected.size} selected</strong><span>{results.length} results</span></div>
        <div className="paper-literature-selection-actions">
          <label><input type="checkbox" aria-label="Select loaded references" disabled={busy || pending}
            checked={results.slice(0, 50).every(item => selected.has(citationIdentity(item)))}
            onChange={event => setSelected(new Set(event.target.checked ? results.slice(0, 50).map(item => citationIdentity(item)) : []))} /> Select loaded{results.length > 50 ? ' (first 50)' : ''}</label>
          <button type="button" disabled={!selected.size || busy || pending} onClick={() => setSelected(new Set())}>Clear</button>
          <OLButton disabled={!selected.size || busy || pending || (!destination && !newName.trim())}
            onClick={() => preview(results.filter(item => selected.has(citationIdentity(item))))}>Preview selected ({selected.size})</OLButton>
        </div>
      </div>}
      <div className="paper-literature-results" role="list" aria-label="Search results">
      {results?.map((citation) => (
        <article
          key={citationIdentity(citation)}
          className={`paper-literature-result${selected.has(citationIdentity(citation)) ? ' is-selected' : ''}`} role="listitem"
        >
          <div className="paper-literature-result-meta"><label className="paper-literature-select-reference"><input type="checkbox" aria-label={`Select ${citation.title}`}
            checked={selected.has(citationIdentity(citation))} disabled={busy || pending || (selected.size >= 50 && !selected.has(citationIdentity(citation)))}
            onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(citationIdentity(citation)); else next.delete(citationIdentity(citation)); return next })} />{citation.source}</label><span>{citation.year || 'Year unavailable'}</span></div>
          <h4>{citation.title}</h4>
          <p>
            {citation.authors
              .slice(0, 6)
              .map((author) =>
                author.family ? `${author.given} ${author.family}` : author.name
              )
              .join('; ')}
            {citation.authors.length > 6 ? '; …' : ''}
          </p>
          <p>
            {citation.venue}
          </p>
          <div className="paper-literature-result-actions"><a href={citation.url} target="_blank" rel="noopener noreferrer">
            {citation.doi ? `DOI: ${citation.doi}` : 'View library source'}
          </a>
          <OLButton
            disabled={busy || pending || (!destination && !newName.trim())}
            onClick={() => preview(citation)}
          >
            Preview import
          </OLButton></div>
          <details><summary>BibTeX preview</summary><pre>{citation.bibtex}</pre></details>
        </article>
      ))}
      </div>
      {source === 'zotero' && nextStart !== null && (
        <OLButton
          disabled={busy || !connected}
          onClick={() => search(nextStart)}
        >
          Load more references
        </OLButton>
      )}
      </div>
    </div>
  )
}
