import {useEffect,useState} from 'react'
import {getJSON,postJSON} from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import {message} from '@/features/source-editor/extensions/writing-assist/agent-task-result'
type Configuration={mode:'always'|'on-demand';idleMinutes:number;limits:{enabled:boolean;cpu:number|null;memoryGiB:number|null;threads:number|null;gpuIds:number[];image:string}}
type Capabilities={runnerControl:boolean;docker:boolean;cpuLimit:boolean;memoryLimit:boolean;gpuRuntime:boolean;gpuCount:number;images:string[]}
export default function RuntimeNodeSettings({id,onSaved,onClose}:{id:string;onSaved:()=>void;onClose:()=>void}){
 const [settings,setSettings]=useState<Configuration|null>(null),[caps,setCaps]=useState<Capabilities|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false)
 const api=`/writing-assist/runtime-nodes/${id}/settings`
 async function load(){setError('');try{const r=await getJSON<{settings:Configuration;capabilities:Capabilities}>(api);setSettings(r.settings);setCaps(r.capabilities)}catch(e){setError(message(e))}}
 useEffect(()=>{void load()},[id])
 async function save(e:React.FormEvent){e.preventDefault();if(!settings)return;setBusy(true);setError('');try{await postJSON(api,{body:settings});setSaved(true);onSaved()}catch(e){setError(message(e))}finally{setBusy(false)}}
 function limit(key:'cpu'|'memoryGiB'|'threads',value:string){if(settings)setSettings({...settings,limits:{...settings.limits,[key]:value===''?null:Number(value)}});setSaved(false)}
 return <section className="runtime-node-settings" aria-label="Node execution settings" onDoubleClick={e=>e.stopPropagation()}>
 <div className="runtime-settings-heading"><strong><MaterialIcon type="tune"/>Runner settings</strong><button type="button" title="Close settings" aria-label="Close settings" onClick={onClose}><MaterialIcon type="close"/></button></div>
 {error&&<p role="alert" className="runtime-alert">{error} {!settings&&<button onClick={()=>void load()}>Retry</button>}</p>}
 {!settings||!caps?<p role="status">Checking node capabilities…</p>:<form onSubmit={e=>void save(e)}>
 <fieldset disabled={busy}><legend>Run mode</legend><div className="runtime-mode-options">{([{value:'always',title:'Always on',description:'Runner stays ready.'},{value:'on-demand',title:'On demand',description:'Wake when a task arrives.'}] as const).map(o=><label key={o.value} className={settings.mode===o.value?'is-selected':''}><input type="radio" name={`runner-mode-${id}`} value={o.value} checked={settings.mode===o.value} disabled={o.value==='on-demand'&&!caps.runnerControl} onChange={()=>{setSaved(false);setSettings({...settings,mode:o.value})}}/><span><strong>{o.title}</strong><small>{o.description}</small></span></label>)}</div>
 {!caps.runnerControl&&<small>Managed SSH registration is required for automatic start/stop.</small>}
 {settings.mode==='on-demand'&&<label className="runtime-idle-setting">Stop Runner after idle minutes<input type="number" min={1} max={120} required value={settings.idleMinutes} onChange={e=>{setSaved(false);setSettings({...settings,idleMinutes:Number(e.target.value)})}}/></label>}
 <p className="runtime-muted">SSH, Terminal sessions and monitoring stay available.</p></fieldset>
 <fieldset disabled={busy}><legend>Task resources</legend><label className="runtime-limit-toggle"><input type="checkbox" checked={settings.limits.enabled} disabled={!caps.docker} onChange={e=>{setSaved(false);setSettings({...settings,limits:{...settings.limits,enabled:e.target.checked}})}}/>Limit Runner tasks with Docker</label>
 {!caps.docker&&<small>Docker is unavailable to this node’s SSH user.</small>}
 {settings.limits.enabled&&<div className="runtime-limit-fields"><label>Local Docker image<select required value={settings.limits.image} onChange={e=>{setSaved(false);setSettings({...settings,limits:{...settings.limits,image:e.target.value}})}}><option value="">Choose an installed image…</option>{caps.images.map(image=><option key={image} value={image}>{image}</option>)}</select></label><div className="runtime-limit-grid">
 <label>CPU core quota<input type="number" min={.1} step={.1} placeholder="No limit" disabled={!caps.cpuLimit} value={settings.limits.cpu??''} onChange={e=>limit('cpu',e.target.value)}/></label>
 <label>Memory · GiB<input type="number" min={.125} step={.125} placeholder="No limit" disabled={!caps.memoryLimit} value={settings.limits.memoryGiB??''} onChange={e=>limit('memoryGiB',e.target.value)}/></label>
 <label>Library threads<input type="number" min={1} step={1} placeholder="Default" value={settings.limits.threads??''} onChange={e=>limit('threads',e.target.value)}/></label></div>
 <small>Threads sets OMP / BLAS variables. CPU and memory limits are enforced by Docker.</small>
 <label>GPU devices</label>{caps.gpuRuntime?<div className="runtime-gpu-options">{Array.from({length:caps.gpuCount},(_,i)=><label key={i}><input type="checkbox" checked={settings.limits.gpuIds.includes(i)} onChange={e=>{setSaved(false);setSettings({...settings,limits:{...settings.limits,gpuIds:e.target.checked?[...settings.limits.gpuIds,i]:settings.limits.gpuIds.filter(n=>n!==i)}})}}/>GPU {i}</label>)}</div>:<small>NVIDIA Container Toolkit is unavailable. GPU assignment is disabled.</small>}<small>No selected GPU means no GPU access inside the task container. Limits apply per task, not to SSH commands.</small></div>}
 </fieldset><div className="runtime-actions">{saved&&<span role="status">Saved · applies to new tasks</span>}<button type="button" onClick={onClose}>Close</button><button className="runtime-primary" type="submit" disabled={busy}><MaterialIcon type="save"/>{busy?'Saving…':'Save settings'}</button></div>
 </form>}
 </section>
}
