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
type Recovery = { fingerprint: string; canResume: boolean; explanation: string; task: Task }

export default function CollaborationTasks({ api, canApply, selectedId, onClose }: {
  api: GitApi; canApply: boolean; selectedId?: string; onClose(): void
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [task, setTask] = useState<Task>()
  const [details, setDetails] = useState<ConflictDetails>()
  const [recovery, setRecovery] = useState<Recovery>()
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
          const found = list.find(item => item.id === (previous?.id || selectedId))
          return previous && found && previous.revision > found.revision ? previous : found
        })
      } catch (error) { if (live) setError(errorMessage(error)) }
    }
    void refresh()
    const timer = setInterval(refresh, 5000)
    return () => { live = false; clearInterval(timer) }
  }, [api, selectedId])
  const act = async (action: () => Promise<void>) => {
    if (running.current) return
    running.current = true; setBusy(true); setError('')
    try { await action() }
    catch (error) { setError(errorMessage(error)) }
    finally { running.current = false; setBusy(false) }
  }
  const lease = () => ({ id: task!.id, revision: task!.revision, sessionId: sessionId.current, generation: task!.leaseGeneration })
  const update = async (body: GitCommand) => { setTask(await send(body) as Task); setRecovery(undefined) }
  if (details && task) return <ConflictEditor details={details} busy={busy} error={error} onClose={() => setDetails(undefined)}
    onResolve={(choice, text) => void act(async () => {
      await update({ command: 'mergeDraftResolve', ...lease(), path: details.path, fingerprint: details.fingerprint, choice, ...(choice === 'edited' ? { text } : {}) })
      setDetails(undefined)
    })} />
  return <Modal show size="lg" onHide={() => { if (!busy) onClose() }} aria-label="Shared merge tasks">
    <Modal.Header closeButton><Modal.Title>Shared merge tasks</Modal.Title></Modal.Header>
    <Modal.Body>
      {error && <p role="alert" className="native-git-error">{error}</p>}
      <p>Conflicts are resolved in a separate draft. Apply waits for connected collaborators to save before updating this branch.</p>
      <label className="native-git-field">Task
        <select className="form-control" disabled={busy} value={task?.id || ''} onChange={event => { setTask(tasks.find(item => item.id === event.target.value)); setRecovery(undefined); setError('') }}>
          <option value="">Choose a merge task</option>
          {tasks.map(item => <option key={item.id} value={item.id}>{item.sourceRef} → {item.targetBranch} · {item.state}</option>)}
        </select>
      </label>
      {!tasks.length && <p>No merge tasks for this branch.</p>}
      {task && <>
        <p role="status">{task.sourceRef} → {task.targetBranch} · {task.state}</p>
        {task.state === 'resolved' && <section aria-label="Merged paper validation">
          <p>Paper validation: {task.validation?.state || 'unchecked'} · Commit {(task.resolutionCommit || task.validation?.commit || '').slice(0, 8)}</p>
          {task.validation?.reason && <p role="status">{task.validation.reason}</p>}
          {task.validation?.state === 'stale' && <p>The branch or paper has changed. This result does not validate the current paper.</p>}
          <button type="button" className="btn btn-default" disabled={busy || !canApply || ['checking', 'stale'].includes(task.validation?.state || '')} onClick={() => void act(() => update({ command: 'mergeDraftCompile', id: task.id, revision: task.revision }))}>Check merged paper</button>
          <p>This checks a captured version separately from the editor PDF. A failed check never rolls back the merge.</p>
        </section>}
        {task.failure && <p role="alert">{task.failure}</p>}
        {task.lease && <p>{owned ? 'You are resolving this task.' : `Resolver: ${task.lease.actorId}`}</p>}
        {['conflicted', 'resolving', 'ready-to-apply'].includes(task.state) && <>
          <button className="btn btn-default" disabled={busy} onClick={() => void act(() => update({ command: 'mergeDraftClaim', id: task.id, revision: task.revision, sessionId: sessionId.current }))}>{owned ? 'Renew resolution lease' : 'Take resolution lease'}</button>
          <ul>{task.remainingPaths.map(path => <li key={path}><button className="btn btn-link" disabled={busy || !owned} onClick={() => void act(async () => setDetails(await send({ command: 'mergeDraftConflict', id: task.id, path }) as ConflictDetails))}>{path}</button></li>)}</ul>
          <button className="btn btn-primary" disabled={busy || !owned || !canApply || task.state !== 'ready-to-apply'} onClick={() => void act(async () => { await update({ command: 'mergeDraftApply', ...lease() }); onClose() })}>Apply resolved merge</button>{' '}
          <button className="btn btn-default" disabled={busy || !owned} onClick={() => void act(() => update({ command: 'mergeDraftCancel', ...lease() }))}>Cancel draft</button>
        </>}
        {['applying', 'recovery-required'].includes(task.state) && <button className="btn btn-default" disabled={busy || !canApply} onClick={() => void act(async () => setRecovery(await send({ command: 'mergeDraftRecoveryPreview', id: task.id }) as Recovery))}>Review recovery</button>}
        {!canApply && <p>Applying and recovery are unavailable until this workspace has prepared-write support enabled.</p>}
        {recovery && <section>
          <p>{recovery.explanation}</p>
          <p>Preserve current keeps the present document contents and retains the draft for review.</p>
          {(['resume', 'preserve-current'] as const).map(mode => <button key={mode} className="btn btn-default" disabled={busy || (mode === 'resume' && !recovery.canResume)} onClick={() => void act(async () => {
            await update({ command: 'mergeDraftRecover', id: recovery.task.id, revision: recovery.task.revision, fingerprint: recovery.fingerprint, mode, operationId: crypto.randomUUID() }); onClose()
          })}>{mode === 'resume' ? 'Resume interrupted merge' : 'Preserve current contents'}</button>)}
        </section>}
      </>}
    </Modal.Body>
    <Modal.Footer><button className="btn btn-default" disabled={busy} onClick={onClose}>Close</button></Modal.Footer>
  </Modal>
}
