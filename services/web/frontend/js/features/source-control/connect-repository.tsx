import { useState } from 'react'
import type { GitCommand } from './api'

export default function ConnectRepository({ busy, connect }: { busy: boolean; connect: (command: GitCommand) => Promise<unknown> }) {
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const paired = !!username.trim() === !!token
  return <form className="native-git-connect-form" onSubmit={event => {
    event.preventDefault()
    if (!paired) return
    void connect({ command: 'connect', url: url.trim(), ...(branch.trim() ? { branch: branch.trim() } : {}),
      ...(token ? { username: username.trim(), token } : {}) })
  }}>
    <h4>Connect an existing repository</h4>
    <p>Clone its Git history. Your current project files stay unchanged and appear as working-tree differences.</p>
    <label className="native-git-field">Repository URL<input className="form-control" type="url" required placeholder="https://github.com/owner/repository.git" value={url} disabled={busy} onChange={event => setUrl(event.target.value)} /></label>
    <label className="native-git-field">Branch (optional)<input className="form-control" placeholder="Repository default branch" value={branch} disabled={busy} onChange={event => setBranch(event.target.value)} /></label>
    <label className="native-git-field">Username (private repository)<input className="form-control" autoComplete="off" value={username} disabled={busy} onChange={event => setUsername(event.target.value)} /></label>
    <label className="native-git-field">Access token<input className="form-control" type="password" autoComplete="new-password" value={token} disabled={busy} onChange={event => setToken(event.target.value)} /></label>
    {!paired && <p role="status">Enter both username and token for authenticated access.</p>}
    <button type="submit" className="btn btn-primary" disabled={busy || !url.trim() || !paired}>Connect repository</button>
  </form>
}
