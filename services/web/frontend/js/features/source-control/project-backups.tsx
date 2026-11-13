import MaterialIcon from '@/shared/components/material-icon'
import ToolAction from './tool-action'
import { formatGitDate } from './format-date'
import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi } from './api'
type Backup = { id: string; capturedAt: string; files: number; bytes: number; workspaces: number; downloadUrl: string }
type Restore = { id: string; revision: number; backupId: string; state: string; name: string; workspaces: number; failure?: string; url?: string }
type Cleanup = { id: string; eligible: boolean; reason?: string; bytes: number; files: number; fingerprint: string }
type CleanupReceipt = { id: string; backupId: string; fingerprint: string; state: string }
export default function ProjectBackups({ api }: { api: GitApi }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [items, setItems] = useState<Backup[]>([])
  const [restores, setRestores] = useState<Restore[]>([]), [preview, setPreview] = useState<Restore>()
  const [retained, setRetained] = useState<string>()
  const [cleanup, setCleanup] = useState<{ items: Cleanup[]; receipts: CleanupReceipt[] }>()
  const [cleanupSelection, setCleanupSelection] = useState<Cleanup>()
  const [allowed, setAllowed] = useState(false)
  const refresh = async () => {
    setOpen(true); setBusy(true); setError(''); setAllowed(false)
    try {
      const [backups, jobs] = await Promise.all([api.command({ command: 'backupList' }), api.command({ command: 'backupRestoreList' })])
      setItems(backups.result as Backup[]); setRestores(jobs.result as Restore[]); setAllowed(true)
    }
    catch (e) { setError(errorMessage(e)); setItems([]) }
    finally { setBusy(false) }
  }
  const create = async () => {
    setBusy(true); setError('')
    try {
      const result = (await api.command({ command: 'backupCreate' })).result as Backup
      setItems(previous => [result, ...previous])
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  const prepareRestore = async (id: string) => {
    setBusy(true); setError('')
    try { setPreview((await api.command({ command: 'backupRestorePreview', id })).result as Restore) }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const applyRestore = async () => {
    if (!preview) return
    setBusy(true); setError('')
    try {
      const result = (await api.command({ command: 'backupRestoreApply', id: preview.id, revision: preview.revision })).result as Restore
      setRestores(previous => [result, ...previous.filter(p=>p.id!==result.id)]); setPreview(undefined)
    } catch (e) { setError(errorMessage(e)); setPreview(undefined) } finally { setBusy(false) }
  }
  const retainBackup = async (id: string) => {
    setBusy(true); setError('')
    try { setRetained(((await api.command({ command: 'backupRetain', id })).result as { url: string }).url) }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const inspectCleanup = async () => {
    setBusy(true); setError(''); setCleanupSelection(undefined)
    try { setCleanup((await api.command({ command: 'backupCleanupPreview' })).result as { items: Cleanup[]; receipts: CleanupReceipt[] }) }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const applyCleanup = async (id: string, fingerprint: string) => {
    setBusy(true); setError('')
    try {
      await api.command({ command: 'backupCleanupApply', id, fingerprint })
      setCleanupSelection(undefined)
      setCleanup((await api.command({ command: 'backupCleanupPreview' })).result as { items: Cleanup[]; receipts: CleanupReceipt[] })
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <>
    <ToolAction icon="inventory_2" type="button" onClick={() => void refresh()}>Backups & restore</ToolAction>
    <Modal className="native-git-dialog" show={open} onHide={() => { if (!busy) setOpen(false) }} size="lg" aria-label="Project backups">
      <Modal.Header closeButton><Modal.Title><MaterialIcon type="inventory_2" />Project backups</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="native-git-dialog-caption">Save all branches. Restore a backup as a separate private project.</p>
        <details className="native-git-help"><summary>What is included?</summary><p>Files, comments, history and Git recovery data are included. Credentials, share links and browser sessions are excluded. If content changes during capture, the backup stops without changing your project.</p></details>
        <a className="btn btn-secondary" href="/git-recovery"><MaterialIcon type="inventory_2" />Recovery vault</a>
        {retained && <p role="status">Backup retained. <a href={retained}>Open retained copy</a></p>}
        {error && <p role="alert" className="native-git-error">{error}</p>}
        {busy && <p role="status">Checking or capturing the project backup…</p>}
        <div className="native-git-branch-list">{items.map(item => <div className="native-git-branch-card" key={item.id}>
          <MaterialIcon type="inventory_2" />
          <div className="native-git-update-heading"><strong>{formatGitDate(item.capturedAt)}</strong><small>{item.workspaces} branches · {item.files} files · {(item.bytes / 1024 / 1024).toFixed(2)} MB</small></div>
          <div className="native-git-card-actions">
          <a className="btn btn-secondary" href={item.downloadUrl}><MaterialIcon type="download" />Download</a>
          <button type="button" className="btn btn-secondary" disabled={busy || !allowed} onClick={() => void prepareRestore(item.id)}><MaterialIcon type="restore" />Restore</button>
          <button type="button" className="btn btn-secondary" disabled={busy || !allowed} onClick={() => void retainBackup(item.id)}><MaterialIcon type="save" />Keep</button>
          </div>
        </div>)}</div>
        {preview && <div role="region" aria-label="Restore preview">
          <p>Create <strong>{preview.name}</strong> with {preview.workspaces} workspaces? Only you will have access initially. Invite collaborators again after checking the result.</p>
          <p>Document IDs and workspace generations are renewed. Old tasks remain in the backup as evidence; they cannot execute in the new project. Remote credentials and automatic sync are not restored. Conflicted staging is retained as evidence and the file contents become unstaged changes.</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void applyRestore()}><MaterialIcon type="restore" />Create restored project</button>{' '}
          <button type="button" className="btn btn-default" disabled={busy} onClick={() => setPreview(undefined)}><MaterialIcon type="close" />Cancel restore</button>
        </div>}
        <ul>{restores.filter(r=>r.state!=='planned').map(r=><li key={r.id}>{r.name}: {r.state}{r.failure && <p role="alert">{r.failure}</p>}{r.url && <> · <a href={r.url}>Open restored project</a></>}</li>)}</ul>
        {cleanup && <section aria-label="Backup cleanup">
          <p>Only unfinished captures older than 24 hours without restore references can be removed. Completed backups, restore data and Git objects are retained.</p>
          <ul>{cleanup.items.map(item => <li key={item.id}>{item.id}: {item.reason || `${item.files} files, ${item.bytes} bytes eligible`}
            {item.eligible && <button type="button" className="btn btn-link" disabled={busy} onClick={() => setCleanupSelection(item)}><MaterialIcon type="visibility" />Review cleanup…</button>}
          </li>)}</ul>
          {cleanupSelection && <div role="region" aria-label="Cleanup confirmation">
            <p>Permanently remove unfinished backup <strong>{cleanupSelection.id}</strong> ({cleanupSelection.files} files, {cleanupSelection.bytes} bytes)? This partial capture cannot be restored. Live project files are not affected.</p>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void applyCleanup(cleanupSelection.id, cleanupSelection.fingerprint)}><MaterialIcon type="inventory_2" />Remove unfinished backup</button>{' '}
            <button type="button" className="btn btn-default" disabled={busy} onClick={() => setCleanupSelection(undefined)}><MaterialIcon type="close" />Cancel cleanup</button>
          </div>}
          <ul>{cleanup.receipts.map(r => <li key={r.id}>Cleanup {r.backupId}: {r.state}
            {r.state !== 'completed' && <button type="button" className="btn btn-link" disabled={busy} onClick={() => void applyCleanup(r.backupId, r.fingerprint)}><MaterialIcon type="restore" />Resume approved cleanup</button>}
          </li>)}</ul>
        </section>}
        {!busy && allowed && !items.length && <p>No completed backups.</p>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-default" disabled={busy || !allowed} onClick={() => void inspectCleanup()}><MaterialIcon type="inventory_2" />Inspect retained captures</button>
        <button type="button" className="btn btn-primary" disabled={busy || !allowed} onClick={() => void create()}><MaterialIcon type="inventory_2" />Create verified backup</button>
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => void refresh()}><MaterialIcon type="refresh" />Refresh list</button>
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => setOpen(false)}><MaterialIcon type="close" />Close</button>
      </Modal.Footer>
    </Modal>
  </>
}
