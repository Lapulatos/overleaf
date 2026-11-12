import { useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi } from './api'

type Policy = { revision: number; enabled: boolean; pull?: boolean; push?: boolean; remote?: string; branch?: string; intervalMs?: number; state?: string; reason?: string; operationId?: string | null; mergeId?: string | null; schedulerAvailable?: boolean }
const reasons: Record<string, string> = {
  'shared-task-pending': 'A shared merge or recovery task needs attention. Automatic sync is paused.',
  'merge-review-required': 'Incoming changes need a shared merge review. Open Shared merge tasks to resolve or cancel it, then enable this schedule again.',
  'waiting-for-commit': 'Edits are preserved. Waiting for a manual or automatic commit; this schedule will check again at the next interval.',
  'working-changes': 'Uncommitted or staged changes are preserved. Commit or review them before resuming.',
  'incoming-or-working-changes': 'Incoming changes or local edits need review before pushing.',
  'outcome-unknown': 'An interrupted operation needs reconciliation. It will not be retried automatically.',
  'target-changed': 'The branch or remote URL changed. Review the target before enabling again.',
  'push-target-changed': 'The push destination changed since discovery. Review the remote before resuming.',
  'remote-history-changed': 'Remote history was rewritten or deleted. Review it before resuming automatic sync.',
  'remote-branch-missing': 'The selected remote branch does not exist. Publish it explicitly before enabling sync.',
  'permission-revoked': 'The schedule owner no longer has permission.',
  'owner-changed': 'Project ownership changed. Review the schedule with the new owner.',
  'inspection-failed': 'The workspace could not be checked. Review its current status.',
  'reconciled-reenable-required': 'Reconciliation completed. The schedule stays disabled until you enable it again.',
}
function Settings({ api, branch, onClose }: { api: GitApi; branch: string; onClose(): void }) {
  const [policy, setPolicy] = useState<Policy>()
  const [enabled, setEnabled] = useState(false), [pull, setPull] = useState(true), [push, setPush] = useState(false)
  const [remote, setRemote] = useState('origin'), [target, setTarget] = useState(branch), [minutes, setMinutes] = useState(5)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true; setBusy(true); setError('')
    api.command({ command: 'autoSyncSchedule' }).then(result => {
      if (!active) return
      const value = result.result as Policy
      setPolicy(value); setEnabled(value.enabled); setPull(value.pull ?? true); setPush(value.push ?? false)
      setRemote(value.remote || 'origin'); setTarget(value.branch || branch); setMinutes((value.intervalMs || 300000) / 60000)
    }).catch(error => { if (active) setError(errorMessage(error)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [api, branch, reload])
  const execute = async (command: Record<string, unknown> & { command: string }) => {
    setBusy(true); setError('')
    try { await api.command(command); setReload(value => value + 1) }
    catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <Modal show onHide={onClose} aria-label="Automatic pull and push">
    <Modal.Header closeButton><Modal.Title>Automatic pull and push</Modal.Title></Modal.Header>
    <Modal.Body>
      <p>This branch has one server schedule shared by all collaborators. Pull applies clean fast-forwards; divergence opens a shared review. Push never forces remote history.</p>
      {error && <p role="alert">{error}</p>}
      {policy && <>
        <p role="status">Schedule status: {policy.state || 'disabled'}</p>
        {policy.reason && <p>{reasons[policy.reason] || 'Review the retained operation before resuming.'}</p>}
        {policy.mergeId && <p>Shared merge task: <code>{policy.mergeId}</code></p>}
        {!policy.schedulerAvailable && <p>Background automatic sync is not enabled on this server.</p>}
        <fieldset disabled={busy || !!policy.operationId}>
          <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Enable automatic sync for this branch</label><br />
          <label><input type="checkbox" checked={pull} onChange={e => setPull(e.target.checked)} /> Automatically pull clean fast-forward updates</label><br />
          <label><input type="checkbox" checked={push} onChange={e => setPush(e.target.checked)} /> Automatically push committed changes</label>
          <label className="native-git-field">Remote<input className="form-control" value={remote} onChange={e => setRemote(e.target.value)} /></label>
          <label className="native-git-field">Remote branch<input className="form-control" value={target} onChange={e => setTarget(e.target.value)} /></label>
          <label className="native-git-field">Interval (minutes)<input className="form-control" type="number" min={1} max={1440} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>
        </fieldset>
        {policy.operationId && <><button type="button" className="btn btn-default" disabled={busy} onClick={() => void execute({ command: 'reconcileAutoSync', revision: policy.revision })}>Reconcile interrupted sync</button>
          <button type="button" className="btn btn-default" disabled={busy} onClick={() => void execute({ command: 'reconcileAutoSync', revision: policy.revision, retryPush: true })}>Retry the same push if remote is unchanged</button></>}
      </>}
    </Modal.Body>
    <Modal.Footer>
      <button className="btn btn-default" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload settings</button>
      <button className="btn btn-primary" disabled={busy || !policy || !!policy.operationId || (enabled && (!policy.schedulerAvailable || (!pull && !push))) || !remote || !target || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440}
        onClick={() => policy && void execute({ command: 'configureAutoSyncSchedule', revision: policy.revision, enabled, pull, push, remote, branch: target, intervalMs: minutes * 60000 })}>Save automatic sync</button>
    </Modal.Footer>
  </Modal>
}
export default function AutoSyncSettings({ api, branch }: { api: GitApi; branch: string }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="btn btn-link" onClick={() => setOpen(true)}>Automatic pull / push…</button>
    {open && <Settings api={api} branch={branch} onClose={() => setOpen(false)} />}</>
}
