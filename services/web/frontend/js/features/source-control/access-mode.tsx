import MaterialIcon from '@/shared/components/material-icon'
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
 <Modal className="native-git-dialog" show={open} onHide={() => { if (!busy) setOpen(false) }} aria-label="Paper Assistant permissions"><Modal.Header closeButton><Modal.Title>Paper Assistant permissions</Modal.Title></Modal.Header><Modal.Body>
 <p className="native-git-dialog-caption">Choose how Paper Assistant can work in this project.</p>
 <div className="native-git-permission-options">
 {([
  ['read-only','visibility','Read Only','Inspect files without changing them.'],
  ['workspace-write','approval','Ask for approval','Ask before Agent commands; allow project edits.'],
  ['auto-review','auto_awesome','Approve for me','Review Agent commands automatically; ask when needed.'],
  ['full-access','terminal','Full Access','Run without command approval; allow container writes.'],
 ] as const).map(([value,icon,label,description])=><label key={value} className={`native-git-permission-option${mode===value?' is-selected':''}`}>
  <input type="radio" name="access-mode" checked={mode===value} onChange={()=>setMode(value)}/><MaterialIcon type={icon}/><span><strong>{label}</strong><small>{description}</small></span>
 </label>)}
 </div>
 <p className="native-git-permission-status"><MaterialIcon type="wifi_off"/>Terminal network: Off <span>· System software installation: Limited</span></p>
 {mode!==policy.mode && !(mode==='workspace-write'&&policy.mode==='auto-review'||mode==='auto-review'&&policy.mode==='workspace-write') && <p role="status" className="native-git-permission-notice"><MaterialIcon type="info"/>Changing terminal access ends existing terminal sessions.</p>}
 {error && <p role="alert">{error}</p>}</Modal.Body><Modal.Footer><button className="btn btn-default" disabled={busy} onClick={() => setOpen(false)}><MaterialIcon type="close" />Cancel</button><button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { const result = await api.command({command:'setAccessPolicy',mode,directories:[]}); setPolicy(result.result as Policy); setOpen(false) } catch(error) { setError(errorMessage(error)) } finally { setBusy(false) } }}><MaterialIcon type="check" />Apply mode</button></Modal.Footer></Modal></>
}
