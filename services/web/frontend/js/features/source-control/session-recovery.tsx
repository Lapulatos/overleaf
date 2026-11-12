import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi } from './api'

type Task = { id: string; state: string; phase: string; epoch: number; nextEpoch: number }
export default function SessionRecovery({ api }: { api: GitApi }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [task, setTask] = useState<Task>()
  const operation = useRef<string>()
  const running = useRef(false)
  useEffect(() => {
    if (!open) return
    let live = true
    setLoading(true); setReady(false); setError(''); setConfirmed(false)
    api.command({ command: 'sessionRecoveryList' }).then(response => {
      if (!live) return
      const tasks = response.result as Task[]
      const pending = tasks.find(item => item.state !== 'resolved')
      const previous = tasks.find(item => item.id === operation.current)
      const selected = pending || previous
      setTask(selected)
      operation.current = selected?.id || operation.current || crypto.randomUUID()
      setReady(true)
    }).catch(error => { if (live) setError(errorMessage(error)) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [api, open])
  const recover = async () => {
    if (!ready || !confirmed || running.current || !operation.current) return
    running.current = true; setBusy(true); setError('')
    try {
      const response = await api.command({ command: 'sessionRecover', operationId: operation.current })
      setTask(response.result as Task)
    } catch (error) { setError(errorMessage(error)) }
    finally { running.current = false; setBusy(false) }
  }
  return <>
    <button type="button" className="btn btn-link" onClick={() => setOpen(true)}>Recover collaboration sessions…</button>
    <Modal show={open} onHide={() => { if (!busy) setOpen(false) }} aria-label="Recover collaboration sessions">
      <Modal.Header closeButton><Modal.Title>Recover collaboration sessions</Modal.Title></Modal.Header>
      <Modal.Body>
        <p>Use this after a server interruption prevents collaboration or Git operations. Only the project owner can recover sessions.</p>
        <p>Recovery saves edits already received by the server and starts a new workspace version. All collaborators must reload. Copy any unsent local text before reloading.</p>
        {loading && <p role="status">Checking recovery tasks…</p>}
        {error && <p role="alert" className="native-git-error">{error}</p>}
        {task && <p role="status">{task.state === 'resolved' ? 'Recovery completed. Reload the editor to reconnect.' : `Interrupted recovery: ${task.phase}`}</p>}
        {ready && task?.state !== 'resolved' && <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> I understand that collaborators will need to reload.</label>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => setOpen(false)}>Close</button>
        {task?.state === 'resolved'
          ? <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload editor</button>
          : <button type="button" className="btn btn-primary" disabled={!ready || !confirmed || busy} onClick={() => void recover()}>{busy ? 'Recovering…' : task ? 'Resume session recovery' : 'Recover sessions'}</button>}
      </Modal.Footer>
    </Modal>
  </>
}
