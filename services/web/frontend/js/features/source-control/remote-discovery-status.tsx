import { Modal } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import ToolAction from './tool-action'
import DiscoverySchedule from './discovery-schedule'
import { useEffect, useState } from 'react'
import { errorMessage, type GitApi } from './api'
import { formatGitDate } from './format-date'

type DiscoveryTask = {
  id: string; revision: number; remote: string; state: string
  createdAt: string; fetchedAt?: string
  changes: { ref: string; before: string | null; after: string | null; change: string }[]
}

export default function RemoteDiscoveryStatus({ api, onReview, busy = false }: { api: GitApi; onReview?: (ref: string, oid: string) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const [tasks, setTasks] = useState<DiscoveryTask[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let live = true, sequence = 0
    setTasks([]); setError(''); setLoaded(false)
    const refresh = async () => {
      const request = ++sequence
      try {
        const response = await api.command({ command: 'remoteDiscoveryList' })
        if (!live || request !== sequence) return
        if (!Array.isArray(response.result) || response.result.some(task =>
          !task || typeof task.id !== 'string' || typeof task.remote !== 'string' ||
          typeof task.createdAt !== 'string' || !Array.isArray(task.changes))) {
          throw new Error('Invalid remote update status response')
        }
        setTasks(response.result as DiscoveryTask[]); setError(''); setLoaded(true)
      } catch (reason) {
        if (!live || request !== sequence) return
        setTasks([]); setError(errorMessage(reason)); setLoaded(true)
      }
    }
    // Subscribe before reading; a notification during a read starts a newer
    // request so an older response can never replace the refreshed snapshot.
    const notify = () => { void refresh() }
    const visible = () => { if (document.visibilityState === 'visible') notify() }
    window.addEventListener('native-git-command-completed', notify)
    window.addEventListener('focus', notify)
    window.addEventListener('online', notify)
    document.addEventListener('visibilitychange', visible)
    const timer = setInterval(visible, 15000)
    notify()
    return () => {
      live = false; sequence++; clearInterval(timer)
      window.removeEventListener('native-git-command-completed', notify)
      window.removeEventListener('focus', notify)
      window.removeEventListener('online', notify)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [api])
  return <>
    <ToolAction icon="cloud_download" onClick={() => setOpen(true)}>Remote updates</ToolAction>
    <DiscoverySchedule api={api} />
    <Modal show={open} onHide={() => setOpen(false)} className="native-git-dialog" aria-label="Remote updates">
      <Modal.Header closeButton><Modal.Title><MaterialIcon type="cloud_download" />Remote updates</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="native-git-dialog-caption">Review incoming changes before merging them into this branch.</p>
        {error && <p role="alert">{error}</p>}
        {!loaded && <p role="status">Loading updates…</p>}
        {loaded && !error && !tasks.length && <div className="native-git-empty"><MaterialIcon type="cloud_done" /><p>No remote checks yet</p></div>}
        {tasks.map(task => <details className="native-git-update-card" key={task.id}>
          <summary>
            <MaterialIcon type={task.state !== 'fetched' ? 'error_outline' : task.changes.length ? 'cloud_download' : 'check_circle'} />
            <span className="native-git-update-heading"><strong>{task.remote}</strong><time>{formatGitDate(task.fetchedAt || task.createdAt)}</time></span>
            <span className="native-git-state">{task.state !== 'fetched' ? 'Incomplete' : task.changes.length ? `${task.changes.length} branches` : 'No changes'}</span>
            <MaterialIcon type="expand_more" />
          </summary>
          {task.changes.map(change => <div className="native-git-update-branch" key={change.ref}>
            <MaterialIcon type="account_tree" />
            <div className="native-git-update-heading"><strong title={change.ref}>{change.ref.replace(`refs/remotes/${task.remote}/`, '')}</strong><small>{change.change} · <code title={`${change.before || '—'} → ${change.after || '—'}`}>{change.before?.slice(0, 8) || '—'} → {change.after?.slice(0, 8) || '—'}</code></small></div>
            {change.after && onReview && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setOpen(false); onReview(change.ref, change.after!) }}><MaterialIcon type="visibility" />Review</button>}
          </div>)}
          {!task.changes.length && <p className="native-git-dialog-caption">{task.state === 'fetched' ? 'Remote branches are unchanged.' : 'This check did not finish.'}</p>}
        </details>)}
      </Modal.Body>
      <Modal.Footer><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><MaterialIcon type="close" />Close</button></Modal.Footer>
    </Modal>
  </>
}
