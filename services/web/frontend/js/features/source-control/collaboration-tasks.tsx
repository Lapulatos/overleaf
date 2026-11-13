import MaterialIcon from '@/shared/components/material-icon'
import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi, type GitCommand } from './api'
import ConflictEditor, { type ConflictDetails } from './conflict-editor'

type Task = {
  id: string; revision: number; state: string; sourceRef: string; targetBranch: string
  remainingPaths: string[]; leaseGeneration: number
  lease?: { actorId: string; sessionId: string; expiresAt: number } | null
  resolutionCommit?: string
  validation?: { state: string; commit: string; reason?: string; backendStatus?: string }
  failure?: string
}
type MergeReview = { id: string; revision: number; files: {path:string; conflicted:boolean}[]; path?:string; patch?:string; truncated?:boolean }
type Recovery = { fingerprint: string; canResume: boolean; explanation: string; task: Task }

export default function CollaborationTasks({ api, canApply, selectedId, onNewMerge, onClose }: {
  api: GitApi; canApply: boolean; selectedId?: string; onNewMerge?: () => void; onClose(): void
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [task, setTask] = useState<Task>()
  const [details, setDetails] = useState<ConflictDetails>()
  const [recovery, setRecovery] = useState<Recovery>()
  const [review, setReview] = useState<MergeReview>()
  const [filePreview, setFilePreview] = useState<MergeReview>()
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sessionId = useRef(crypto.randomUUID())
  const running = useRef(false)
  const owned = task?.lease?.sessionId === sessionId.current && task.lease.expiresAt > Date.now()
  const send = async (body: GitCommand) => (await api.command(body)).result
  useEffect(() => {
    let live = true
    const refresh = async () => {
      if (running.current) return
      try {
        const result = await api.command({ command: 'mergeDraftList' })
        if (!live) return
        const list = result.result as Task[]
        setTasks(list)
        setTask(previous => {
          const found = list.find(item => item.id === (previous?.id || selectedId)) || list.find(item => !['resolved','cancelled','superseded'].includes(item.state)) || list[0]
          return previous && found && previous.revision > found.revision ? previous : found
        })
      } catch (error) { if (live) setError(errorMessage(error)) }
    }
    void refresh()
    const timer = setInterval(refresh, 5000)
    return () => { live = false; clearInterval(timer) }
  }, [api, selectedId])
  useEffect(() => {
    let live = true
    setReview(undefined); setFilePreview(undefined)
    if (!task || !['conflicted','resolving','ready-to-apply'].includes(task.state)) return
    setPreviewLoading(true)
    void api.command({command:'mergeDraftReview',id:task.id}).then(result => {if(live)setReview(result.result as MergeReview)}).catch(error=>{if(live)setError(errorMessage(error))}).finally(()=>{if(live)setPreviewLoading(false)})
    return () => {live=false}
  }, [api, task?.id, task?.revision, task?.state])
  const act = async (action: () => Promise<void>) => {
    if (running.current) return
    running.current = true; setBusy(true); setError('')
    try { await action() }
    catch (error) { setError(errorMessage(error)) }
    finally { running.current = false; setBusy(false) }
  }
  const lease = () => ({ id: task!.id, revision: task!.revision, sessionId: sessionId.current, generation: task!.leaseGeneration })
  const update = async (body: GitCommand) => { setTask(await send(body) as Task); setRecovery(undefined) }
  const claim = async () => {
    const current = await send({command:'mergeDraftClaim',id:task!.id,revision:task!.revision,sessionId:sessionId.current}) as Task
    setTask(current)
    return {id:current.id,revision:current.revision,sessionId:sessionId.current,generation:current.leaseGeneration}
  }
  if (details && task) return <ConflictEditor details={details} busy={busy} error={error} onClose={() => setDetails(undefined)}
    onResolve={(choice, text) => void act(async () => {
      await update({ command: 'mergeDraftResolve', ...lease(), path: details.path, fingerprint: details.fingerprint, choice, ...(choice === 'edited' ? { text } : {}) })
      setDetails(undefined)
    })} />
  return <Modal className="native-git-dialog" show size="lg" onHide={() => { if (!busy) onClose() }} aria-label="Shared merge tasks">
    <Modal.Header closeButton><Modal.Title><MaterialIcon type="merge" />Merge changes</Modal.Title></Modal.Header>
    <Modal.Body>
      {error && <p role="alert" className="native-git-error">{error}</p>}
      <p>Bring changes from another branch into this branch. Your paper changes only when you apply the merge.</p>
      {tasks.length > 1 && <label className="native-git-field">Merge
        <select className="form-control" disabled={busy} value={task?.id || ''} onChange={event => { setTask(tasks.find(item => item.id === event.target.value)); setRecovery(undefined); setError('') }}>
          <option value="">Choose a merge task</option>
          {tasks.map(item => <option key={item.id} value={item.id}>{item.sourceRef.replace(/^refs\/remotes\//, '')} → {item.targetBranch}</option>)}
        </select>
      </label>}
      {!tasks.length && <div className="native-git-merge-summary"><MaterialIcon type="merge"/><div><strong>No merge in progress</strong><p>Choose another branch to preview the files it would change here.</p></div></div>}
      {onNewMerge && <button type="button" className="btn btn-secondary" disabled={busy || !canApply} onClick={onNewMerge}><MaterialIcon type="add"/>{tasks.length ? 'Start another merge…' : 'Choose source branch…'}</button>}
      {task && <>
        <div className="native-git-merge-summary" role="status"><MaterialIcon type="merge" /><div><strong>{task.sourceRef.replace(/^refs\/remotes\//, '')} → {task.targetBranch}</strong><p>{task.state === 'ready-to-apply' ? 'No unresolved conflicts. Ready to merge.' : task.state === 'resolved' ? 'Merged successfully.' : task.remainingPaths.length ? `${task.remainingPaths.length} files need conflict resolution.` : task.state.replace(/-/g, ' ')}</p></div></div>
        {task.state === 'resolved' && <section aria-label="Merged paper validation">
          <p><MaterialIcon type="fact_check" /> {task.validation?.state === 'stale' ? 'Paper changed since the last check' : task.validation?.state === 'checking' ? 'Checking merged paper…' : task.validation?.state || 'Not checked yet'} · Commit {(task.resolutionCommit || task.validation?.commit || '').slice(0, 8)}</p>
          {task.validation?.reason && <p role="status">{task.validation.reason}</p>}
          {task.validation?.state === 'stale' && <p>The merge is complete. Use Recompile in the editor to check the latest paper.</p>}
          <button type="button" className="btn btn-default" disabled={busy || !canApply || ['checking', 'stale'].includes(task.validation?.state || '')} onClick={() => void act(() => update({ command: 'mergeDraftCompile', id: task.id, revision: task.revision }))}><MaterialIcon type="merge" />Check merged paper</button>
          {!canApply && <p>Checking is unavailable in this workspace.</p>}
        </section>}
        {task.failure && <p role="alert">{task.failure}</p>}
        {task.lease && !owned && task.lease.expiresAt > Date.now() && <p>Another collaborator is currently editing this merge.</p>}
        {['conflicted', 'resolving', 'ready-to-apply'].includes(task.state) && <>
          <section className="native-git-merge-review" aria-label="Changes to review">
            <h4><MaterialIcon type="difference" /> Changes to review {review && `(${review.files.length} files)`}</h4>
            {previewLoading && <p role="status">Loading changed files…</p>}
            {review && !review.files.length && <p>No file content changes. This merge only joins the branch histories.</p>}
            {review && <div className="native-git-merge-file-list">{review.files.map(file => <div key={file.path}>
              <MaterialIcon type={file.conflicted?'warning':'description'} /><span>{file.path}</span>
              <button className="btn btn-secondary" disabled={busy} onClick={()=>void act(async()=>setFilePreview(await send({command:'mergeDraftReview',id:task.id,path:file.path}) as MergeReview))}><MaterialIcon type="visibility" />View changes</button>
              {file.conflicted && <button className="btn btn-secondary" disabled={busy || !canApply} onClick={()=>void act(async()=>{await claim();setDetails(await send({command:'mergeDraftConflict',id:task.id,path:file.path}) as ConflictDetails)})}><MaterialIcon type="edit" />Resolve conflict</button>}
            </div>)}</div>}
            {filePreview && filePreview.id === task.id && <section aria-label="Merge file diff"><h5>{filePreview.path}</h5><div className="native-git-diff-legend"><span>− Current branch</span><span>+ After merge</span></div><pre className="native-git-merge-patch">{(filePreview.patch || 'No textual diff available for this file.').split('\n').map((line,index)=><span key={index} className={line.startsWith('+')?'merge-line-added':line.startsWith('-')?'merge-line-removed':''}>{line}{'\n'}</span>)}</pre>{filePreview.truncated && <p>Preview shortened for this large file.</p>}</section>}
          </section>
          <button className="btn btn-primary" disabled={busy || !canApply || task.state !== 'ready-to-apply' || review?.revision !== task.revision} onClick={() => void act(async () => { const grant=await claim();await update({ command: 'mergeDraftApply', ...grant });onClose() })}><MaterialIcon type="merge" />Merge into this branch</button>{' '}
          <button className="btn btn-default" disabled={busy || !canApply} onClick={() => void act(async()=>{const grant=await claim();await update({command:'mergeDraftCancel',...grant})})}><MaterialIcon type="close" />Cancel merge</button>
        </>}
        {['applying', 'recovery-required'].includes(task.state) && <button className="btn btn-default" disabled={busy || !canApply} onClick={() => void act(async () => setRecovery(await send({ command: 'mergeDraftRecoveryPreview', id: task.id }) as Recovery))}><MaterialIcon type="restore" />Review recovery</button>}
        {!canApply && <p>Applying and recovery are unavailable until this workspace has prepared-write support enabled.</p>}
        {recovery && <section>
          <p>{recovery.explanation}</p>
          <p>Preserve current keeps the present document contents and retains the draft for review.</p>
          {(['resume', 'preserve-current'] as const).map(mode => <button key={mode} className="btn btn-default" disabled={busy || (mode === 'resume' && !recovery.canResume)} onClick={() => void act(async () => {
            await update({ command: 'mergeDraftRecover', id: recovery.task.id, revision: recovery.task.revision, fingerprint: recovery.fingerprint, mode, operationId: crypto.randomUUID() }); onClose()
          })}><MaterialIcon type="restore" />{mode === 'resume' ? 'Resume interrupted merge' : 'Preserve current contents'}</button>)}
        </section>}
      </>}
    </Modal.Body>
    <Modal.Footer><button className="btn btn-default" disabled={busy} onClick={onClose}><MaterialIcon type="close" />Close</button></Modal.Footer>
  </Modal>
}
