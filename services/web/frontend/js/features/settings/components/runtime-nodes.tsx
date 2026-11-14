import RuntimeNodeSettings from './runtime-node-settings'
import RuntimeSshEnrollment from './runtime-ssh-enrollment'
import RuntimeNodeTasks from './runtime-node-tasks'
import { useCallback, useEffect, useState } from 'react'
import { getJSON, postJSON, deleteJSON } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import { message } from '@/features/source-editor/extensions/writing-assist/agent-task-result'
import './runtime-nodes.css'

type Gpu = {name:string;utilization:number|null;memoryUsed:number|null;memoryTotal:number|null}
type Usage = {cpuPercent:number|null;sampleSeconds:number;gpu:{status:string;reason:string;devices:Gpu[]}}
type Resources = { cpuTopology?:{sockets:number|null;cores:number|null;threads:number}; usage?:Usage; scope: 'host'|'container'; cpuCount:number; memoryTotal:number; memoryAvailable:number|null; diskTotal:number|null; diskFree:number|null; load1:number|null; docker:{available:boolean;cpuCount:number|null;memoryTotal:number|null;version:string|null}; gpu:string }
type Node = {executionSettings?:{mode:string;idleMinutes:number};runnerPowerState?:string;runnerPowerError?:string;connections?:{runner:string;ssh:string;monitor:string};sshConfigured?:boolean;sshEndpoint?:{host:string;port:number;username:string};sshTunnel?:string;protocol?:string;runnerId?:number;systemId?:string;runnerInfo?:{version?:string};runnerLastSeenAt?:string; id:string; name:string; status:'pending'|'online'|'offline'|'revoked'|'expired'; lastSeenAt?:string; enrollmentExpiresAt:string; identity?:{hostname:string;platform:string;arch:string}; resources?:Resources }
type Listing = {canManage:boolean;nodes:Node[]}
const api='/writing-assist/runtime-nodes'
const bytes=(value:number|null|undefined)=>value==null?'Not reported':`${(value/1024**3).toFixed(1)} GiB`
function LoadMeter({label,value,detail,stale=false}:{label:string;value:number|null|undefined;detail:string;stale?:boolean}) {
 return <div className={`runtime-load ${stale?'is-stale':''}`}><div><span>{label}</span><strong>{value==null?'Unavailable':`${value.toFixed(1)}%`}</strong></div><progress aria-label={label+' utilization'} max={100} value={value??0} data-unavailable={value==null}/><small>{detail}</small></div>
}
function ResourceSummary({label,icon,value,headline,detail,children,stale}:{label:string;icon:string;value:number|null|undefined;headline:string;detail:string;children:React.ReactNode;stale:boolean}) {
 return <details className={`runtime-resource ${stale?'is-stale':''}`} onDoubleClick={e=>{e.stopPropagation();e.currentTarget.open=true}}>
  <summary title={`Show ${label} details`}><MaterialIcon type={icon}/><span className="runtime-resource-copy"><span className="runtime-resource-title"><strong>{label}</strong><span>{headline}</span></span><small>{detail}</small><progress aria-label={`${label} utilization`} max={100} value={value??0} data-unavailable={value==null}/></span><MaterialIcon type="expand_more"/></summary>
  <div className="runtime-resource-details">{children}</div>
 </details>
}
function NodeLoad({node,failed}:{node:Node;failed:boolean}) {
 const r=node.resources;if(!r)return null
 const stale=failed||!node.lastSeenAt||Date.now()-new Date(node.lastSeenAt).getTime()>15000
 const memory=r.memoryAvailable==null||!r.memoryTotal?null:100*(r.memoryTotal-r.memoryAvailable)/r.memoryTotal
 const devices=r.usage?.gpu.devices||[], measured=devices.filter(g=>g.utilization!=null)
 const average=measured.length?measured.reduce((sum,g)=>sum+g.utilization!,0)/measured.length:null
 const peak=measured.length?Math.max(...measured.map(g=>g.utilization!)):null
 const active=measured.filter(g=>g.utilization!>0).length
 const percent=(v:number|null|undefined)=>v==null?'Unavailable':`${v.toFixed(1)}%`
 const topology=r.cpuTopology
 const cpuDetail=[topology?.sockets!=null?`${topology.sockets} sockets`:null,topology?.cores!=null?`${topology.cores} cores`:null,`${topology?.threads??r.cpuCount} threads`].filter(Boolean).join(' · ')
 const gpuDetail=devices.length?`${devices.length} GPUs · ${active} active${peak==null?'':` · peak ${percent(peak)}`}${measured.length<devices.length?` · ${measured.length}/${devices.length} reporting`:''}`:(r.usage?.gpu.reason||'GPU counters unavailable')
 return <div className="runtime-loads"><div className="runtime-load-heading"><span>{stale?'Last received sample':'Live load'}</span><time dateTime={node.lastSeenAt}>{node.lastSeenAt?new Date(node.lastSeenAt).toLocaleTimeString():'—'}</time></div>
 <ResourceSummary label="CPU" icon="memory" value={r.usage?.cpuPercent} headline={percent(r.usage?.cpuPercent)} detail={cpuDetail} stale={stale}><dl><dt>CPU sockets</dt><dd>{topology?.sockets??'Not reported'}</dd><dt>Physical cores</dt><dd>{topology?.cores??'Not reported'}</dd><dt>Logical threads</dt><dd>{topology?.threads??r.cpuCount}</dd><dt>Sampling interval</dt><dd>{r.usage?.sampleSeconds??'—'} s</dd></dl></ResourceSummary>
 <ResourceSummary label="Memory" icon="storage" value={memory} headline={memory==null?'Unavailable':`${bytes(r.memoryTotal-r.memoryAvailable!)} / ${bytes(r.memoryTotal)}`} detail={`${percent(memory)} used`} stale={stale}><dl><dt>Total</dt><dd>{bytes(r.memoryTotal)}</dd><dt>Available</dt><dd>{bytes(r.memoryAvailable)}</dd><dt>Used</dt><dd>{r.memoryAvailable==null?'Not reported':bytes(r.memoryTotal-r.memoryAvailable)}</dd></dl></ResourceSummary>
 <ResourceSummary label="GPU" icon="developer_board" value={average} headline={average==null?'Unavailable':`${percent(average)} ${measured.length===devices.length?'average':'reported average'}`} detail={gpuDetail} stale={stale}>
 {devices.length?devices.map((gpu,i)=><LoadMeter key={i} label={`GPU ${i} · ${gpu.name}`} value={gpu.utilization} detail={gpu.memoryUsed==null?'VRAM usage unavailable':gpu.memoryTotal==null?`${bytes(gpu.memoryUsed)} shared memory`:`${bytes(gpu.memoryUsed)} / ${bytes(gpu.memoryTotal)} VRAM`} stale={stale}/>):<p className="runtime-muted">{r.usage?.gpu.reason||'GPU counters unavailable'}</p>}
 </ResourceSummary></div>
}

