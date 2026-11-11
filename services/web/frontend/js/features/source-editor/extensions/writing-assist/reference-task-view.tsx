import { ProposalDiff } from './proposal-diff'
import { AgentActivity } from './agent-messages'
import { AgentTaskResult, ProposalCard, type Task, type Proposal, type ReferenceFieldChoice } from './agent-task-result'
import { ReferenceReviewCard } from './reference-review'
import { ClaimReviewCard } from './claim-review'
export function ReferenceTaskView({task,busy,onFields,onClaim,onRepair,act}:{task:Task;busy:boolean;onFields:(fields:ReferenceFieldChoice[])=>void;onClaim:(id:string)=>void;onRepair:(target:{docId:string;keys:string[]})=>void;act:(proposal?:Proposal,accept?:boolean)=>void}) {
 const disabled=busy || task.proposals.some(p=>['applying','uncertain'].includes(p.status))
 if(task.claimReview)return <><ClaimReviewCard review={task.claimReview} busy={disabled} onApply={onClaim}/><details className="paper-reference-report"><summary>Activity</summary><AgentActivity activity={task.activity}/></details></>
 if(task.referenceReview)return <>
  {task.proposals.length>0 && task.proposals.every(p=>p.status==='accepted') && !task.referenceReview.appliedCount ? <p role="status">File preview applied. <button type="button" disabled={busy} onClick={()=>onRepair(task.referenceReview!)}>Check again</button></p> : <ReferenceReviewCard review={task.referenceReview} disabled={disabled} onApply={onFields} onRepair={()=>onRepair(task.referenceReview!)}/>}
  <details className="paper-reference-report"><summary>AI report and activity</summary><AgentTaskResult task={{...task,instruction:'Reference check details',proposals:[]}} busy={busy} act={act}/></details>
  {task.proposals.filter(p=>p.status!=='accepted').map(p=>p.status==='pending' && task.referenceReview?.baseHash ? <details key={p.id} className="paper-reference-report"><summary>Combined file preview</summary><p>Use Apply or Reject on individual fields above.</p><ProposalDiff before={p.before} after={p.after}/></details> : <ProposalCard key={p.id} proposal={p} busy={busy} act={act}/>)}
  {task.proposals.some(p=>p.status==='accepted') && <details className="paper-reference-report"><summary>Applied changes</summary>{task.proposals.filter(p=>p.status==='accepted').map(p=><ProposalCard key={p.id} proposal={p} busy={busy} act={act}/>)}</details>}
 </>
 if(task.status==='completed' && !task.proposals.length)return <details className="paper-reference-report"><summary>Check report (check again for suggestion cards)</summary><AgentTaskResult task={{...task,instruction:'Reference check details'}} busy={busy} act={act}/></details>
 return <AgentTaskResult task={task} busy={busy} act={act}/>
}
