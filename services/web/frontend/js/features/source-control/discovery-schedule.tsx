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
  return <Modal show onHide={() => { if (!busy) onClose() }} aria-label="Automatic remote checks">
    <Modal.Header closeButton><Modal.Title>Automatic remote checks</Modal.Title></Modal.Header>
    <Modal.Body>
      <p>The project owner can schedule shared remote checks. Checks continue when browsers are closed. Fetched changes require a reviewed merge before they appear in the editor.</p>
      {error && <p role="alert">{error}</p>}
      {!policy && !error && <p role="status">Loading settings…</p>}
      {policy && <>
        {!policy.schedulerAvailable && <p role="status">Background checks are unavailable on this server.</p>}
        {policy.state && <p>Schedule status: {policy.state}</p>}
        <label><input type="checkbox" checked={enabled} disabled={busy || (!policy.schedulerAvailable && !enabled)} onChange={event => setEnabled(event.target.checked)} /> Enable automatic remote checks</label>
        <label className="native-git-field">Remote name<input className="form-control" value={remote} disabled={busy} onChange={event => setRemote(event.target.value)} /></label>
        <label className="native-git-field">Check interval (minutes)<input className="form-control" type="number" min={1} max={1440} step={1} value={minutes} disabled={busy} onChange={event => setMinutes(Number(event.target.value))} /></label>
        {policy.state === 'paused' && <p>Review the remote and your access before saving to resume checks.</p>}
      </>}
      {policy && <WebhookSettings api={api} />}
    </Modal.Body>
    <Modal.Footer>
      <button className="btn btn-default" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload settings</button>
      <button className="btn btn-primary" disabled={busy || !policy || (enabled && !policy.schedulerAvailable) || !remote.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440} onClick={() => void save()}>Save remote checks</button>
    </Modal.Footer>
  </Modal>
}
export default function DiscoverySchedule({ api }: { api: GitApi }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="btn btn-link" onClick={() => setOpen(true)}>Automatic remote checks…</button>
    {open && <Settings api={api} onClose={() => setOpen(false)} />}</>
}
