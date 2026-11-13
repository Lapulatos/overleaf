import MaterialIcon from '@/shared/components/material-icon'
import { useEffect, useState } from 'react'
import type { GitApi } from './api'
import CollaborationTasks from './collaboration-tasks'
import './source-control.css'

type Task = { id: string; revision: number; state: string; sourceRef: string; targetBranch: string }
const pending = new Set(['preparing', 'conflicted', 'resolving', 'resolving-file', 'ready-to-apply', 'applying', 'recovery-required'])
const labels: Record<string, string> = { conflicted: 'Merge conflict', resolving: 'Conflict being resolved',
  'resolving-file': 'Conflict being resolved', 'ready-to-apply': 'Merge ready for review', applying: 'Merge being applied',
  'recovery-required': 'Merge needs recovery', preparing: 'Merge being prepared' }
const label = (state: string) => labels[state] || state

export default function WorkspaceTaskNotice({ api, canApply }: { api: GitApi; canApply: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selected, setSelected] = useState<string>()
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let live = true, requestId = 0, hadTasks = false
    setTasks([]); setSelected(undefined); setUnavailable(false)
    const refresh = async () => {
      const request = ++requestId
      try {
        const result = (await api.command({ command: 'mergeDraftList' })).result
        if (!live || request !== requestId) return
        if (!Array.isArray(result)) throw Error('Invalid collaboration task list')
        const relevant = (result as Task[]).filter(task => pending.has(task.state))
        hadTasks = relevant.length > 0
        setTasks(relevant); setUnavailable(false)
      } catch {
        if (!live || request !== requestId) return
        setTasks([]); setSelected(undefined); setUnavailable(hadTasks)
      }
    }
    const notify = () => { void refresh() }
    const visible = () => { if (document.visibilityState === 'visible') notify() }
    window.addEventListener('native-git-command-completed', notify)
    window.addEventListener('online', notify)
    window.addEventListener('focus', notify)
    document.addEventListener('visibilitychange', visible)
    const timer = setInterval(visible, 15000)
    notify()
    return () => {
      live = false; requestId++; clearInterval(timer)
      window.removeEventListener('native-git-command-completed', notify)
      window.removeEventListener('online', notify)
      window.removeEventListener('focus', notify)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [api])
  return <>
    {(tasks.length > 0 || unavailable) && <aside className="native-git-workspace-notice" aria-label="Shared Git task notifications">
      {unavailable ? <p role="status">Shared task status is unavailable. Reconnect or refresh to verify access.</p> : <>
        <div className="native-git-notice-heading"><MaterialIcon type="merge" /><strong role="status">{tasks.length === 1 ? 'Merge needs your review' : `${tasks.length} merges need review`}</strong></div>
        {tasks.slice(0, 3).map(task => <div className="native-git-notice-row" key={task.id}>
          <span title={`${label(task.state)}: ${task.sourceRef} → ${task.targetBranch}`}>{task.sourceRef.replace(/^refs\/remotes\//, '')} → {task.targetBranch}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(task.id)}>Review<MaterialIcon type="arrow_forward" /></button>
        </div>)}
        {tasks.length > 3 && <button type="button" className="btn btn-link" onClick={() => setSelected(tasks[0].id)}><MaterialIcon type="merge" />View all {tasks.length} merges</button>}

      </>}
    </aside>}
    {selected && <CollaborationTasks api={api} canApply={canApply} selectedId={selected} onClose={() => {
      setSelected(undefined); window.dispatchEvent(new Event('native-git-command-completed'))
    }} />}
  </>
}
