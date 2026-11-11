import {useEffect,useState} from 'react'
import {getJSON,postJSON} from '@/infrastructure/fetch-json'
import {useProjectContext} from '@/shared/context/project-context'
import {getProjectModelSelection} from '@/features/source-editor/extensions/writing-assist/model-controls'
import MaterialIcon from '@/shared/components/material-icon'
import {message} from '@/features/source-editor/extensions/writing-assist/agent-task-result'
const api='/writing-assist/submission-deadlines/venue-refresh'
type Job={running:boolean;phase:string;total:number;completed:number;updated:number;analyzed:number;failed:number;error?:string;current?:string;canResume?:boolean}
export default function MetricUpdateButton(){
 const {projectId}=useProjectContext();const [job,setJob]=useState<Job|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [revision,setRevision]=useState(0)
 useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>;async function poll(){try{const data=await getJSON<{job:Job|null}>(api);if(!active)return;setJob(data.job);if(data.job?.running)timer=setTimeout(poll,3000);else{window.dispatchEvent(new Event('venue-metrics-updated'));if(data.job?.phase==='completed')window.dispatchEvent(new Event('venue-database-updated'))}}catch(e){if(active)setError(message(e))}}void poll();return()=>{active=false;clearTimeout(timer)}},[revision])
 async function update(){setBusy(true);setError('');try{const result=await postJSON<{job:Job}>(api,{body:{projectId,...getProjectModelSelection(projectId)}});setJob(result.job);setRevision(n=>n+1)}catch(e){setError(message(e))}finally{setBusy(false)}}
 async function pause(){await postJSON(api+'/pause',{});setRevision(n=>n+1)}
 return <><button type="button" className="skill-metric-update" disabled={busy||job?.running||!projectId} onClick={()=>void update()} title="Update the Venue database from online sources, verify metrics, and analyze sourced details with AI"><MaterialIcon type="refresh"/>{busy||job?.running?'Updating venues…':job?.canResume?'Resume update':'Update metrics'}</button>{job?.running&&<button type="button" onClick={()=>void pause().catch(e=>setError(message(e)))} title="Pause after the current source or AI task">Pause update</button>}{job&&<small role="status">{job.phase} · {job.completed}/{job.total} sources · {job.updated} saved · {job.analyzed} AI analyzed{job.failed?` · ${job.failed} unavailable`:''}{job.running&&job.current?` · ${job.current}`:''}</small>}{(error||job?.error)&&<small role="alert">{error||job?.error}</small>}</>
}
