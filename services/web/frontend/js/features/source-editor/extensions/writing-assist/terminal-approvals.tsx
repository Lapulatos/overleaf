import { useEffect,useState } from 'react'
import {getJSON,postJSON} from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
type Pending={id:string;kind:string;command?:string;reference?:string;source?:string;destination?:string;destinationPath?:string;paths?:string[]}
export default function TerminalApprovals({projectId}:{projectId:string}){
 const [items,setItems]=useState<Pending[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState('')
 const api=`/writing-assist/project/${projectId}/terminal-approvals`
 useEffect(()=>{let active=true;const refresh=()=>getJSON<Pending[]>(api).then(value=>{if(active)setItems(value)}).catch(()=>{});void refresh();const timer=setInterval(refresh,1500);return()=>{active=false;clearInterval(timer)}},[api])
 async function decide(id:string,accept:boolean){setBusy(id);setError('');try{const r=await postJSON<{state:string;error?:string}>(api+'/'+id,{body:{accept}});if(r.error)setError(r.error);setItems(old=>old.filter(i=>i.id!==id))}catch(e){setError(e instanceof Error?e.message:'Operation unavailable')}finally{setBusy('')}}
 if(!items.length&&!error)return null
 return <section className="paper-terminal-approvals" aria-label="Terminal operation approvals">{items.map(item=><article key={item.id}><strong><MaterialIcon type="terminal"/>{item.kind==='command'?'Run in Terminal':'Transfer files'}</strong><small>{item.reference||`${item.source} → ${item.destination}`}</small>{item.command?<pre>{item.command}</pre>:<><p>{item.paths?.join(', ')}</p><small>Destination: {item.destination==='project'?'terminal-results-'+item.id:item.destinationPath||'Session work directory'} · Existing files will not be replaced.</small></>}<div><button className="btn btn-secondary" disabled={!!busy} onClick={()=>void decide(item.id,false)}>Reject</button><button className="btn btn-primary" disabled={!!busy} onClick={()=>void decide(item.id,true)}><MaterialIcon type="play_arrow"/>Approve {item.kind==='command'?'command':'transfer'}</button></div></article>)}{error&&<p role="alert">{error}</p>}</section>
}
