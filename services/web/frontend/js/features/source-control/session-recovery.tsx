import MaterialIcon from '@/shared/components/material-icon'
import ToolAction from './tool-action'
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
    <ToolAction icon="settings_backup_restore" type="button" onClick={() => setOpen(true)}>Reconnect editors</ToolAction>
    <Modal className="native-git-dialog" show={open} onHide={() => { if (!busy) setOpen(false) }} aria-label="Recover collaboration sessions">
      <Modal.Header closeButton><Modal.Title><MaterialIcon type="settings_backup_restore" />Restore editing connection</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="native-git-dialog-caption">Use this when collaborators cannot reconnect after a server interruption.</p>
        <div className="native-git-impact"><MaterialIcon type="cloud_done" /><div><strong>Saved edits are kept</strong><p>Changes already received by the server remain safe.</p></div></div>
        <div className="native-git-impact"><MaterialIcon type="group" /><div><strong>Everyone reconnects</strong><p>Collaborators will need to reload their editor.</p></div></div>
        <div className="native-git-impact"><MaterialIcon type="content_copy" /><div><strong>Copy unsent text first</strong><p>Keep a copy of any edits still waiting to upload.</p></div></div>
        {loading && <p role="status">Checking recovery tasks…</p>}
        {error && <p role="alert" className="native-git-error">{error}</p>}
        {task && <p role="status">{task.state === 'resolved' ? 'Recovery completed. Reload the editor to reconnect.' : `Interrupted recovery: ${task.phase}`}</p>}
        {ready && task?.state !== 'resolved' && <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> I understand that collaborators will need to reload.</label>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => setOpen(false)}><MaterialIcon type="close" />Close</button>
        {task?.state === 'resolved'
          ? <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}><MaterialIcon type="refresh" />Reload editor</button>
          : <button type="button" className="btn btn-primary" disabled={!ready || !confirmed || busy} onClick={() => void recover()}><MaterialIcon type="restore" />{busy ? 'Recovering…' : task ? 'Resume reconnection' : 'Restore connection'}</button>}
      </Modal.Footer>
    </Modal>
  </>
}
