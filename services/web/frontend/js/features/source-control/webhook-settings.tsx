import { formatGitDate } from './format-date'
import { useEffect, useState } from 'react'
import { errorMessage, type GitApi } from './api'
type Hook = { enabled: boolean; revision: number; repository?: string; path?: string; secret?: string; lastReceivedAt?: string }
export default function WebhookSettings({ api }: { api: GitApi }) {
  const [hook, setHook] = useState<Hook>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    void api.command({ command: 'webhookStatus' }).then(value => { if (live) setHook(value.result as Hook) })
      .catch(reason => { if (live) setError(errorMessage(reason)) })
    return () => { live = false }
  }, [api])
  const save = async (enabled: boolean) => {
    if (!hook || busy) return
    setBusy(true); setError('')
    try { setHook((await api.command({ command: 'configureWebhook', enabled, revision: hook.revision })).result as Hook) }
    catch (reason) { setError(errorMessage(reason)) }
    finally { setBusy(false) }
  }
  return <section aria-label="GitHub webhook notifications">
    <h4>GitHub notifications</h4>
    <p>After saving automatic remote checks, enable notifications for that GitHub remote. Push notifications request a fresh check; they never overwrite the editor. Periodic checks still run.</p>
    {error && <p role="alert">{error}</p>}
    {hook && <>
      <p>Status: {hook.enabled ? 'Enabled' : 'Disabled'}{hook.repository ? ` · ${hook.repository}` : ''}</p>
      {hook.enabled && hook.path && <>
        <label className="native-git-field">Payload URL<input className="form-control" readOnly value={new URL(hook.path, window.location.origin).href} /></label>
        <p>In the repository’s GitHub Settings → Webhooks, use this URL, application/json, and push events. GitHub must be able to reach the server over public HTTPS; localhost is not reachable.</p>
        {hook.secret && <label className="native-git-field">Secret (shown once; save it in GitHub)<input className="form-control" type="password" autoComplete="off" readOnly value={hook.secret} onFocus={event => event.target.select()} /></label>}
        <p>Last notification: {hook.lastReceivedAt ? formatGitDate(hook.lastReceivedAt) : 'None received'}</p>
      </>}
      <button type="button" className="btn btn-default" disabled={busy} onClick={() => void save(true)}>{hook.enabled ? 'Rotate webhook secret and URL' : 'Enable GitHub notifications'}</button>{' '}
      {hook.enabled && <button type="button" className="btn btn-default" disabled={busy} onClick={() => void save(false)}>Disable GitHub notifications</button>}
    </>}
  </section>
}
