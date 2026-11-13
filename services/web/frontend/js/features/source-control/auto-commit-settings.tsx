import MaterialIcon from '@/shared/components/material-icon'
import ToolAction from './tool-action'
import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi, type GitCommand } from './api'

type Policy = { revision: number; enabled: boolean; intervalMs?: number; state?: string; reason?: string; operationId?: string | null; schedulerAvailable?: boolean; canManage?: boolean }
type Recovery = { operationId: string; revision: number; fingerprint: string; action: 'cancel' | 'complete' | 'install-index' | null }
const reasons: Record<string, string> = {
  'manual-index': 'Manual staged changes need review before automatic commits can resume.',
  'unsaved-edits': 'Some edits have not been saved.',
  'recovery-required': 'Resolve the pending conflict or recovery task first.',
  'outcome-unknown': 'An interrupted automatic commit needs review.',
  'permission-revoked': 'The task owner no longer has the required access.',
  'inspection-failed': 'The workspace could not be checked. Review its status before resuming.',
  'reconciled-reenable-required': 'Recovery is complete. Automatic commits remain disabled until you enable them again.',
}
function Settings({ api, onClose }: { api: GitApi; onClose(): void }) {
  const generation = useRef(0)
  const [policy, setPolicy] = useState<Policy>()
  const [enabled, setEnabled] = useState(false)
  const [minutes, setMinutes] = useState(5)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [recovery, setRecovery] = useState<Recovery>()
  useEffect(() => {
    const current = ++generation.current
    setPolicy(undefined); setRecovery(undefined); setBusy(true); setError('')
    void api.command({ command: 'autoCommitSchedule' }).then(response => {
      if (generation.current !== current) return
      const value = response.result as Policy
      setPolicy(value); setEnabled(value.enabled); setMinutes((value.intervalMs || 300000) / 60000)
    }).catch(reason => { if (generation.current === current) setError(errorMessage(reason)) })
      .finally(() => { if (generation.current === current) setBusy(false) })
    return () => { generation.current++ }
  }, [api, reload])
  const run = async (command: GitCommand, preview = false) => {
    if (busy) return
    const current = generation.current
    setBusy(true); setError('')
    try {
      const response = await api.command(command)
      if (current !== generation.current) return
      if (preview) setRecovery(response.result as Recovery)
      else {
        setRecovery(undefined)
        window.dispatchEvent(new Event('native-git-command-completed'))
        setReload(value => value + 1)
      }
    } catch (reason) { if (current === generation.current) { setRecovery(undefined); setError(errorMessage(reason)) } }
    finally { if (current === generation.current) setBusy(false) }
  }
  return <Modal className="native-git-dialog" show onHide={() => { if (!busy) onClose() }} aria-label="Automatic commits">
    <Modal.Header closeButton><Modal.Title><MaterialIcon type="schedule" />Automatic commits</Modal.Title></Modal.Header>
    <Modal.Body>
      <p className="native-git-dialog-caption">Save branch changes as commits on a schedule.</p>
      <details className="native-git-help"><summary>How it works</summary><p>The project owner can schedule commits for this branch. Online editors must save before a commit. Manual staged changes pause the task. This does not push changes to a remote repository.</p></details>
      {error && <p role="alert">{error}</p>}
      {!policy && busy && <p role="status">Loading settings…</p>}
      {policy && <>
        {!policy.schedulerAvailable && <p role="status">Automatic scheduling is unavailable on this server. Existing tasks can still be reviewed.</p>}
        {policy.canManage === false && <p>You can view this branch’s schedule. Only the project owner can change it.</p>}
        <p>Schedule status: {policy.state || 'disabled'}</p>
        {policy.reason && <p role="status">{reasons[policy.reason] || 'Review the task before enabling automatic commits.'}</p>}
        <label><input type="checkbox" checked={enabled} disabled={busy || policy.canManage === false || !!policy.operationId || (!policy.schedulerAvailable && !enabled)} onChange={event => setEnabled(event.target.checked)} /> Enable automatic commits for this branch</label>
        <label className="native-git-field">Commit interval (minutes)<input className="form-control" type="number" min={1} max={1440} step={1} value={minutes} disabled={busy || policy.canManage === false || !!policy.operationId} onChange={event => setMinutes(Number(event.target.value))} /></label>
        {policy.operationId && policy.canManage !== false && <>
          <p>An interrupted task must be reviewed before this schedule can change.</p>
          <button className="btn btn-default" disabled={busy} onClick={() => void run({ command: 'autoCommitRecoveryPreview', operationId: policy.operationId }, true)}><MaterialIcon type="visibility" />Review interrupted automatic commit</button>
          {recovery && <>
            <p>{recovery.action === 'cancel' ? 'The candidate was not published. Cancel the pending task and preserve current content.' : recovery.action ? 'The commit was published. Finish its bookkeeping without creating another commit or replacing current writing.' : 'The repository changed. This task requires manual reconciliation; no automatic recovery is available.'}</p>
            <button className="btn btn-primary" disabled={busy || !recovery.action} onClick={() => void run({ command: 'autoCommitRecover', operationId: recovery.operationId, revision: recovery.revision, fingerprint: recovery.fingerprint, scheduleRevision: policy.revision })}><MaterialIcon type="restore" />Confirm automatic commit recovery</button>
          </>}
        </>}
      </>}
    </Modal.Body>
    <Modal.Footer>
      <button className="btn btn-default" disabled={busy} onClick={() => setReload(value => value + 1)}><MaterialIcon type="refresh" />Reload settings</button>
      <button className="btn btn-primary" disabled={busy || !policy || policy.canManage === false || !!policy.operationId || (enabled && !policy.schedulerAvailable) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440} onClick={() => policy && void run({ command: 'configureAutoCommitSchedule', revision: policy.revision, enabled, intervalMs: minutes * 60000 })}><MaterialIcon type="save" />Save automatic commits</button>
    </Modal.Footer>
  </Modal>
}
export default function AutoCommitSettings({ api }: { api: GitApi }) {
  const [open, setOpen] = useState(false)
  return <><ToolAction icon="schedule" type="button" onClick={() => setOpen(true)}>Automatic commits</ToolAction>
    {open && <Settings api={api} onClose={() => setOpen(false)} />}</>
}
