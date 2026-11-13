import MaterialIcon from '@/shared/components/material-icon'
import { useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi } from './api'

type Workspace = { workspaceId: string; logicalProjectId: string; branch: string; state: string; sourceWorkspaceId?: string; sourceCommit?: string }
export default function BranchWorkspaces({ api, onClose }: { api: GitApi; onClose(): void }) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Workspace[]>([]), [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Workspace | null>(null)
  useEffect(() => {
    let active = true
    setBusy(true); setError('')
    api.command({ command: 'workspaceList' }).then(value => { if (active) setItems(value.result as Workspace[]) })
      .catch(error => { if (active) setError(errorMessage(error)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [api, reload])
  const change = async (item: Workspace) => {
    const action = item.state === 'archived' ? 'restore' : 'archive'
    setBusy(true); setError('')
    try {
      await api.command({ command: 'workspaceLifecycle', workspaceId: item.workspaceId, expectedState: item.state, action })
      // The archived workspace no longer authorizes list requests. Its archive
      // notice provides the route back to the logical project for restoration.
      setPending(null)
      if (action === 'archive' && item.workspaceId === api.projectId) onClose()
      else setReload(n => n + 1)
    }
    catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <>
    <Modal className="native-git-dialog" show onHide={() => onClose()} aria-label="Archive or restore workspaces">
      <Modal.Header closeButton><Modal.Title><MaterialIcon type="account_tree" />Archive / restore workspaces</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="native-git-dialog-caption">Archive a branch’s collaboration workspace to pause editing. Its documents, comments and Git branch are kept. Restore it to resume editing. Only the project owner can change this.</p>
        <label className="native-git-branch-search"><MaterialIcon type="search" /><input aria-label="Find a branch" placeholder="Find a branch…" className="form-control" value={query} onChange={event => setQuery(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        {pending && <div role="group" aria-label="Confirm branch lifecycle change" className="alert alert-warning">
          <p>{pending.state === 'archived' ? 'Restore' : 'Archive'} workspace for <strong>{pending.branch}</strong>? Documents, comments and history are retained. Existing editing tabs must reload.</p>
          <button className="btn btn-primary" disabled={busy} onClick={() => void change(pending)}><MaterialIcon type="restore" />Confirm {pending.state === 'archived' ? 'restore' : 'archive'}</button>{' '}
          <button className="btn btn-default" disabled={busy} onClick={() => setPending(null)}><MaterialIcon type="close" />Cancel</button>
        </div>}
        {!items.length && !busy && <p>No additional collaboration workspaces to archive. The main project workspace remains available.</p>}
        <div className="native-git-branch-list">{items.filter(item => item.branch.toLowerCase().includes(query.toLowerCase())).map(item => <div key={item.workspaceId} className="native-git-branch-card">
          <MaterialIcon type={item.state === 'archived' ? 'inventory_2' : 'account_tree'} />
          <div className="native-git-update-heading"><strong title={item.branch}>{item.branch}</strong><small>{item.state === 'ready' ? 'Active' : item.state}{item.sourceCommit && <> · From <code title={item.sourceCommit}>{item.sourceCommit.slice(0, 8)}</code></>}</small></div>
          <div className="native-git-card-actions">

          {['ready', 'archived'].includes(item.state) && <button className="btn btn-secondary" disabled={busy} onClick={() => setPending(item)}><MaterialIcon type={item.state === 'archived' ? 'restore' : 'archive'} />{item.state === 'archived' ? 'Restore' : 'Archive'}</button>}
          </div>
        </div>)}</div>
        {!!items.length && !items.some(item => item.branch.toLowerCase().includes(query.toLowerCase())) && <p>No matching branches.</p>}
      </Modal.Body>
      <Modal.Footer><button className="btn btn-default" disabled={busy} onClick={() => setReload(n => n + 1)}><MaterialIcon type="refresh" />Refresh</button></Modal.Footer>
    </Modal>
  </>
}