const labels={pending:'Awaiting connection',online:'Online',offline:'Offline',revoked:'Revoked',expired:'Registration expired'}
function score(value:string, query:string) {
 const text=value.toLowerCase(), needle=query.trim().toLowerCase()
 if(!needle)return 1
 if(text.includes(needle))return 1000-text.indexOf(needle)
 let cursor=0;for(const char of needle){cursor=text.indexOf(char,cursor);if(cursor<0)return 0;cursor++}return 1
}
export default function RuntimeNodes({compact=false}:{compact?:boolean}) {
 const [listing,setListing]=useState<Listing|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [settingsNode,setSettingsNode]=useState<string|null>(null)
 const [opened,setOpened]=useState<string|null>(null)
 const [method,setMethod]=useState<'ssh'|'runner'>('ssh')
 const [runnerURL,setRunnerURL]=useState(/^(localhost|127\.)/.test(window.location.hostname)?'':window.location.origin)
 const [query,setQuery]=useState(''),[adding,setAdding]=useState(false),[name,setName]=useState('')
 const [enrollment,setEnrollment]=useState<{token:string;name:string;expires:string;id:string}|null>(null)
 const [discard,setDiscard]=useState<string|null>(null)
 const [revoke,setRevoke]=useState<string|null>(null),[notice,setNotice]=useState('')
 const refresh=useCallback(async()=>{try{setListing(await getJSON<Listing>(api));setError('')}catch(e){setError(message(e))}},[])
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh()},5000);return()=>clearInterval(timer)},[refresh])
 async function add(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const result=await postJSON<{node:Node;enrollmentToken:string}>(api,{body:{name}});setEnrollment({token:result.enrollmentToken,name:result.node.name,expires:result.node.enrollmentExpiresAt,id:result.node.id});setAdding(false);setName('');await refresh()}catch(e){setError(message(e))}finally{setBusy(false)}}
 async function deleteRecord(id:string){setBusy(true);try{await postJSON(`${api}/${id}/remove`,{body:{}});setDiscard(null);await refresh()}catch(e){setError(message(e))}finally{setBusy(false)}}
 async function remove(id:string){setBusy(true);try{await deleteJSON(`${api}/${id}`);setRevoke(null);await refresh()}catch(e){setError(message(e))}finally{setBusy(false)}}
 const nodes=(listing?.nodes||[]).map(node=>({node,rank:score(`${node.name} ${node.identity?.hostname||''} ${node.identity?.platform||''}`,query)})).filter(v=>v.rank>0).sort((a,b)=>b.rank-a.rank)
 const online=listing?.nodes.filter(n=>n.status==='online').length||0
 const openedNode=listing?.nodes.find(n=>n.id===opened)
 if(openedNode)return <section className="runtime-nodes"><RuntimeNodeTasks key={openedNode.id} node={openedNode} onBack={()=>setOpened(null)}/></section>
 return <section className="runtime-nodes" aria-label="Runtime nodes">
  <header><div>{!compact&&<h3>Runtime environments</h3>}<p>CPU, memory and GPU load · refreshes every 5s.</p></div><button type="button" title="Refresh nodes" aria-label="Refresh nodes" onClick={()=>void refresh()}><MaterialIcon type="refresh"/></button></header>
  <div className="runtime-toolbar"><label><MaterialIcon type="search"/><input aria-label="Search runtime nodes" placeholder="Find a machine…" value={query} onChange={e=>setQuery(e.target.value)}/></label>{listing?.canManage&&<button className="runtime-primary" type="button" onClick={()=>{setAdding(!adding);setEnrollment(null)}}><MaterialIcon type="add"/>Register node</button>}</div>
  <div className="runtime-summary"><span className="runtime-dot"/>{online} online <span>· {listing?.nodes.length||0} registered</span></div>
  {error&&<div className="runtime-alert" role="alert">{error} <button onClick={()=>void refresh()}>Retry</button></div>}
  {!listing&&!error&&<p role="status">Loading machines…</p>}
  {listing&&!listing.canManage&&<p className="runtime-muted">Only the host administrator can register or revoke machines.</p>}
  {adding&&<div className="runtime-workspace-tabs" role="tablist" aria-label="Node connection method"><button role="tab" aria-selected={method==='ssh'} onClick={()=>setMethod('ssh')}><MaterialIcon type="terminal"/>SSH / FRP</button><button role="tab" aria-selected={method==='runner'} onClick={()=>setMethod('runner')}><MaterialIcon type="sync_alt"/>Runner directly</button></div>}
  {adding&&method==='ssh'&&<RuntimeSshEnrollment onCancel={()=>setAdding(false)} onDone={notice=>{setAdding(false);setNotice(notice);void refresh()}}/>}
  {adding&&method==='runner'&&<form className="runtime-enroll" onSubmit={add}><label htmlFor="runtime-node-name">Machine name</label><input id="runtime-node-name" autoFocus maxLength={100} placeholder="e.g. Research workstation" value={name} onChange={e=>setName(e.target.value)}/><div className="runtime-actions"><button type="button" onClick={()=>setAdding(false)}>Cancel</button><button className="runtime-primary" disabled={busy||!name.trim()} type="submit">Create registration</button></div></form>}
  {enrollment&&<div className="runtime-enroll" aria-label="Node registration"><strong>Connect {enrollment.name}</strong><p>Register with the official GitLab Runner client. Paste the authentication token below when prompted.</p><a href="https://docs.gitlab.com/runner/install/" target="_blank" rel="noreferrer">Install official GitLab Runner</a><label>Overleaf address reachable from the node<input placeholder="https://overleaf.example.com" value={runnerURL} onChange={e=>setRunnerURL(e.target.value.replace(/[^A-Za-z0-9:./_-]/g,''))}/></label><pre>{`gitlab-runner register --config ~/.gitlab-runner/overleaf-${enrollment.id}/config.toml --url ${runnerURL||'https://OVERLEAF_HOST'} --executor shell\ngitlab-runner run --config ~/.gitlab-runner/overleaf-${enrollment.id}/config.toml`}</pre><label htmlFor="runtime-token">Runner token · initial registration expires {new Date(enrollment.expires).toLocaleTimeString()}</label><input id="runtime-token" readOnly value={enrollment.token} onFocus={e=>e.target.select()}/><div className="runtime-actions"><button onClick={()=>setEnrollment(null)}>Done</button><button onClick={async()=>{try{await navigator.clipboard.writeText(enrollment.token);setNotice('Token copied.')}catch{setNotice('Select the token and copy it.')}}}><MaterialIcon type="content_copy"/>Copy token</button></div><small>Use this server’s reachable HTTPS address on remote machines. One token binds to one Runner manager.</small><details><summary>Attach resource monitoring</summary><a href="/runtime-nodes/agent.py" download="overleaf-node.py">Download monitor · Python 3.11+</a><pre>{`python3 overleaf-node.py --server ${runnerURL||'https://OVERLEAF_HOST'} --runner-config ~/.gitlab-runner/overleaf-${enrollment.id}/config.toml --state ~/.gitlab-runner/overleaf-${enrollment.id}/metrics.json`}</pre><small>Uses the same Runner identity. Install psutil for macOS CPU and memory metrics.</small></details></div>}
  {notice&&<p role="status">{notice}</p>}
  {listing&&!nodes.length&&<div className="runtime-empty"><MaterialIcon type="computer"/><strong>{query?'No matching machines':'No machines registered'}</strong><p>{query?'Try a shorter name.':'Register this host or another machine to see its resources here.'}</p></div>}
  <div className="runtime-list">{nodes.map(({node})=><article key={node.id} aria-label={node.name} className={`runtime-card is-${node.status}`} onDoubleClick={e=>{if(!(e.target as HTMLElement).closest('button,a,input,summary,details'))setOpened(node.id)}}>
   <div className="runtime-card-heading"><MaterialIcon type="computer"/><div><strong title={node.name}>{node.name}</strong><small>{node.protocol==='gitlab-runner'?`GitLab Runner${node.runnerInfo?.version?' · '+node.runnerInfo.version:''}`:node.protocol==='ssh'?'SSH · direct connection':'Legacy monitor'}{node.sshConfigured&&node.protocol==='gitlab-runner'?' · SSH tunnel':''}</small></div><span className={`runtime-status ${node.status}`}>{node.status==='revoked'?'Revoked':node.executionSettings?.mode==='on-demand'&&node.runnerPowerState==='standby'?'Standby':node.runnerPowerState==='waking'?'Waking…':node.runnerPowerState==='stopping'?'Stopping…':node.runnerPowerState==='error'?'Needs attention':node.status==='offline'&&node.connections?.ssh==='online'?'Partial connection':labels[node.status]}</span>{listing?.canManage&&node.status!=='revoked'&&<button className="runtime-settings-button" aria-label={`Settings for ${node.name}`} title="Node settings" onClick={()=>setSettingsNode(settingsNode===node.id?null:node.id)}><MaterialIcon type="tune"/></button>}</div>
   {settingsNode===node.id&&<RuntimeNodeSettings id={node.id} onSaved={()=>void refresh()} onClose={()=>setSettingsNode(null)}/>}
   {node.runnerPowerError&&<p role="status" className="runtime-muted">{node.runnerPowerError}</p>}
   {node.connections&&<div className="runtime-connections" aria-label="Connection status">{([{key:'runner',label:'Runner',icon:'sync_alt'},{key:'ssh',label:'SSH',icon:'terminal'},{key:'monitor',label:'Monitoring',icon:'monitoring'}] as const).map(({key,label,icon})=><span key={key} data-state={node.connections![key]} title={key==='runner'?'Runner task polling heartbeat':key==='ssh'?'SSH reachability checked independently':'Resource sample freshness'}><MaterialIcon type={icon}/>{label}<strong>{({'online':'Connected','offline':'Disconnected','not-configured':'Not configured','unknown':'Unknown','live':'Live','stale':'Stale','revoked':'Revoked','standby':'Standby'} as Record<string,string>)[node.connections![key]]}</strong></span>)}</div>}
   <NodeLoad node={node} failed={Boolean(error)}/>
   <button className="runtime-open-node" aria-label={`Open tasks and terminals for ${node.name}`} onClick={()=>setOpened(node.id)}><MaterialIcon type="terminal"/>Tasks & terminals<MaterialIcon type="chevron_right"/></button>
   <details><summary>Machine details</summary><dl>{node.sshEndpoint&&<><dt>SSH endpoint</dt><dd>{node.sshEndpoint.username}@{node.sshEndpoint.host}:{node.sshEndpoint.port}</dd><dt>Runner tunnel</dt><dd>{node.sshTunnel||'Not enabled'}</dd></>}<dt>Runner ID</dt><dd>{node.runnerId??'Not registered'}</dd><dt>Manager</dt><dd>{node.systemId||'Awaiting registration'}</dd><dt>Runner contact</dt><dd>{node.runnerLastSeenAt?new Date(node.runnerLastSeenAt).toLocaleString():'—'}</dd><dt>Reporter scope</dt><dd>{node.resources?.scope==='container'?'Container (not physical host)':node.resources?'Host':'Not connected'}</dd><dt>Hostname</dt><dd>{node.identity?.hostname||'—'}</dd><dt>Last heartbeat</dt><dd>{node.lastSeenAt?new Date(node.lastSeenAt).toLocaleString():'Not received'}</dd>{node.resources&&<><dt>Available memory</dt><dd>{bytes(node.resources.memoryAvailable)}</dd><dt>Disk free / total</dt><dd>{bytes(node.resources.diskFree)} / {bytes(node.resources.diskTotal)}</dd><dt>Load · 1 minute</dt><dd>{node.resources.load1?.toFixed(2)??'Not reported'}</dd><dt>Docker engine</dt><dd>{node.resources.docker.available?`${node.resources.docker.cpuCount} CPU · ${bytes(node.resources.docker.memoryTotal)} · v${node.resources.docker.version}`:'Not available to reporter'}</dd><dt>GPU monitoring</dt><dd>{node.resources.usage?.gpu.reason||'Reporter upgrade required'}</dd></>}</dl><p className="runtime-muted">Docker resources may belong to a virtual machine. Offline readings are the last received values.</p></details>
   {listing?.canManage&&node.status==='revoked'&&<footer>{discard===node.id?<><span>Delete this record? Machine files are kept.</span><button disabled={busy} onClick={()=>setDiscard(null)}>Cancel</button><button disabled={busy} onClick={()=>void deleteRecord(node.id)}>Delete record</button></>:<><button title="Delete node record" aria-label={`Delete record for ${node.name}`} onClick={()=>setDiscard(node.id)}><MaterialIcon type="delete"/></button><button onClick={()=>{setName(node.name);setAdding(true);setEnrollment(null);document.getElementById('runtime-node-name')?.focus()}}><MaterialIcon type="add"/>Register again</button></>}</footer>}
   {listing?.canManage&&node.sshConfigured&&node.protocol==='ssh'&&node.status!=='revoked'&&<button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await postJSON(`${api}/${node.id}/ssh-runner`,{body:{}});setNotice('Runner registered through SSH.');await refresh()}catch(e){setError(message(e))}finally{setBusy(false)}}}><MaterialIcon type="sync_alt"/>Register Runner through SSH</button>}
   {listing?.canManage&&node.status!=='revoked'&&<footer>{revoke===node.id?<><span>Revoke credentials? Reconnecting requires a new registration.</span><div className="runtime-actions"><button disabled={busy} onClick={()=>setRevoke(null)}>Cancel</button><button disabled={busy} onClick={()=>void remove(node.id)}>Revoke access</button></div></>:<button title={`Revoke ${node.name}`} aria-label={`Revoke ${node.name}`} onClick={()=>setRevoke(node.id)}><MaterialIcon type="link_off"/>Revoke</button>}</footer>}
  </article>)}</div>
 </section>
}
