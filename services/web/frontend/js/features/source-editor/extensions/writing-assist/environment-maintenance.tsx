import './environment-maintenance.css'
import {useEffect,useState} from 'react'
import {getJSON,postJSON} from '@/infrastructure/fetch-json'
type Diagnosis={status:string;rootCause?:string;explanation?:string;action?:string;progress?:string;error?:string}
type Plan={id:string;status:string;container:string;previousImage:string;previousCompiler:string;imageId?:string;packages:string[];dockerfile:string;impact:string;log:string;error?:string;diagnosis?:Diagnosis;validation?:string;automation?:{attempts:number;maxAttempts:number;stoppedReason?:string;history:{at:string;rootCause:string;explanation:string;repairAction:string}[]}}
type State={enabled:boolean;scope:string;container:string;plan:Plan|null;diagnosis?:Diagnosis;events:{at:string;action:string}[]}
const api='/writing-assist/environment'
export default function EnvironmentMaintenance({taskRunning=false}:{taskRunning?:boolean}){
 const [state,setState]=useState<State|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [confirm,setConfirm]=useState('');const [checked,setChecked]=useState(false);const [issue,setIssue]=useState('')
 async function load(){try{setState(await getJSON<State>(api));setError('')}catch(e){setError(e instanceof Error?e.message:'Environment service unavailable')}}
 useEffect(()=>{load()},[])
 const plan=state?.plan;const diagnosing=state?.diagnosis?.status==='running';const operating=['building','activating','rolling-back'].includes(plan?.status||'');const running=taskRunning||busy||diagnosing||operating
 useEffect(()=>{if(!diagnosing&&!operating)return;const timer=setInterval(()=>load(),2000);return()=>clearInterval(timer)},[diagnosing,operating])
 async function action(action:string){setBusy(true);setError('');try{setState(await postJSON<State>(api,{body:action==='permission'?{action,enabled:!state?.enabled}:action==='diagnose'?{action,issue}:{action,planId:plan?.id,confirmation:checked?plan?.id:undefined}}));setConfirm('');setChecked(false)}catch(e){setError(e instanceof Error?e.message:'Operation failed')}finally{setBusy(false)}}
 function review(action:string){setConfirm(action);setChecked(false)}
 return <section className="paper-environment-maintenance" aria-label="Local environment maintenance">
  <h3>AI environment maintenance</h3><p>Codex inspects compiler diagnostics and failed maintenance logs, identifies the cause and prepares a repair. You authorize a maintenance task once; Codex diagnoses failures, adjusts compiler repairs and verifies recovery automatically (up to three attempts).</p>
  {error&&<p role="alert">{error}</p>}
  {!state&&<button type="button" onClick={()=>load()}>Check connection</button>}
  {state&&<>
   <label><input type="checkbox" checked={state.enabled} disabled={running} onChange={()=>action('permission')}/> Allow AI compiler maintenance</label>
   <p>Off by default. Scope: this Overleaf compiler only. Personal files, arbitrary host commands and macOS settings are not granted.</p>
   {state.enabled&&<><label htmlFor="environment-issue">Problem to investigate (optional)</label><textarea id="environment-issue" value={issue} maxLength={4000} onChange={e=>setIssue(e.target.value)} placeholder="Describe the compile error, or leave blank to inspect the last maintenance failure."/><button type="button" disabled={running} onClick={()=>action('diagnose')}>{diagnosing?'AI is diagnosing…':'AI check & repair'}</button></>}
   {diagnosing&&<p role="status">Codex is reviewing compiler information and the previous failure. No environment changes yet.</p>}
   {state.diagnosis?.error&&<p role="alert">{state.diagnosis.error}</p>}
   {state.diagnosis?.rootCause&&<div className="environment-diagnosis"><h4>Root cause</h4><p>{state.diagnosis.rootCause}</p><h4>Repair plan</h4><p>{state.diagnosis.explanation}</p>{state.diagnosis.action!=='compiler-repair'&&<p>This finding needs a project change or manual attention; no compiler change is proposed.</p>}</div>}
   {plan&&<>
    <p role="status">{operating?plan.status==='building'?'Building and verifying a new compiler image…':'Activating the verified compiler…':plan.status==='active'?'Repair applied':`Repair status: ${plan.status}`}</p>
    {plan.validation&&<p>{plan.validation}</p>}{plan.automation&&<><p>AI recovery · {plan.automation.attempts}/{plan.automation.maxAttempts} attempts</p>{plan.automation.stoppedReason&&<p role="alert">{plan.automation.stoppedReason}</p>}<details><summary>AI repair steps</summary>{plan.automation.history.map((step,i)=><div key={i}><strong>{step.repairAction}</strong><p>{step.rootCause}</p><p>{step.explanation}</p></div>)}</details></>}
    {!diagnosing&&state.enabled&&['prepared','built'].includes(plan.status)&&<button type="button" disabled={running} onClick={()=>review(plan.status==='built'?'activate':'repair')}>Review & confirm repair</button>}
    {confirm&&<div role="alertdialog" aria-label="Confirm environment change"><h4>{confirm==='rollback'?'Confirm rollback':'Confirm compiler repair'}</h4><p>{confirm==='rollback'?'Restores the previous compiler image and restarts the managed Overleaf container.':'Creates a new Docker image, validates the ACM template, then restarts this Overleaf container and switches future Agent compilation. Browser connections briefly disconnect. Failed validation prevents activation. Codex may adjust TeX Live dependencies or retry activation within this compiler-only task, up to three attempts; all actions are recorded.'}</p><p>Manuscript files are retained. Current image: <code>{plan.previousImage}</code>. The previous image is kept for rollback. This does not change project main-file settings.</p><p>Packages: {plan.packages.join(', ')}</p><label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> I authorize automatic compiler repair and restart</label><button type="button" disabled={!checked||running} onClick={()=>action(confirm)}>Confirm and execute</button><button type="button" onClick={()=>setConfirm('')}>Cancel</button></div>}
    <details><summary>Advanced details &amp; rollback</summary><p>{plan.impact}</p><p>Managed container: {plan.container}</p><details><summary>Exact Dockerfile</summary><pre>{plan.dockerfile}</pre></details>{plan.error&&<p>{plan.error}</p>}<details><summary>Execution log</summary><pre>{plan.log||'No changes executed.'}</pre></details>{['active','activation-failed'].includes(plan.status)&&<button type="button" disabled={running||!state.enabled} onClick={()=>review('rollback')}>Review rollback</button>}</details>
   </>}
   <details><summary>Activity history</summary>{state.events.map((e,i)=><p key={i}>{e.at} · {e.action}</p>)}</details>
  </>}
 </section>
}
