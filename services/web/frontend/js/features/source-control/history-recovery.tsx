import MaterialIcon from '@/shared/components/material-icon'
import ToolAction from './tool-action'
import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import { errorMessage } from './api'

type Task = { id: string; revision: number; fingerprint: string; version: number; pathname?: string;
  state: string; steps: { phase: string; path: string; kind: string }[]; currentFiles: { path: string; hash: string }[] }
export default function HistoryRecovery({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([]), [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false), [done, setDone] = useState(false)
  const endpoint = `/project/${projectId}/history-recovery`
  const review = async () => {
    setOpen(true); setBusy(true); setError(''); setConfirmed(false); setDone(false)
    try { setTasks((await getJSON<{ tasks: Task[] }>(endpoint)).tasks) }
    catch (e) { setError(errorMessage(e)); setTasks([]) }
    finally { setBusy(false) }
  }
  const recover = async (task: Task, decision: 'retry' | 'keep') => {
    setBusy(true); setError('')
    try {
      await postJSON(endpoint, { body: { id: task.id, revision: task.revision, fingerprint: task.fingerprint, decision } })
      setTasks([]); setDone(true)
    } catch (e) { setError(errorMessage(e)); setConfirmed(false) }
    finally { setBusy(false) }
  }
  return <>
    <ToolAction icon="history" type="button" onClick={() => void review()}>Recover interrupted restore</ToolAction>
    <Modal className="native-git-dialog" show={open} onHide={() => { if (!busy) setOpen(false) }} aria-label="History recovery">
      <Modal.Header closeButton><Modal.Title><MaterialIcon type="history" />History recovery</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <p role="alert" className="native-git-error">{error}</p>}
        {busy && <p role="status">Checking or recovering history…</p>}
        {done && <p role="status">Recovery completed. Reload the editor to reconnect.</p>}
        {!busy && !done && !tasks.length && !error && <p>No interrupted history restore.</p>}
        {tasks.map(task => <div key={task.id}>
          <p>Interrupted restore to version {task.version}{task.pathname ? `: ${task.pathname}` : ''}. Completed file steps: {task.steps.filter(s => s.phase === 'after').length}.</p>
          <p>The files below are the current state. Retry restores the selected historical version again, including files already processed. Keep current files ends recovery without replacing them. Earlier snapshots remain retained.</p>
          <ul>{task.currentFiles.map(f => <li key={f.path}>{f.path} <code>{f.hash.slice(0, 12)}</code></li>)}</ul>
          <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> I reviewed the current files and understand the selected recovery action.</label>
          <div><button type="button" className="btn btn-default" disabled={busy || !confirmed} onClick={() => void recover(task, 'keep')}><MaterialIcon type="save" />Keep current files</button>{' '}
            <button type="button" className="btn btn-primary" disabled={busy || !confirmed} onClick={() => void recover(task, 'retry')}><MaterialIcon type="restore" />Retry historical restore</button></div>
        </div>)}
      </Modal.Body>
      <Modal.Footer><button type="button" className="btn btn-default" disabled={busy} onClick={() => void review()}><MaterialIcon type="refresh" />Refresh preview</button>
        {done && <button type="button" className="btn btn-primary" onClick={() => location.reload()}><MaterialIcon type="refresh" />Reload editor</button>}
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => setOpen(false)}><MaterialIcon type="close" />Close</button></Modal.Footer>
    </Modal>
  </>
}
