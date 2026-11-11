import {hydrateVenueWorkspace} from './venue-workspace'
import {useEffect,useRef,useState} from 'react'
import {getJSON,postJSON} from '@/infrastructure/fetch-json'
import {getProjectModelSelection} from '@/features/source-editor/extensions/writing-assist/model-controls'
import {message,type Task} from '@/features/source-editor/extensions/writing-assist/agent-task-result'
import {UserMessage,AgentActivity,AssistantMessage} from '@/features/source-editor/extensions/writing-assist/agent-messages'
import type {Recommendations} from './venue-recommendations'
export function parsePlanCommand(input:string,currentProject:string){
 if(!/^\/plan(?:\s|$)/i.test(input.trim()))return null
 let requirements=input.trim().replace(/^\/plan\s*/i,'')
 const match=requirements.match(/(?:^|\s)project=(\S+)/i)
 const projectId=match?.[1]||currentProject
 if(!/^[a-f0-9]{24}$/i.test(projectId))throw Error('Use /plan project=<24-character project ID> followed by your submission requirements.')
 if(match)requirements=requirements.replace(match[0],' ').trim()
 if(requirements.length>6000)throw Error('Keep submission requirements within 6000 characters.')
 return {projectId,requirements}
}
export function savedPlanningContext(projectId:string){
 let saved:any={};try{saved=JSON.parse(localStorage.getItem('submission-sequence:'+projectId)||'{}')}catch{}
 return {active:Boolean(saved.active),reviewId:String(saved.reviewId||''),reviewEstimate:String(saved.reviewEstimate||''),months:Math.min(36,Math.max(1,Number(saved.months)||12)),gapDays:Math.min(365,Math.max(0,Number(saved.gap)||3)),allowWarning:saved.allowWarning!==false,prioritizeQuality:saved.prioritizeQuality!==false,mode:['mixed','journal','conference'].includes(saved.mode)?saved.mode:'mixed'}
}
export const planResultKey=(projectId:string)=>'paper-plan-result:'+projectId
export function usePlanCommand(currentProject:string){
 const storageKey='paper-plan-command:'+currentProject
 type Pending={projectId:string;taskId:string;request:string;status:string;task?:Task}
 const [pending,setPending]=useState<Pending|null>(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}})
 const [error,setError]=useState(''),[revision,setRevision]=useState(0),[starting,setStarting]=useState(false)
 const lock=useRef(false)
 const save=(value:Pending)=>{setPending(value);try{localStorage.setItem(storageKey,JSON.stringify(value))}catch{/* Keep live progress usable when browser storage is full. */}}
 async function start(input:string){
  const parsed=parsePlanCommand(input,currentProject);if(!parsed)return false
  if(lock.current||pending?.status==='running'||pending?.status==='checking-failed')throw Error('A submission plan is already in progress. Check its status before starting another plan.')
  lock.current=true;setStarting(true);setError('')
  try{await hydrateVenueWorkspace(parsed.projectId);const {task}=await postJSON<{task:Task}>(`/writing-assist/project/${parsed.projectId}/venue-recommendations`,{body:{...getProjectModelSelection(parsed.projectId),planning:savedPlanningContext(parsed.projectId),requirements:parsed.requirements||'Prioritize the number of distinct high-quality publications, then speed.'}})
   save({projectId:parsed.projectId,taskId:task.taskId,request:input,status:'running',task});return true
  }finally{lock.current=false;setStarting(false)}
 }
 useEffect(()=>{
  if(!pending||pending.status!=='running')return
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>
  async function poll(){try{
   const value=await getJSON<{task:Task;result?:Recommendations;resultError?:string}>(`/writing-assist/project/${pending!.projectId}/venue-recommendations/${pending!.taskId}`,{signal:controller.signal})
   if(controller.signal.aborted)return
   if(value.resultError){save({...pending!,status:'failed',task:value.task});setError(value.resultError);return}
   save({...pending!,task:value.task})
   if(value.result){
    const target=pending!.projectId
    if(value.result.planning){const prior=JSON.parse(localStorage.getItem('submission-sequence:'+target)||'{}');const preferences=value.result.planning;localStorage.setItem('submission-sequence:'+target,JSON.stringify({...prior,reviews:prior.reviews||{},...preferences,...(preferences.gapDays!==undefined?{gap:preferences.gapDays}:{})}))}
    localStorage.setItem('venue-recommendations:'+target,pending!.taskId)
    localStorage.setItem(planResultKey(target),JSON.stringify(value.result))
    save({...pending!,status:'completed',task:value.task})
    if(target===currentProject)window.dispatchEvent(new Event('paper-open-plan'))
    else window.location.assign('/project/'+target+'?openPlan=1')
   }else if(['failed','cancelled','timeout'].includes(value.task.status)){save({...pending!,status:value.task.status,task:value.task});setError(value.task.summary||'Submission planning did not complete.')}
   else if(value.task.status==='completed'){save({...pending!,status:'failed',task:value.task});setError('Planning finished without a usable result. Please start a new /plan request.')}
   else timer=setTimeout(poll,1500)
  }catch(e){if(!controller.signal.aborted){setError(message(e));setPending(current=>{if(!current)return current;const next={...current,status:'checking-failed'};try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}return next})}}}
  void poll();return()=>{controller.abort();clearTimeout(timer)}
 },[pending?.taskId,pending?.status,currentProject,revision])
 return {start,running:starting||pending?.status==='running',panel:pending?<section aria-label="Submission planning request" className="paper-plan-command-progress">
  <p><strong>Submission planning</strong> · {pending.status}</p>
  <UserMessage instruction={pending.request}/>
  <AgentActivity activity={pending.task?.activity||[]} running={pending.status==='running'}/>
  {pending.status==='running'&&<p role="status">{pending.task?.output||'Analyzing the selected project and submission requirements…'}</p>}
  {pending.task?.summary&&!pending.task.activity?.some(item=>item.kind==='message'&&item.text?.trim()===pending.task!.summary.trim())&&<AssistantMessage text={pending.task.summary}/>}
  {pending.status==='completed'&&<p role="status">Submission plan is ready.</p>}
  {error&&<p role="alert">{error}</p>}
  {pending.status==='checking-failed'&&<p>Could not check planning progress. You can continue chatting. <button type="button" onClick={()=>{setError('');save({...pending,status:'running'});setRevision(n=>n+1)}}>Retry status</button></p>}
 </section>:null}
}
