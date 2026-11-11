import {createHash} from 'node:crypto'
import {TrackCheckReport} from '../../models/TrackCheckReport.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import {AgentError} from '../WritingAssist/WritingAssistAgentService.mjs'
import {createIssueResolver,reportIdFor,reportView,parseIssueId,parseIssueOutcomes} from './TrackCheckIssues.mjs'
export async function saveCheckReport(task,userId,projectId,review){
 const id=reportIdFor(task.taskId)
 await TrackCheckReport.updateOne({_id:id,userId,projectId},{$setOnInsert:{taskId:task.taskId,review,resolutions:{}}},{upsert:true}).exec()
 return reportView(await TrackCheckReport.findOne({_id:id,userId,projectId}).lean().exec())
}
export async function savedCheckReport(taskId,userId,projectId){
 const report=await TrackCheckReport.findOne({_id:reportIdFor(taskId),userId,projectId}).lean().exec()
 return report?reportView(report):null
}
export const resolveCheckIssues=createIssueResolver({
 load:(id,userId)=>TrackCheckReport.findOne({_id:id,userId}).lean().exec(),
 canWrite:(userId,projectId)=>AuthorizationManager.promises.canUserWriteProjectContent(userId,projectId),
 setStatus:(id,userId,index,value)=>TrackCheckReport.updateOne({_id:id,userId},{$set:Object.fromEntries(Object.entries(value).map(([key,field])=>[`resolutions.${index}.${key}`,field]))}).exec(),
 ErrorType:AgentError,
})

export async function completeCheckIssues(task,currentSnapshot){
 const outcomes=parseIssueOutcomes(task.summary,task.issueContext)
 if(!outcomes.length)return
 const reports=new Map()
 for(const context of task.issueContext){const report=await TrackCheckReport.findOne({_id:context.reportId,userId:task.userId,projectId:task.projectId}).lean().exec();if(report)reports.set(context.reportId,report)}
 const pending=outcomes.filter(item=>reports.get(parseIssueId(item.id).reportId)?.resolutions?.[parseIssueId(item.id).index]?.taskId!==task.id)
 if(!pending.length)return
 const current=await currentSnapshot();const hash=docs=>createHash('sha256').update(JSON.stringify(docs.map(d=>[d.path,d.content]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex')
 const unchanged=hash(current)===hash(task.documents)
 for(const item of pending){const {reportId,index}=parseIssueId(item.id);const report=reports.get(reportId);if(!report)continue
  const original=task.issueContext.find(c=>c.reportId===reportId)?.findings.find(f=>f.id===item.id)?.resolution
  const currentResolution=report.resolutions?.[index]
  // A later explicit mark/reopen or another investigation always wins.
  if(currentResolution?.updatedAt!==original?.updatedAt)continue
  const resolved=item.status==='verified'&&unchanged&&!(task.proposals||[]).length
  const value={status:resolved?'resolved':'unresolved',method:'ai',taskId:task.id,updatedAt:new Date().toISOString(),summary:item.summary,evidence:item.evidence,blockers:item.blockers,...(!unchanged?{notice:'Draft changed during investigation; verify again.'}:task.proposals?.length?{notice:'Proposed changes require review and a fresh verification.'}:{})}
  await TrackCheckReport.updateOne({_id:reportId,userId:task.userId,[`resolutions.${index}.updatedAt`]:currentResolution?.updatedAt||{$exists:false}},{$set:{[`resolutions.${index}`]:value}}).exec()
 }
}
