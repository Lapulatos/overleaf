import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Modal } from 'react-bootstrap'
import { gitApi, errorMessage, type GitApi } from './api'
import './source-control.css'
type Policy = { mode: 'read-only' | 'workspace-write' | 'auto-review' | 'full-access'; directories: string[] }
const initial: Policy = { mode: 'workspace-write', directories: [] }
const values = new Map<string, Policy>(), listeners = new Set<() => void>()
function update(key: string, value: Policy) { if (JSON.stringify(values.get(key) || initial) === JSON.stringify(value)) return; values.set(key, value); listeners.forEach(fn => fn()) }
export function useAccessPolicy(api: GitApi) {
 const key = api.projectId || 'fixture'
 const value = useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, () => values.get(key) || initial)
 useEffect(() => { let active = true; void api.command({ command: 'accessPolicy' }).then(result => { const policy = result.result as Policy; if (active && policy?.mode) update(key, policy) }).catch(() => {}); return () => { active = false } }, [api, key])
 return { policy: value, setPolicy: (value: Policy) => update(key, value) }
}
export default function AccessMode({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
 const api = useMemo(() => gitApi(projectId), [projectId]), { policy, setPolicy } = useAccessPolicy(api)
 const [open, setOpen] = useState(false), [mode, setMode] = useState<Policy['mode']>('workspace-write'), [error, setError] = useState(''), [busy, setBusy] = useState(false)
 const labels = { 'read-only': 'Read Only', 'workspace-write': 'Ask for approval', 'auto-review': 'Approve for me', 'full-access': 'Full Access' }
 return <><button type="button" className="paper-access-mode" disabled={disabled} title="Permissions shared by Paper Assistant and Git" onClick={() => { setMode(policy.mode); setError(''); setOpen(true) }}>{labels[policy.mode]} ▾</button>
 <Modal show={open} onHide={() => { if (!busy) setOpen(false) }} aria-label="Paper Assistant permissions"><Modal.Header closeButton><Modal.Title>Paper Assistant permissions</Modal.Title></Modal.Header><Modal.Body>
 <p>Applies to repository operations and terminal sessions. Changing modes closes the current terminal session. Shells run in a dedicated Docker container, never macOS. No host directories or Docker socket are mounted; shell network access is disabled. Git metadata remains protected; use Source Control to stage and commit.</p>
 <label className="native-git-ref-choice"><input type="radio" name="access-mode" checked={mode==='read-only'} onChange={() => setMode('read-only')} />Read Only — inspect repository files; writes and network access are blocked.</label>
 <label className="native-git-ref-choice"><input type="radio" name="access-mode" checked={mode==='workspace-write'} onChange={() => setMode('workspace-write')} />Ask for approval — read and edit repository files; access outside the repository and network access are blocked.</label>
 <label className="native-git-ref-choice"><input type="radio" name="access-mode" checked={mode==='auto-review'} onChange={() => setMode('auto-review')} />Approve for me — automatically run allowlisted read-only commands; ask before other shell commands. Each command starts in the repository directory.</label>
 <label className="native-git-ref-choice"><input type="radio" name="access-mode" checked={mode==='full-access'} onChange={() => setMode('full-access')} />Full Access — write throughout the dedicated shell container and this repository without command approval. Container-only files are temporary; other projects and host systems are inaccessible.</label>
 {error && <p role="alert">{error}</p>}</Modal.Body><Modal.Footer><button className="btn btn-default" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { const result = await api.command({command:'setAccessPolicy',mode,directories:[]}); setPolicy(result.result as Policy); setOpen(false) } catch(error) { setError(errorMessage(error)) } finally { setBusy(false) } }}>Apply mode</button></Modal.Footer></Modal></>
}
