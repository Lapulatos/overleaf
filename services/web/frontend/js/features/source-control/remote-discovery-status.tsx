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
  return <details className="native-git-remote-discovery">
    <summary>Remote update checks{loaded && !error ? ` (${tasks.length})` : ''}</summary>
    <DiscoverySchedule api={api} />
    {error ? <p role="alert">{error}</p> : <>
      <p>Fetched updates do not change the files being edited. Use a reviewed merge to update this branch.</p>
      {!loaded ? <p role="status">Loading remote update checks…</p> : !tasks.length && <p>No remote update checks recorded.</p>}
      <ul>{tasks.map(task => <li key={task.id}>
        <strong>{task.remote}</strong> · {formatGitDate(task.fetchedAt || task.createdAt)} · {task.state === 'fetched' ? 'Fetched; files not applied by this check' : 'Check incomplete; retry may be needed'}
        {task.state === 'fetched' && !task.changes.length && <p>No remote branch changes.</p>}
        <ul>{task.changes.map(change => <li key={change.ref}>
          {change.ref} · {change.change} · <code>{change.before?.slice(0, 8) || '—'} → {change.after?.slice(0, 8) || '—'}</code>
          {change.after && onReview && <button type="button" className="btn btn-link" disabled={busy} onClick={() => onReview(change.ref, change.after!)}>Review {change.after.slice(0, 8)} for this branch</button>}
        </li>)}</ul>
      </li>)}</ul>
    </>}
  </details>
}
