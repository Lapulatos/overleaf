import { useEffect, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { errorMessage, type GitApi } from './api'

type Remote = { name: string; refs: { fetch: string; push: string } }
export default function RemoteSettings({ api, onClose }: { api: GitApi; onClose: () => void }) {
  const [remotes, setRemotes] = useState<Remote[]>([])
  const [remote, setRemote] = useState('')
  const [target, setTarget] = useState<'fetch' | 'push'>('fetch')
  const destination = target === 'push' ? {target} : {}
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [removing, setRemoving] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.command({ command: 'remotes' }).then(value => {
      if (!active) return
      const list = (Array.isArray(value.result) ? value.result : []) as Remote[]
      setRemotes(list); setRemote(list[0]?.name || '')
    }).catch(error => { if (active) setError(errorMessage(error)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api])
  useEffect(() => {
    if (!remote) return
    let active = true
    setLoading(true); setToken(''); setConfigured(false); setUsername(''); setError('')
    api.command({ command: 'credentialStatus', remote, ...destination }).then(value => {
      if (!active) return
      const result = value.result as { configured: boolean; username: string }
      setConfigured(result.configured); setUsername(result.username)
    }).catch(error => { if (active) setError(errorMessage(error)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, remote, target])
  const removeRemote = async () => {
    const selected = remotes.find(item => item.name === remote)
    if (!selected) return
    setBusy(true); setError('')
    try {
      await api.command({ command: 'removeRemote', name: selected.name, expectedUrl: selected.refs.fetch })
      const remaining = remotes.filter(item => item.name !== selected.name)
      setRemotes(remaining); setRemote(remaining[0]?.name || ''); setTarget('fetch')
      setRemoving(false); setToken(''); setConfigured(false); setUsername('')
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const update = async (remove: boolean) => {
    setBusy(true); setError('')
    try {
      await api.command(remove ? { command: 'removeCredential', remote, ...destination } : { command: 'saveCredential', remote, username, token, ...destination })
      setConfigured(!remove); setToken('')
      if (remove) setUsername('')
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <Modal show onHide={() => { if (!busy) onClose() }} aria-label="Repository settings">
    <Modal.Header closeButton><Modal.Title>Repository settings</Modal.Title></Modal.Header>
    <Modal.Body>
      {error && <p role="alert" className="native-git-error">{error}</p>}
      {!loading && !remotes.length && <p>No remote configured. Add a remote from Repository actions.</p>}
      {!!remotes.length && <>
        <label className="native-git-field">Remote<select className="form-control" value={remote} disabled={busy || loading} onChange={event => { setRemote(event.target.value); setTarget('fetch'); setRemoving(false) }}>
          {remotes.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
        </select></label>
        {remotes.find(item => item.name === remote)?.refs.fetch !== remotes.find(item => item.name === remote)?.refs.push && <label className="native-git-field">Credential destination<select className="form-control" value={target} disabled={busy || loading} onChange={event => setTarget(event.target.value as 'fetch' | 'push')}><option value="fetch">Fetch / Pull</option><option value="push">Push / Publish</option></select></label>}
        <p className="native-git-remote-url">{remotes.find(item => item.name === remote)?.refs[target]}</p>
        <p>Private token · This account, project and repository only.</p>
        <form onSubmit={event => { event.preventDefault(); void update(false) }}>
          <label className="native-git-field">Username<input className="form-control" autoComplete="off" value={username} disabled={busy || loading} onChange={event => setUsername(event.target.value)} /></label>
          <label className="native-git-field">Repository access token<input className="form-control" type="password" autoComplete="new-password" value={token} placeholder={configured ? '••••••••••••' : 'Access token'} disabled={busy || loading} onChange={event => setToken(event.target.value)} /></label>
          {configured && <p role="status">Token configured</p>}
          <div className="native-git-operation"><button type="submit" className="btn btn-primary" disabled={busy || loading || !username.trim() || !token}>{configured ? 'Replace token' : 'Save token'}</button>
            {configured && <button type="button" className="btn btn-default" disabled={busy || loading} onClick={() => update(true)}>Remove token</button>}</div>
        </form>
        <hr />
        {removing ? <div>
          <p>Remove remote <strong>{remote}</strong> ({remotes.find(item => item.name === remote)?.refs.fetch})? This removes its remote-tracking references. Local branches, commits and project files stay intact.</p>
          <div className="native-git-operation">
            <button type="button" className="btn btn-danger" disabled={busy || loading} onClick={removeRemote}>Confirm remove remote</button>
            <button type="button" className="btn btn-default" disabled={busy} onClick={() => setRemoving(false)}>Cancel</button>
          </div>
        </div> : <button type="button" className="btn btn-default" disabled={busy || loading} onClick={() => setRemoving(true)}>Remove remote…</button>}
      </>}
    </Modal.Body>
  </Modal>
}
