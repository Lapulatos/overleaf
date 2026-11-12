import { useEffect, useMemo, useRef, useState } from 'react'
import GitTerminal from './git-terminal'
import { shellTerminalApi } from './shell-terminal-api'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi, type GitCommand } from './api'
type Task = { id: string; revision: number; state: string; failure?: string; failurePhase?: string }
type Review = { task: Task; fingerprint: string; changes: { path: string; status: string; beforeBytes: number; afterBytes: number }[] }
type Recovery = { task: Task; fingerprint: string; canResume: boolean }
type Side = { exists: boolean; text: string | null; binary: boolean; bytes: number; tooLarge: boolean }
type File = { path: string; before: Side; after: Side }
export default function ShellDrafts({ api, canApply, onClose }: { api: GitApi; canApply: boolean; onClose(): void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [task, setTask] = useState<Task>()
  const [terminalVisible, setTerminalVisible] = useState(true)
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
    setTasks([]); setTask(undefined); setReview(undefined); setRecovery(undefined); setFile(undefined)
    void api.command({ command: 'shellDraftList' }).then(result => {
      if (generation.current === current) setTasks(result.result as Task[])
    }).catch(error => { if (generation.current === current) setError(errorMessage(error)) })
    return () => { generation.current++ }
  }, [api])
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
    setTask(next); setTerminalVisible(true); setReview(undefined); setRecovery(undefined); setFile(undefined)
  }
  const recover = (mode: string) => run(async () => {
    if (!recovery) return
    const result = await send({ command: 'shellDraftRecover', id: recovery.task.id, revision: recovery.task.revision,
      fingerprint: recovery.fingerprint, mode, operationId: crypto.randomUUID() }) as Task
    select(result)
  })
  const side = (value: Side) => !value.exists ? 'File does not exist' : value.text ?? `${value.binary ? 'Binary file' : 'Large file'} (${value.bytes} bytes; text preview unavailable)`
  return <Modal show size="lg" onHide={() => { if (!busy) onClose() }} aria-label="Shell drafts">
    <Modal.Header closeButton><Modal.Title>Shell drafts</Modal.Title></Modal.Header>
    <Modal.Body>
      <p>Shell changes remain in a private draft until reviewed and applied. Applying keeps them as uncommitted project edits.</p>
      {error && <div role="alert">{error}</div>}
      <button className="btn btn-default" disabled={busy} onClick={() => run(async () => { setTasks(await send({ command: 'shellDraftList' }) as Task[]) })}>Refresh drafts</button>
      <button disabled={busy} onClick={() => run(async () => select(await send({ command: 'shellDraftPrepare', operationId: crypto.randomUUID() }) as Task))}>Create shell draft</button>
      {tasks.length === 0 && <p>No retained shell drafts.</p>}
      <ul>{tasks.map(item => <li key={item.id}><button disabled={busy} onClick={() => select(item)}>{item.id} — {item.state}</button></li>)}</ul>
      {task && <section aria-label="Selected shell draft">
        <p>State: {task.state}</p>{task.failure && <p>{task.failure}</p>}
        <button disabled={busy} onClick={() => run(async () => select(await send({ command: 'shellDraftGet', id: task.id }) as Task))}>Refresh selected draft</button>
        {task.state === 'ready' && <button disabled={busy} onClick={() => run(async () => select(await send({ command: 'shellDraftStart', id: task.id, revision: task.revision }) as Task))}>Start shell</button>}
        {task.state === 'running' && <>
          <p>Closing the terminal view keeps the draft session running. Stop and seal before reviewing or applying its changes.</p>
          {terminalVisible && terminalApi ? <GitTerminal api={terminalApi} onClose={() => setTerminalVisible(false)} onChanged={() => {}} /> : <button onClick={() => setTerminalVisible(true)}>Show terminal</button>}
        </>}
        {(['ready', 'running', 'starting', 'stopping'].includes(task.state) || (task.state === 'recovery-required' && ['start', 'stop'].includes(task.failurePhase || ''))) && <button disabled={busy} onClick={() => run(async () => select(await send({ command: 'shellDraftSeal', id: task.id, revision: task.revision }) as Task))}>Stop and seal for review</button>}
        {task.state === 'review-ready' && <button disabled={busy} onClick={() => run(async () => setReview(await send({ command: 'shellDraftReview', id: task.id }) as Review))}>Review changes</button>}
        {['applying', 'recovery-required', 'applied'].includes(task.state) && <button disabled={busy} onClick={() => run(async () => setRecovery(await send({ command: 'shellDraftRecoveryPreview', id: task.id }) as Recovery))}>Inspect recovery</button>}
      </section>}
      {review && <section aria-label="Sealed changes">
        <ul>{review.changes.map(change => <li key={change.path}><button disabled={busy} onClick={() => run(async () => setFile(await send({ command: 'shellDraftFile', id: review.task.id, path: change.path, fingerprint: review.fingerprint }) as File))}>{change.path} ({change.status})</button></li>)}</ul>
        <button disabled={busy || !canApply} onClick={() => run(async () => select(await send({ command: 'shellDraftApply', id: review.task.id, revision: review.task.revision, fingerprint: review.fingerprint }) as Task))}>Apply reviewed changes</button>
      </section>}
      {file && <section aria-label="File preview"><h4>{file.path}</h4><h5>Before</h5><pre>{side(file.before)}</pre><h5>After</h5><pre>{side(file.after)}</pre></section>}
      {recovery && <section aria-label="Recovery choices">
        <p>{recovery.canResume ? 'The saved checkpoint still matches.' : 'The workspace changed or the outcome is uncertain. Resuming is unavailable.'}</p>
        <button disabled={busy || !canApply || !recovery.canResume} onClick={() => recover('resume')}>Resume application</button>
        <p>Keep current content preserves current collaborative edits and retains the draft as recovery evidence.</p>
        <button disabled={busy || !canApply} onClick={() => recover('preserve-current')}>Keep current content</button>
      </section>}
    </Modal.Body>
    <Modal.Footer><button disabled={busy} onClick={onClose}>Close</button></Modal.Footer>
  </Modal>
}
