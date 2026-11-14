import {useState} from 'react'
import {postJSON} from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import {message} from '@/features/source-editor/extensions/writing-assist/agent-task-result'
export default function RuntimeSshEnrollment({onDone,onCancel}:{onDone:(notice:string)=>void;onCancel:()=>void}){
 const [name,setName]=useState(''),[host,setHost]=useState(''),[port,setPort]=useState('22'),[username,setUsername]=useState(''),[auth,setAuth]=useState('server-key'),[credential,setCredential]=useState(''),[passphrase,setPassphrase]=useState(''),[fingerprint,setFingerprint]=useState(''),[verified,setVerified]=useState(false),[runner,setRunner]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const ssh=()=>({host,port:Number(port),username,auth,fingerprint,...(auth==='private-key'?{privateKey:credential,passphrase}:auth==='password'?{password:credential}:{})})
 const reset=()=>{setVerified(false);setFingerprint('')}
 async function probe(){setBusy(true);setError('');try{const r=await postJSON<{fingerprint:string}>('/writing-assist/runtime-nodes/ssh/probe',{body:{ssh:{host,port:Number(port),username}}});setFingerprint(r.fingerprint);setVerified(false)}catch(e){setError(message(e))}finally{setBusy(false)}}
 async function add(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const r=await postJSON<{node:{id:string}}>('/writing-assist/runtime-nodes/ssh/add',{body:{name,ssh:ssh(),verified}});setCredential('');setPassphrase('');if(runner){try{await postJSON(`/writing-assist/runtime-nodes/${r.node.id}/ssh-runner`,{body:{}});onDone('SSH connected · GitLab Runner registered through the SSH tunnel.')}catch(e){onDone('SSH node added. Runner setup needs attention: '+message(e))}}else onDone('SSH node added. Open Terminal to use this machine.')}catch(e){setError(message(e))}finally{setBusy(false)}}
 return <form className="runtime-enroll runtime-ssh-enrollment" aria-label="Add SSH node" onSubmit={add}>
 <p className="runtime-muted">Overleaf → FRP / SSH → node. No inbound connection to Overleaf required.</p>
 <label>Machine name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. V100 server"/></label>
 <div className="runtime-ssh-address"><label>SSH / FRP host<input required value={host} onChange={e=>{setHost(e.target.value);reset()}} placeholder="frp.example.com" autoComplete="off"/></label><label>Port<input required type="number" min={1} max={65535} value={port} onChange={e=>{setPort(e.target.value);reset()}}/></label></div>
 <label>SSH username<input required value={username} onChange={e=>{setUsername(e.target.value);reset()}} autoComplete="off"/></label>
 <label>Authentication<select value={auth} onChange={e=>{setAuth(e.target.value);setCredential('')}}><option value="server-key">Configured server key</option><option value="private-key">Private key</option><option value="password">Password</option></select></label>
 {auth==='private-key'?<><label>Private key<textarea required spellCheck={false} rows={4} value={credential} onChange={e=>setCredential(e.target.value)} autoComplete="off"/></label><label>Key passphrase (optional)<input type="password" value={passphrase} onChange={e=>setPassphrase(e.target.value)} autoComplete="new-password"/></label></>:auth==='password'?<label>SSH password<input required type="password" value={credential} onChange={e=>setCredential(e.target.value)} autoComplete="new-password"/></label>:null}
 <div className="runtime-ssh-fingerprint"><button type="button" disabled={busy||!host||!username} onClick={()=>void probe()}><MaterialIcon type="fingerprint"/>Read host fingerprint</button>{fingerprint&&<><code>{fingerprint}</code><label className="runtime-ssh-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>I verified this fingerprint with the server owner.</label></>}</div>
 <label className="runtime-ssh-check"><input type="checkbox" checked={runner} onChange={e=>setRunner(e.target.checked)}/>Register GitLab Runner through SSH tunnel</label>
 <small>Requires Python 3.8+, tmux{runner?' and GitLab Runner':''}. {runner?'SSH reverse forwarding must be allowed. A dedicated Runner is started for this node.':'Uses the SSH account permissions.'}</small>
 {error&&<p role="alert" className="runtime-alert">{error}</p>}
 <div className="runtime-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className="runtime-primary" disabled={busy||!verified||!name.trim()}><MaterialIcon type="add_link"/>{busy?'Connecting…':'Connect node'}</button></div>
 </form>
}
