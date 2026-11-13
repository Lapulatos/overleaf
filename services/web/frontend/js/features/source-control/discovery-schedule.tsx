import MaterialIcon from '@/shared/components/material-icon'
import ToolAction from './tool-action'
import WebhookSettings from './webhook-settings'
import { useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi } from './api'

type Policy = { revision: number; enabled: boolean; remote?: string; intervalMs?: number; state?: string; schedulerAvailable?: boolean }
function Settings({ api, onClose }: { api: GitApi; onClose(): void }) {
  const [policy, setPolicy] = useState<Policy>()
  const [enabled, setEnabled] = useState(false)
  const [remote, setRemote] = useState('origin')
  const [minutes, setMinutes] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let live = true
    setPolicy(undefined); setError('')
    void api.command({ command: 'discoverySchedule' }).then(response => {
      if (!live) return
      const value = response.result as Policy
      setPolicy(value); setEnabled(value.enabled); setRemote(value.remote || 'origin'); setMinutes((value.intervalMs || 300000) / 60000)
    }).catch(reason => { if (live) setError(errorMessage(reason)) })
    return () => { live = false }
  }, [api, reload])
  const save = async () => {
    if (!policy || busy) return
    setBusy(true); setError('')
    try {
      await api.command({ command: 'configureDiscoverySchedule', revision: policy.revision, enabled, remote: remote.trim(), intervalMs: minutes * 60000 })
      window.dispatchEvent(new Event('native-git-command-completed'))
      setReload(value => value + 1)
    } catch (reason) { setError(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  return <Modal className="native-git-dialog" show onHide={() => { if (!busy) onClose() }} aria-label="Automatic remote checks">
    <Modal.Header closeButton><Modal.Title><MaterialIcon type="cloud_sync" />Automatic remote checks</Modal.Title></Modal.Header>
    <Modal.Body>
      <p className="native-git-dialog-caption">Check for new remote commits automatically.</p>
      <p className="native-git-dialog-caption">You review incoming changes before they update the paper.</p>
      {error && <p role="alert">{error}</p>}
      {!policy && !error && <p role="status">Loading settings…</p>}
      {policy && <>
        {!policy.schedulerAvailable && <p role="status">Background checks are unavailable on this server.</p>}
        {policy.state && <p>{policy.state === 'disabled' ? 'Off' : policy.state === 'paused' ? 'Paused — needs attention' : 'Automatic checks are on'}</p>}
        <label><input type="checkbox" checked={enabled} disabled={busy || (!policy.schedulerAvailable && !enabled)} onChange={event => setEnabled(event.target.checked)} /> Enable automatic remote checks</label>
        <label className="native-git-field">Repository remote<input className="form-control" value={remote} disabled={busy} onChange={event => setRemote(event.target.value)} /></label>
        <label className="native-git-field">Check for updates<select className="form-control" value={minutes} disabled={busy} onChange={event => setMinutes(Number(event.target.value))}>
          {[1, 5, 15, 60, 1440].includes(minutes) ? null : <option value={minutes}>Every {minutes} minutes</option>}
          <option value={1}>Every minute</option><option value={5}>Every 5 minutes</option><option value={15}>Every 15 minutes</option><option value={60}>Hourly</option><option value={1440}>Daily</option>
        </select></label>
        {policy.state === 'paused' && <p>Review the remote and your access before saving to resume checks.</p>}
      </>}
      {policy && <details className="native-git-help"><summary>Advanced: GitHub push notifications</summary><WebhookSettings api={api} /></details>}
    </Modal.Body>
    <Modal.Footer>
      <button className="btn btn-default" disabled={busy} onClick={() => setReload(value => value + 1)}><MaterialIcon type="refresh" />Reload settings</button>
      <button className="btn btn-primary" disabled={busy || !policy || (enabled && !policy.schedulerAvailable) || !remote.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440} onClick={() => void save()}><MaterialIcon type="save" />Save settings</button>
    </Modal.Footer>
  </Modal>
}
export default function DiscoverySchedule({ api }: { api: GitApi }) {
  const [open, setOpen] = useState(false)
  return <><ToolAction icon="cloud_sync" type="button" onClick={() => setOpen(true)}>Remote checks & webhooks</ToolAction>
    {open && <Settings api={api} onClose={() => setOpen(false)} />}</>
}
