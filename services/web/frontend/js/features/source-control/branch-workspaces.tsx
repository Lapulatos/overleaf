import { useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi } from './api'

type Workspace = { workspaceId: string; logicalProjectId: string; branch: string; state: string; sourceWorkspaceId?: string; sourceCommit?: string }
export default function BranchWorkspaces({ api }: { api: GitApi }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Workspace[]>([]), [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Workspace | null>(null)
  useEffect(() => {
    if (!open) return
    let active = true
    setBusy(true); setError('')
    api.command({ command: 'workspaceList' }).then(value => { if (active) setItems(value.result as Workspace[]) })
      .catch(error => { if (active) setError(errorMessage(error)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [api, open, reload])
  const change = async (item: Workspace) => {
    const action = item.state === 'archived' ? 'restore' : 'archive'
    setBusy(true); setError('')
    try {
      await api.command({ command: 'workspaceLifecycle', workspaceId: item.workspaceId, expectedState: item.state, action })
      // The archived workspace no longer authorizes list requests. Its archive
      // notice provides the route back to the logical project for restoration.
      setPending(null)
      if (action === 'archive' && item.workspaceId === api.projectId) setOpen(false)
      else setReload(n => n + 1)
    }
    catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <>
    <button className="btn btn-link" onClick={() => setOpen(true)}>Branch workspaces…</button>
    {open && <Modal show onHide={() => setOpen(false)} aria-label="Branch workspaces">
      <Modal.Header closeButton><Modal.Title>Branch workspaces</Modal.Title></Modal.Header>
      <Modal.Body>
        <p>Each branch keeps its own documents, comments, editing history and compiled PDF. A new branch starts a new comment and editing-history timeline; its source remains available in the original workspace. Git history is shared.</p>
        <p>Archiving retains all content and blocks editing. Only the project owner can archive or restore a branch. The default workspace stays available.</p>
        <label>Find a branch<input className="form-control" value={query} onChange={event => setQuery(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        {pending && <div role="group" aria-label="Confirm branch lifecycle change" className="alert alert-warning">
          <p>{pending.state === 'archived' ? 'Restore' : 'Archive'} branch <strong>{pending.branch}</strong>? Documents, comments and history are retained. Existing editing tabs must reload.</p>
          <button className="btn btn-primary" disabled={busy} onClick={() => void change(pending)}>Confirm {pending.state === 'archived' ? 'restore' : 'archive'}</button>{' '}
          <button className="btn btn-default" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
        </div>}
        {!items.length && !busy && <p>No additional branch workspaces.</p>}
        {items.filter(item => item.branch.toLowerCase().includes(query.toLowerCase())).map(item => <div key={item.workspaceId} className="mb-3">
          <strong>{item.branch}</strong> — {item.state}
          {item.sourceCommit && <p>Created from commit <code>{item.sourceCommit.slice(0, 8)}</code>. Comments and editing history remain in the source workspace.</p>}
          {item.state === 'ready' && <a className="btn btn-link" href={`/project/${item.logicalProjectId}/workspace/${item.workspaceId}`}>Open branch</a>}
          {['ready', 'archived'].includes(item.state) && <button className="btn btn-default" disabled={busy} onClick={() => setPending(item)}>{item.state === 'archived' ? 'Restore' : 'Archive'}</button>}
        </div>)}
      </Modal.Body>
      <Modal.Footer><button className="btn btn-default" disabled={busy} onClick={() => setReload(n => n + 1)}>Refresh</button></Modal.Footer>
    </Modal>}
  </>
}
