import RuntimeNodeTerminals from './runtime-node-terminals'
import RuntimeAnsiOutput from './runtime-ansi-output'
import { useEffect, useRef, useState } from 'react'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import { message } from '@/features/source-editor/extensions/writing-assist/agent-task-result'
type Task={id:number;kind:string;state:string;startedAt?:string;finishedAt?:string;createdAt:string;exitCode?:number;failureReason?:string;output?:string}
const active=(task:Task)=>['queued','running','canceling'].includes(task.state)
export default function RuntimeNodeTasks({node,onBack}:{node:{id:string;name:string;status:string;protocol?:string;executionSettings?:{mode:string}};onBack:()=>void}) {
 const [tab,setTab]=useState(node.protocol==='ssh'?'terminal':'tasks'),[tasks,setTasks]=useState<Task[]>([]),[selected,setSelected]=useState<number|null>(null),[detail,setDetail]=useState<Task|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[follow,setFollow]=useState(true)
 const output=useRef<HTMLPreElement>(null),api=`/writing-assist/runtime-nodes/${node.id}/tasks`
 useEffect(()=>{if(node.protocol==='ssh')return;let current=true;async function refresh(){try{const result=await getJSON<{tasks:Task[]}>(api);if(!current)return;setTasks(result.tasks);setError('');if(selected===null&&result.tasks.length)setSelected(result.tasks[0].id);if(selected!==null){const data=await getJSON<Task>(`${api}/${selected}`);if(current)setDetail(data)}}catch(e){if(current)setError(message(e))}}void refresh();const timer=setInterval(()=>void refresh(),1500);return()=>{current=false;clearInterval(timer)}},[api,selected])
 useEffect(()=>{if(follow&&output.current)output.current.scrollTop=output.current.scrollHeight},[detail?.output,follow])
 async function run(){setBusy(true);setError('');try{const task=await postJSON<Task>(api,{body:{kind:'diagnostic'}});setDetail(task);setTasks(previous=>[task,...previous]);setSelected(task.id);setFollow(true)}catch(e){setError(message(e))}finally{setBusy(false)}}
 async function cancel(){if(!detail)return;setBusy(true);try{setDetail(await postJSON<Task>(`${api}/${detail.id}/cancel`,{body:{}}))}catch(e){setError(message(e))}finally{setBusy(false)}}
 return <section className="runtime-node-workspace" aria-label={`Tasks and terminals for ${node.name}`}>
  <header><button aria-label="Back to nodes" title="Back to nodes" onClick={onBack}><MaterialIcon type="arrow_back"/></button><div className="runtime-workspace-title"><strong title={node.name}>{node.name}</strong><small>Tasks & terminals</small></div></header>
  <div className="runtime-workspace-tabs" role="tablist" aria-label="Node activity"><button role="tab" aria-selected={tab==='tasks'} onClick={()=>setTab('tasks')}><MaterialIcon type="list_alt"/>Tasks</button><button role="tab" aria-selected={tab==='terminal'} onClick={()=>setTab('terminal')}><MaterialIcon type="terminal"/>Terminal</button></div>
  {tab==='terminal'?<div role="tabpanel"><RuntimeNodeTerminals nodeId={node.id} nodeName={node.name}/></div>:<div role="tabpanel">
   <div className="runtime-task-toolbar"><span>Last 50 tasks</span><button className="runtime-primary" disabled={busy||(node.status!=='online'&&node.executionSettings?.mode!=='on-demand')||node.status==='revoked'||node.protocol==='ssh'} onClick={()=>void run()}><MaterialIcon type="play_arrow"/>Run test</button></div>
   <p className="runtime-muted">Checks this machine and streams output. No project files are changed.</p>
   {error&&<p role="alert" className="runtime-alert">{error}</p>}
   {tasks.length?<label className="runtime-task-picker">Task<select aria-label="Select node task" value={selected??''} onChange={e=>{setSelected(Number(e.target.value));setDetail(null)}}>{tasks.map(t=><option key={t.id} value={t.id}>{t.kind} · {t.state} · {new Date(t.createdAt).toLocaleTimeString()}</option>)}</select></label>:<div className="runtime-empty">{node.protocol==='ssh'?'Use Terminal for SSH commands. Register Runner to enable queued tasks.':'No tasks yet. Run a test to check this node.'}</div>}
   {detail&&<div className="runtime-task-detail"><div className="runtime-task-state"><span role="status">{detail.state}</span>{detail.exitCode!=null&&<span>Exit {detail.exitCode}</span>}{active(detail)&&<button disabled={busy||detail.state==='canceling'} onClick={()=>void cancel()}><MaterialIcon type="stop"/>Stop</button>}</div><small>{detail.startedAt?`Started ${new Date(detail.startedAt).toLocaleString()}`:'Waiting for Runner'}{detail.finishedAt?` · Finished ${new Date(detail.finishedAt).toLocaleTimeString()}`:''}</small>{detail.failureReason&&<small>{detail.failureReason}</small>}<div className="runtime-output-heading"><strong>{active(detail)?'Live output':'Output'}</strong><label><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>Follow</label></div><RuntimeAnsiOutput ref={output} value={detail.output||''}/><small>Read-only task log · stdout and stderr · refreshes every 1.5s</small></div>}
  </div>}
 </section>
}
