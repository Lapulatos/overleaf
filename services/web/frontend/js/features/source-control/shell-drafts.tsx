import TerminalSessionReference from './terminal-session-reference'
import TerminalHistory from './terminal-history'
import { UserAvatar } from './git-presence-list'
import { createPortal } from 'react-dom'
import MaterialIcon from '@/shared/components/material-icon'
import { useEffect, useMemo, useRef, useState } from 'react'
import GitTerminal from './git-terminal'
import { shellTerminalApi } from './shell-terminal-api'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi, type GitCommand } from './api'
type Task = { id: string; createdBy?: string; ownerDisplayName?: string; workspaceId?: string; revision: number; state: string; name?: string; sourcePosition?: {branch:string;head:string|null;dirty:boolean}; sessionStatus?: string; createdAt?: string | number; updatedAt?: string | number; failure?: string; failurePhase?: string }
type Review = { task: Task; fingerprint: string; changes: { path: string; status: string; beforeBytes: number; afterBytes: number }[] }
type Recovery = { task: Task; fingerprint: string; canResume: boolean }
type Side = { exists: boolean; text: string | null; binary: boolean; bytes: number; tooLarge: boolean }
type File = { path: string; before: Side; after: Side }
export default function ShellDrafts({ api, canApply, onClose, autoStart = false, embedded = false, toolbarTarget, active = true }: { active?: boolean; toolbarTarget?: HTMLElement | null; api: GitApi; canApply: boolean; onClose(): void; autoStart?: boolean; embedded?: boolean }) {
  const startId = useRef(crypto.randomUUID())
  const [tasks, setTasks] = useState<Task[]>([])
  const [task, setTask] = useState<Task>()
  const [terminalVisible, setTerminalVisible] = useState(true)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [selectedSessions,setSelectedSessions]=useState<string[]>([])
  const [confirmBulkDelete,setConfirmBulkDelete]=useState(false)
  const [deleting,setDeleting]=useState<string>()
  const [history,setHistory]=useState<{output:string|null;truncated?:boolean}>()
  const [renaming, setRenaming] = useState<string>()
  const [sessionName, setSessionName] = useState('')
  const [sessionQuery, setSessionQuery] = useState('')
  const terminalApi = useMemo(() => task ? shellTerminalApi(api, task.id) : undefined, [api, task?.id])
  const [review, setReview] = useState<Review>()
  const [recovery, setRecovery] = useState<Recovery>()
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const running = useRef(false), generation = useRef(0)
  const send = async (body: GitCommand) => {
    const current = generation.current
    const response = await api.command(body)
    if (generation.current !== current) throw new Error('Workspace changed during shell operation')
    return response.result
  }
  useEffect(() => {
    const current = ++generation.current
    running.current = false; setBusy(false); setError('')
    setSessionsOpen(false); setSessionQuery(''); setSelectedSessions([]); setConfirmBulkDelete(false); setTasks([]); setTask(undefined); setReview(undefined); setRecovery(undefined); setFile(undefined)
    void api.command({ command: 'shellDraftList' }).then(async result => {
      if (generation.current !== current) return
      const items = result.result as Task[]
      setTasks(items)
      if (autoStart) {
        setBusy(true)
        let next = items.find(item => (!item.workspaceId || item.workspaceId===api.projectId) && item.state === 'running' && (!item.sessionStatus || item.sessionStatus === 'connected'))
        if (next) {
          try { await api.command({ command: 'shellDraftPoll', id: next.id, cursor: 0 }) }
          catch (error) {
            if (/session expired/i.test(errorMessage(error))) next = undefined
            else throw error
          }
          if (generation.current !== current) return
        }
        if (!next) {
          next = (await api.command({ command: 'shellDraftPrepare', operationId: startId.current })).result as Task
          if (generation.current !== current) return
          if (next.state === 'ready') next = (await api.command({ command: 'shellDraftStart', id: next.id, revision: next.revision })).result as Task
        }
        if (generation.current === current) { select(next); setBusy(false) }
      }
    }).catch(error => { if (generation.current === current) { setError(errorMessage(error)); setBusy(false) } })
    return () => { generation.current++ }
  }, [api, autoStart])
  const run = async (operation: () => Promise<void>) => {
    if (running.current) return
    const current = generation.current
    running.current = true; setBusy(true); setError('')
    try { await operation() } catch (error) {
      if (generation.current !== current) return
      setReview(undefined); setRecovery(undefined); setFile(undefined); setError(errorMessage(error))
    } finally { if (generation.current === current) { running.current = false; setBusy(false) } }
  }
  const select = (next: Task) => {
    setTasks(items => [next, ...items.filter(item => item.id !== next.id)]); setTask(next); setHistory(undefined); setTerminalVisible(true); setReview(undefined); setRecovery(undefined); setFile(undefined)
  }
  const openSessions = () => {
    setSessionsOpen(true)
    void run(async () => setTasks(await send({ command: 'shellDraftList' }) as Task[]))
  }
  const openSession = (item: Task) => run(async () => {
    select({ ...item, sessionStatus: 'unavailable' })
    const latest = await send({ command: 'shellDraftGet', id: item.id }) as Task
    select(latest)
    setSessionsOpen(false)
    if (latest.state !== 'running' || (latest.sessionStatus && latest.sessionStatus !== 'connected')) setHistory(await send({ command: 'shellDraftHistory', id: latest.id }) as {output:string|null;truncated?:boolean})
  })
  const newSession = () => run(async () => {
    const prepared = await send({ command: 'shellDraftPrepare', operationId: crypto.randomUUID() }) as Task
    select(prepared)
    const started = await send({ command: 'shellDraftStart', id: prepared.id, revision: prepared.revision }) as Task
    select(started)
    setSessionsOpen(false)
  })
  const sessionState = (item: Task) => item.sessionStatus === 'expired' || item.sessionStatus === 'exited' ? 'Ended' : item.sessionStatus === 'unavailable' ? 'Connection unavailable' : (({ running: 'Running', ready: 'Not started', 'review-ready': 'Stopped', applied: 'Changes applied', 'recovery-required': 'Needs attention' } as Record<string, string>)[item.state] || item.state.replace(/-/g, ' '))
  const visibleSessions=[...tasks].sort((a,b)=>String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).filter(item=>`${item.name || ''} ${item.id} ${sessionState(item)} ${item.sourcePosition?.branch || ''} ${item.sourcePosition?.head || ''}`.toLowerCase().includes(sessionQuery.toLowerCase()))
  const selectedItems=tasks.filter(item=>selectedSessions.includes(item.id))
  const allVisibleSelected=visibleSessions.length>0 && visibleSessions.every(item=>selectedSessions.includes(item.id))
  const deleteSelected=()=>run(async()=>{
    const batchGeneration=generation.current
    const removed=new Set<string>(), failures:string[]=[]
    for(const item of selectedItems){
      if(generation.current!==batchGeneration)throw new Error('Workspace changed during deletion')
      try{await send({command:'shellDraftDelete',id:item.id,revision:item.revision});removed.add(item.id)}
      catch(error){if(generation.current!==batchGeneration)throw error;failures.push(`${item.name || item.id.slice(0,8)}: ${errorMessage(error)}`)}
    }
    setTasks(items=>items.filter(item=>!removed.has(item.id)))
    setSelectedSessions(ids=>ids.filter(id=>!removed.has(id)))
    if(task && removed.has(task.id)){setTask(undefined);setHistory(undefined);setTerminalVisible(false)}
    setConfirmBulkDelete(false)
    if(failures.length){
      try{setTasks(await send({command:'shellDraftList'}) as Task[])}catch{ /* Keep retained rows if refresh fails. */ }
      throw new Error(`${removed.size} deleted; ${failures.length} could not be deleted. Failed sessions remain selected. Refresh the list and retry.`)
    }
  })
  const sessionToggle = <button type="button" className="native-git-icon-button" disabled={busy} title="Manage terminal sessions" aria-label="Manage terminal sessions" aria-expanded={sessionsOpen} onClick={() => sessionsOpen ? setSessionsOpen(false) : openSessions()}><MaterialIcon type="view_sidebar" /></button>
  const sessions = sessionsOpen && <aside className="native-git-session-sidebar" aria-label="Terminal sessions" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setSessionsOpen(false) } }}>
    <header className="native-git-session-sidebar-heading"><strong>Terminal sessions</strong><span className="native-git-session-header-actions"><button type="button" className="native-git-icon-button" title="New terminal" aria-label="New terminal" disabled={busy} onClick={newSession}><MaterialIcon type="add" /></button><button type="button" className="native-git-icon-button" title="Refresh sessions" aria-label="Refresh sessions" disabled={busy} onClick={openSessions}><MaterialIcon type="refresh" /></button><button type="button" className="native-git-icon-button" aria-label="Close sessions sidebar" title="Close sessions sidebar" onClick={() => setSessionsOpen(false)}><MaterialIcon type="close" /></button></span></header>
      <div className="native-git-session-manager-toolbar">
        <label className="native-git-branch-search"><MaterialIcon type="search" /><input className="form-control" aria-label="Search terminal sessions" placeholder="Search name, branch or commit…" value={sessionQuery} onChange={event => setSessionQuery(event.target.value)} /></label>
      </div>
      {!!tasks.length && <div className="native-git-session-selection"><label><input type="checkbox" aria-label="Select all visible terminal sessions" checked={allVisibleSelected} disabled={busy || !visibleSessions.length} onChange={event=>{setConfirmBulkDelete(false);setSelectedSessions(ids=>event.target.checked?[...new Set([...ids,...visibleSessions.map(item=>item.id)])]:ids.filter(id=>!visibleSessions.some(item=>item.id===id)))}}/>Select all</label><span>{selectedItems.length ? `${selectedItems.length} selected` : ''}</span><button type="button" className="native-git-icon-button" disabled={busy || !selectedItems.length} aria-label="Delete selected sessions" title="Delete selected sessions" onClick={()=>{setDeleting(undefined);setConfirmBulkDelete(true)}}><MaterialIcon type="delete"/></button></div>}
      {confirmBulkDelete && selectedItems.length>0 && <div className="native-git-session-delete native-git-session-bulk-delete" role="alert"><p>Delete {selectedItems.length} selected sessions? Running terminals will be stopped. Draft files are retained for recovery.</p><div className="native-git-session-delete-actions"><button type="button" className="native-git-session-confirm-delete" disabled={busy} onClick={()=>void deleteSelected()}><MaterialIcon type="delete"/>Delete {selectedItems.length} sessions</button><button type="button" className="native-git-session-cancel-delete" disabled={busy} onClick={()=>setConfirmBulkDelete(false)}><MaterialIcon type="close"/>Cancel</button></div></div>}
      {error && <p role="alert">{error}</p>}
      <div className="native-git-session-list">{visibleSessions.map(item => <div className={`native-git-session-card${task?.id === item.id ? ' is-current' : ''}`} key={item.id} onDoubleClick={event => {
        if (busy || (event.target as HTMLElement).closest('button, input, form, [tabindex]')) return
        void openSession(item)
      }}>
        <input className="native-git-session-checkbox" type="checkbox" aria-label={`Select terminal ${item.id.slice(0,8)}`} checked={selectedSessions.includes(item.id)} disabled={busy} onChange={event=>{setConfirmBulkDelete(false);setSelectedSessions(ids=>event.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}}/>
        <MaterialIcon type={item.state === 'running' && (!item.sessionStatus || item.sessionStatus === 'connected') ? 'terminal' : 'history'} />
        <div className="native-git-session-description">{renaming === item.id ? <form onSubmit={event => { event.preventDefault(); void run(async () => { const next = await send({ command: 'shellDraftRename', id: item.id, revision: item.revision, name: sessionName }) as Task; setTasks(items => items.map(value => value.id === next.id ? next : value)); if (task?.id === next.id) setTask(next); setRenaming(undefined) }) }}><input autoFocus aria-label="Terminal name" maxLength={80} value={sessionName} disabled={busy} onFocus={event => event.target.select()} onChange={event => setSessionName(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setRenaming(undefined) } }} onBlur={() => { if (!busy) setRenaming(undefined) }} /></form> : <strong tabIndex={0} title="Double-click to rename; press F2 to rename" onDoubleClick={() => { setRenaming(item.id); setSessionName(item.name || `Terminal ${item.id.slice(0, 8)}`) }} onKeyDown={event => { if (event.key === 'F2') { event.preventDefault(); setRenaming(item.id); setSessionName(item.name || `Terminal ${item.id.slice(0, 8)}`) } }}>{item.name || `Terminal ${item.id.slice(0, 8)}`}{task?.id === item.id && <span className="native-git-session-current">Current</span>}</strong>}<span className="native-git-session-status"><span className="native-git-session-owner" title={item.ownerDisplayName || "Collaborator"} aria-label={item.ownerDisplayName || "Collaborator"}><UserAvatar userId={item.createdBy || item.id} displayName={item.ownerDisplayName || "Collaborator"}/></span>{sessionState(item)}</span><span className="native-git-session-source" title={item.sourcePosition?.head || "Source position was not recorded for this older session"}>{item.sourcePosition ? <><span className="native-git-session-branch-line"><MaterialIcon type="account_tree"/><strong title={item.sourcePosition.branch || "Detached HEAD"}>{item.sourcePosition.branch || "Detached"}</strong></span><code>{item.sourcePosition.head?.slice(0,8) || "No commits"}</code>{item.sourcePosition.dirty && <span title="Includes saved edits at creation">+ edits</span>}</> : "Source position unavailable"}</span><TerminalSessionReference kind="paper" id={item.id}/>{item.createdAt && <small title={`Created ${new Date(item.createdAt).toLocaleString()}`}>{new Date(item.createdAt).toLocaleString()}</small>}</div>
        <div className="native-git-session-row-actions">
        <button type="button" className="native-git-icon-button" title={item.state === 'running' ? 'Open terminal' : 'View session'} aria-label={`Open terminal ${item.id.slice(0, 8)}`} disabled={busy} onClick={() => openSession(item)}><MaterialIcon type={item.state === 'running' ? 'login' : 'visibility'} /></button>
        <button type="button" className="native-git-icon-button" title="Delete session" aria-label={`Delete terminal ${item.id.slice(0,8)}`} disabled={busy} onClick={()=>{setConfirmBulkDelete(false);setDeleting(item.id)}}><MaterialIcon type="delete"/></button>
        </div>
        {deleting===item.id && <div className="native-git-session-delete" role="alert"><p>Remove this session from the list? A running terminal will be stopped. Draft files are retained for recovery; nothing is applied to your paper.</p><div className="native-git-session-delete-actions"><button className="native-git-session-confirm-delete" type="button" disabled={busy} onClick={()=>void run(async()=>{await send({command:'shellDraftDelete',id:item.id,revision:item.revision});setTasks(items=>items.filter(t=>t.id!==item.id));setSelectedSessions(ids=>ids.filter(id=>id!==item.id));if(task?.id===item.id){setTask(undefined);setHistory(undefined);setTerminalVisible(false)}setDeleting(undefined)})}><MaterialIcon type="delete"/>Delete session</button><button className="native-git-session-cancel-delete" type="button" disabled={busy} onClick={()=>setDeleting(undefined)}><MaterialIcon type="close"/>Cancel</button></div></div>}
      </div>)}</div>
      {!tasks.length && <p>{busy ? 'Loading sessions…' : 'No sessions yet. Create a terminal to get started.'}</p>}
      {!!tasks.length && !tasks.some(item => `${item.name || ''} ${item.id} ${sessionState(item)} ${item.sourcePosition?.branch || ''} ${item.sourcePosition?.head || ''}`.toLowerCase().includes(sessionQuery.toLowerCase())) && <p>No matching sessions.</p>}
  </aside>
  const recover = (mode: string) => run(async () => {
    if (!recovery) return
    const result = await send({ command: 'shellDraftRecover', id: recovery.task.id, revision: recovery.task.revision,
      fingerprint: recovery.fingerprint, mode, operationId: crypto.randomUUID() }) as Task
    select(result)
  })
  const side = (value: Side) => !value.exists ? 'File does not exist' : value.text ?? `${value.binary ? 'Binary file' : 'Large file'} (${value.bytes} bytes; text preview unavailable)`
  const body = <>
      {error && !sessionsOpen && <div role="alert">{error}</div>}
      {autoStart && !task && !error && busy && <p role="status">Starting project terminal…</p>}

      {task && <section aria-label="Selected shell draft">
        {task.sourcePosition && <div className="native-git-terminal-position" title={task.sourcePosition.head || ""}><MaterialIcon type="account_tree"/>{task.sourcePosition.branch || "Detached"}<code>{task.sourcePosition.head?.slice(0,8) || "No commits"}</code>{task.sourcePosition.dirty && <span>Includes saved edits at creation</span>}</div>}
        {history && <section aria-label="Terminal history"><strong>Terminal history</strong>{history.truncated && <p>Earlier output is no longer retained.</p>}{history.output ? <TerminalHistory output={history.output}/> : <p className="native-git-terminal-history">{history.output === null ? 'No terminal output was saved for this older session.' : 'This terminal produced no output.'}</p>}</section>}
        {!history && task.state !== 'running' && <p role="status" className="native-git-dialog-caption">{task.state === 'ready' ? 'Ready to connect. Open the terminal to enter commands.' : task.state === 'review-ready' ? 'Terminal stopped. Review the changed files before applying them.' : task.state === 'applied' ? 'Changes applied to your paper.' : task.state.replace(/-/g, ' ')}</p>}{task.failure && <p>{task.failure}</p>}
        {!embedded && <button className="btn btn-secondary" disabled={busy} onClick={() => run(async () => select(await send({ command: 'shellDraftGet', id: task.id }) as Task))}><MaterialIcon type="refresh" />Refresh status</button>}
        {task.state === 'ready' && <button className="btn btn-secondary" disabled={busy} onClick={() => run(async () => select(await send({ command: 'shellDraftStart', id: task.id, revision: task.revision }) as Task))}><MaterialIcon type="terminal" />Open terminal</button>}
        {task.state === 'running' && task.sessionStatus && task.sessionStatus !== 'connected' && <div role="status" className="native-git-dialog-caption"><p>{task.sessionStatus === 'unavailable' ? 'Cannot connect to this session. Refresh to retry.' : 'This terminal session has ended. Its files are retained.'}</p><button className="native-git-icon-button" title="New terminal from current branch" aria-label="New terminal from current branch" disabled={busy} onClick={newSession}><MaterialIcon type="add" /></button></div>}
        {task.state === 'running' && (!task.sessionStatus || task.sessionStatus === 'connected') && <>

          {active && (terminalVisible && terminalApi ? <GitTerminal interactive key={task.id} api={terminalApi} onClose={() => setTerminalVisible(false)} onChanged={() => {}} /> : <button className="btn btn-secondary" onClick={() => setTerminalVisible(true)}><MaterialIcon type="terminal" />Show terminal</button>)}
        </>}
        {!history && (['ready', 'running', 'starting', 'stopping'].includes(task.state) || (task.state === 'recovery-required' && ['start', 'stop'].includes(task.failurePhase || ''))) && <button className="btn btn-secondary" disabled={busy} onClick={() => run(async () => { const sealed = await send({ command: 'shellDraftSeal', id: task.id, revision: task.revision }) as Task; select(sealed); if (sealed.state === 'review-ready') setReview(await send({ command: 'shellDraftReview', id: sealed.id }) as Review) })}><MaterialIcon type="stop" />Stop and review changes</button>}
        {!history && task.state === 'review-ready' && !review && <button className="btn btn-secondary" disabled={busy} onClick={() => run(async () => setReview(await send({ command: 'shellDraftReview', id: task.id }) as Review))}><MaterialIcon type="visibility" />Review changes</button>}
        {!history && (!task.workspaceId || task.workspaceId===api.projectId) && ['applying', 'recovery-required', 'applied'].includes(task.state) && <button className="btn btn-secondary" disabled={busy} onClick={() => run(async () => setRecovery(await send({ command: 'shellDraftRecoveryPreview', id: task.id }) as Recovery))}><MaterialIcon type="restore" />Inspect recovery</button>}
      </section>}
      {!history && review && <section aria-label="Sealed changes">
        <p role="status">{review.changes.length ? `${review.changes.length} changed files. Select a file to compare before applying.` : 'No file changes in this session. Nothing to apply.'}</p>
        <ul>{review.changes.map(change => <li key={change.path}><button className="btn btn-secondary" disabled={busy} onClick={() => run(async () => setFile(await send({ command: 'shellDraftFile', id: review.task.id, path: change.path, fingerprint: review.fingerprint }) as File))}>{change.path} ({change.status})</button></li>)}</ul>
        {review.task.workspaceId && review.task.workspaceId!==api.projectId && <p>Open this session’s source branch to apply its file changes.</p>}
        {review.changes.length > 0 && <button className="btn btn-secondary" disabled={busy || !canApply || (!!review.task.workspaceId && review.task.workspaceId!==api.projectId)} onClick={() => run(async () => select(await send({ command: 'shellDraftApply', id: review.task.id, revision: review.task.revision, fingerprint: review.fingerprint }) as Task))}><MaterialIcon type="check" />Apply to paper</button>}
      </section>}
      {file && <section aria-label="File preview"><h4>{file.path}</h4><h5>Before</h5><pre>{side(file.before)}</pre><h5>After</h5><pre>{side(file.after)}</pre></section>}
      {recovery && <section aria-label="Recovery choices">
        <p>{recovery.canResume ? 'The saved checkpoint still matches.' : 'The workspace changed or the outcome is uncertain. Resuming is unavailable.'}</p>
        <button className="btn btn-secondary" disabled={busy || !canApply || !recovery.canResume} onClick={() => recover('resume')}><MaterialIcon type="restore" />Resume application</button>
        <p>Keep current content preserves current collaborative edits and retains the draft as recovery evidence.</p>
        <button className="btn btn-secondary" disabled={busy || !canApply} onClick={() => recover('preserve-current')}><MaterialIcon type="save" />Keep current content</button>
      </section>}
  </>
  if (embedded) return <section className="native-git-terminal-dock" aria-label="Graph terminal">
    {toolbarTarget ? createPortal(<>{sessionToggle}{task && <button type="button" className="native-git-icon-button" disabled={busy} title="Refresh status" aria-label="Refresh terminal status" onClick={() => run(async () => select(await send({ command: 'shellDraftGet', id: task.id }) as Task))}><MaterialIcon type="refresh" /></button>}</>, toolbarTarget) : (<header className="native-git-details-toolbar native-git-terminal-dock-toolbar"><MaterialIcon type="terminal" /><strong>Terminal</strong><span className="native-git-toolbar-spacer" />{sessionToggle}{task && <button type="button" className="native-git-icon-button" disabled={busy} title="Refresh status" aria-label="Refresh terminal status" onClick={() => run(async () => select(await send({ command: 'shellDraftGet', id: task.id }) as Task))}><MaterialIcon type="refresh" /></button>}<button className="native-git-icon-button" disabled={busy} aria-label="Close terminal panel" onClick={onClose}><MaterialIcon type="close" /></button></header>)}

    <div className="native-git-terminal-dock-body"><div className="native-git-terminal-session-layout"><div className="native-git-terminal-session-content">{body}</div>{sessions}</div></div>
  </section>
  return <Modal className="native-git-dialog" show size="lg" onHide={() => { if (!busy) onClose() }} aria-label="Shell drafts">
    <Modal.Header closeButton><Modal.Title><MaterialIcon type="terminal" />{autoStart ? 'Terminal' : 'Terminal changes'}</Modal.Title></Modal.Header>
    <Modal.Body><div className="native-git-session-launcher">{sessionToggle}</div><div className="native-git-terminal-session-layout"><div className="native-git-terminal-session-content">{body}</div>{sessions}</div></Modal.Body>
    <Modal.Footer><button className="btn btn-secondary" disabled={busy} onClick={onClose}><MaterialIcon type="close" />Close</button></Modal.Footer>
  </Modal>
}
