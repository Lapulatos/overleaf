import { randomUUID } from 'node:crypto'
import { AgentError } from './WritingAssistAgentService.mjs'
const normalize = s => String(s || '').replace(/\s+/g, ' ').trim()
const commands = s => (s.match(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g) || []).join('\n')
export function buildClaimReview(input, summary) {
 let items=[]
 try { const json=JSON.parse(summary.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));items=Array.isArray(json?.findings)?json.findings.filter(item=>item && typeof item==='object'):[] } catch { /* Retain evidence-limited cards instead of guessing from prose. */ }
 return {checkedAt:input.checkedAt,items:input.contexts.map(context=>{
  const matches=items.filter(i=>i.contextId===context.id)
  const finding=matches.length===1?matches[0]:null
  const source=input.evidence.find(e=>context.keys.includes(e.key) && e.key===finding?.citationKey) || input.evidence.find(e=>context.keys.includes(e.key))
  const sourceText=source?.fullText?.text || source?.abstract || ''
  const quote=typeof finding?.quote==='string'?finding.quote.slice(0,4000):''
  const verified=source?.key===finding?.citationKey && normalize(quote).length>=25 && normalize(sourceText).includes(normalize(quote))
  const doc=input.documents.find(d=>d.path===context.path)
  const before=context.text
  const after=typeof finding?.after==='string'?finding.after:''
  const verdict=verified && ['supported','partial','contradicted'].includes(finding?.verdict)?finding.verdict:'insufficient'
  const unique=doc && doc.content.split(before).length===2
  const applicable=verified && ['partial','contradicted'].includes(verdict) && unique && after.trim().length>0 && after!==before && after.length<=6000 && commands(after)===commands(before)
  return {id:context.id,docId:doc?.id,path:context.path,line:unique?doc.content.slice(0,doc.content.indexOf(before)).split('\n').length:context.line,keys:context.keys,before,after:applicable?after:null,verdict,reason:typeof finding?.reason==='string'?normalize(finding.reason).split(/(?<=[.!?])\s+/).slice(0,2).join(' ').slice(0,320):'A structured assessment was not returned. Check again or inspect the full report.',source:source?.fullText?.url || source?.source?.landingUrl || source?.source?.url || null,quote:verified?quote:null,status:applicable?'pending':'review',note:applicable?null:verdict==='insufficient'?'Source evidence is insufficient. No automatic text change is available.':verdict==='supported'?'No correction needed.':'Review manually; the proposed replacement could not be safely validated.'}
 })}
}
export async function applyClaimSuggestion({canWrite,snapshot,store,tasks},user,project,{taskId,suggestionId}) {
 if(!await canWrite(user,project))throw new AgentError(403,'Project write access required')
 const task=await store.find(taskId,user,project)
 if(!task || task.status!=='completed')throw new AgentError(404,'Completed citation check not found')
 if(task.proposals?.some(p=>['pending','applying','uncertain'].includes(p.status)))throw new AgentError(409,'Finish the current application before retrying')
 const item=task.claimReview?.items.find(i=>i.id===suggestionId)
 if(!item || item.status!=='pending' || !item.after)throw new AgentError(422,'This finding has no applicable correction')
 const original=task.claimInput?.documents.find(d=>d.path===item.path)
 const current=(await snapshot(project)).find(d=>d.id===original?.id && d.path===item.path)
 if(!current || current.content!==original.content)throw new AgentError(409,'The manuscript changed since this check. Check citations again before applying.')
 if(current.content.split(item.before).length!==2)throw new AgentError(409,'The cited passage is no longer unique. Check citations again.')
 const after=current.content.replace(item.before,()=>item.after)
 const id=randomUUID();const proposalId=randomUUID()
 await store.create({id,userId:user,projectId:project,status:'completed',instruction:'Apply reviewed citation suggestion',summary:item.reason,documents:[current],proposals:[{id:proposalId,docId:current.id,path:current.path,version:current.version,before:current.content,after,status:'pending'}],createdAt:new Date()})
 const applied=await tasks.decide(user,project,id,proposalId,true)
 if(!applied.proposals?.every(p=>p.status==='accepted'))return applied
 const claimReview=structuredClone(task.claimReview);const claimInput=structuredClone(task.claimInput)
 claimReview.items.find(i=>i.id===suggestionId).status='accepted'
 claimInput.documents.find(d=>d.id===current.id).content=after
 for(const remaining of claimReview.items)if(remaining.path===item.path && remaining.status==='pending') {
  if(after.split(remaining.before).length!==2){remaining.status='review';remaining.after=null;remaining.note='This passage overlaps an applied correction. Check citations again.'}
  else remaining.line=after.slice(0,after.indexOf(remaining.before)).split('\n').length
 }
 await store.recordClaimApplication(id,user,project,proposalId,claimInput,claimReview)
 return tasks.get(user,project,id)
}
