import { replaceRecoveredTask } from './recovered-task'
import { useEffect, useState } from 'react'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import { AssistantMessage } from './agent-messages'
import { AgentTaskResult, message, type Task, type Proposal } from './agent-task-result'
export type GoalResult={goal:null|{_id:string;updatedAt?:string;createdAt?:string;objective:string;elapsedMs?:number;runningSince?:string|null;timeLimitMs?:number|null;scope?:{path:string;kind:string}[];skills?:string[];status:string;stage:string;reason:string;steps:number;reviewMode:'human'|'ai';review?:{reason:string};recent?:{summary:string;taskId?:string;review?:{reason:string};changes?:{path:string;status:string}[]}[]};task:Task|null;reviewTask?:Task|null}
export function GoalPanel({projectId,conversationId,onState,onGoal}:{projectId:string;conversationId:string;onState:(active:boolean)=>void;onGoal?:(goal:GoalResult['goal'])=>void}){
 const base=`/writing-assist/project/${projectId}/conversations/${conversationId}`
 const [value,setValue]=useState<GoalResult|null>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [revision,setRevision]=useState(0)
 useEffect(()=>{const refresh=()=>setRevision(n=>n+1);window.addEventListener('paper-goal-changed',refresh);return()=>window.removeEventListener('paper-goal-changed',refresh)},[])
 useEffect(()=>{if(!conversationId){setValue(null);onState(false);onGoal?.(null);return}const c=new AbortController();let timer:ReturnType<typeof setTimeout>;async function poll(){try{const next=await getJSON<GoalResult>(base+'/goal',{signal:c.signal});if(c.signal.aborted)return;setValue(next);onGoal?.(next.goal);onState(Boolean(next.goal&&!['completed','cancelled','paused','blocked'].includes(next.goal.status)));setError('');if(next.goal&&!['completed','cancelled'].includes(next.goal.status))timer=setTimeout(poll,2000)}catch(e){if(!c.signal.aborted){setError(message(e));timer=setTimeout(poll,5000)}}}poll();return()=>{c.abort();clearTimeout(timer)}},[base,conversationId,revision,onState,onGoal])
 async function decide(proposal?:Proposal,accept?:boolean){if(!proposal||!value?.task)return;setBusy(true);try{await postJSON(`/writing-assist/project/${projectId}/tasks/${value.task.taskId}/proposals/${proposal.id}`,{body:{accept}});setRevision(n=>n+1)}catch(e){setError(message(e))}finally{setBusy(false)}}
 if(!value?.goal)return error?<p role="alert">{error}</p>:null
 const goal=value.goal;
 const stage=goal.status==='active'?(goal.stage==='review'?'AI reviewing changes':'Working on goal'):({waiting_review:'Waiting for your review',paused:'Paused',blocked:'Needs attention',completed:'Completed',cancelled:'Stopped'}[goal.status]||goal.status);
 return <section className="paper-goal-panel" aria-label="Persistent goal"><header><strong>Goal</strong><span>{stage}</span></header><p>{goal.objective}</p><p className="paper-context-scope">{goal.reviewMode==='ai'?'Automatic · AI review':'Manual approval'}</p>{!!goal.scope?.length&&<p className="paper-context-scope">Edit scope: {goal.scope.map(s=>s.path+(s.kind==='folder'?'/':'')).join(', ')}</p>}{!!goal.skills?.length&&<p className="paper-context-scope">Skills: {goal.skills.join(', ')}</p>}<div className="paper-goal-progress" role="status"><strong>{goal.steps} {goal.steps===1?'round':'rounds'} completed{goal.status==='active'?` · Round ${goal.steps+1}`:''}</strong></div><AssistantMessage text={goal.reason} compact/>
  {!!goal.review?.reason&&<details><summary>Latest review</summary><AssistantMessage text={goal.review.reason} compact/></details>}
  {!!goal.recent?.length&&<details open><summary>Recent progress</summary>{goal.recent.map((step,index)=><GoalHistoryStep key={`${step.taskId}-${index}`} projectId={projectId} step={step}/>)}</details>}
  {value.task&&<details open={['active','waiting_review'].includes(goal.status)}><summary>Current work &amp; changes</summary><AgentTaskResult onRecovered={task=>{setValue(current=>current?{...current,task:replaceRecoveredTask(current.task,task)}:current);setRevision(n=>n+1)}} hideInstruction task={value.task} busy={busy||goal.status==='active'} act={decide}/></details>}

  {value.reviewTask&&<section aria-label="AI review activity"><strong>AI review</strong><AgentTaskResult onRecovered={task=>setValue(current=>current?{...current,reviewTask:replaceRecoveredTask(current.reviewTask,task)}:current)} hideInstruction task={value.reviewTask} busy act={()=>{}}/></section>}
  {error&&<p role="alert">{error}</p>}
 </section>
}

function GoalHistoryStep({projectId,step}:{projectId:string;step:NonNullable<NonNullable<GoalResult['goal']>['recent']>[number]}) {
 const [task,setTask]=useState<Task|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [opened,setOpened]=useState(true)
 useEffect(()=>{if(!opened||!step.taskId||task)return;const controller=new AbortController();setLoading(true);getJSON<Task>(`/writing-assist/project/${projectId}/tasks/${step.taskId}`,{signal:controller.signal}).then(setTask).catch(e=>{if(!controller.signal.aborted)setError(message(e))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[opened,projectId,step.taskId,task])
 return <article className="paper-goal-history-step">
  {!task&&<AssistantMessage text={step.summary}/>}
  {!!step.changes?.length&&<ul>{step.changes.map(change=><li key={change.path}><code>{change.path}</code><span>{change.status==='accepted'?'Applied':change.status}</span></li>)}</ul>}
  {step.review?.reason&&<details><summary>AI review decision</summary><AssistantMessage text={step.review.reason}/></details>}
  {step.taskId&&<details open onToggle={e=>setOpened(e.currentTarget.open)}><summary>Files, diffs &amp; commands</summary>{loading&&<p role="status">Loading execution details…</p>}{task&&<AgentTaskResult onRecovered={value=>setTask(current=>replaceRecoveredTask(current,value))} hideInstruction task={task} busy act={()=>{}}/>}{error&&<p role="alert">Execution details are unavailable. The task snapshot may have expired. {error}</p>}</details>}
 </article>
}

export function GoalTimer({goal}:{goal:GoalResult['goal']}) {
 const [now,setNow]=useState(Date.now());useEffect(()=>{if(goal?.status!=='active')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[goal?.status])
 if(!goal)return null
 const elapsed=(goal.elapsedMs||0)+(goal.status==='active'&&goal.runningSince?Math.max(0,now-Date.parse(goal.runningSince)):0)
 const format=(ms:number)=>{const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':')}
 return <div className="paper-goal-clock" aria-label="Goal execution time"><span>{goal.status==='active'?'Goal running':goal.status.replace('_',' ')}</span><span>Elapsed {goal.elapsedMs===undefined?'—':format(elapsed)}</span>{!!goal.timeLimitMs&&<span>Remaining {format(goal.timeLimitMs-elapsed)}</span>}</div>
}
