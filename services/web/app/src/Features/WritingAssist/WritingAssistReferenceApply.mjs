import { createHash, randomUUID } from 'node:crypto'
import { AgentError } from './WritingAssistAgentService.mjs'
import { parseBibliography } from './WritingAssistBibTeX.mjs'
import { applyReferenceFields } from './WritingAssistReferenceCompletion.mjs'
const hash = value => createHash('sha256').update(value).digest('hex')
export async function applyReferenceReview({ canWrite, snapshot, store, tasks }, user, project, {taskId, fields}) {
 if (!(await canWrite(user, project))) throw new AgentError(403, 'Project write access required')
 const task = await store.find(taskId, user, project)
 if (!task) throw new AgentError(404, 'Reference check not found')
 if (task.status !== 'completed' || task.proposals?.some(p => ['applying','uncertain'].includes(p.status))) throw new AgentError(409, 'Finish the current review before applying fields')
 const review = task.referenceReview
 if (task.proposals?.some(p=>p.status==='pending' && (p.docId!==review?.docId || hash(p.before)!==review?.baseHash))) throw new AgentError(409, 'Finish the unrelated file preview before applying fields')
 if (!review?.baseHash) throw new AgentError(409, 'Run a new reference check to enable field application')
 if (!Array.isArray(fields) || !fields.length || fields.length > 250 || new Set(fields.map(f=>JSON.stringify([f.key,f.field]))).size !== fields.length) throw new AgentError(400, 'Select distinct reference fields')
 const doc = (await snapshot(project)).find(d=>d.id===review.docId && /\.bib$/i.test(d.path))
 if (!doc) throw new AgentError(409, 'Bibliography no longer exists. Check again before applying.')
 const parsed = parseBibliography(doc.content)
 const selected = new Map()
 for (const choice of fields) {
  const evidence = review.entries.find(e=>e.key===choice.key)
  const change = evidence?.actions?.find(c=>c.field===choice.field)
  if (!change || !evidence.source || evidence.identity || evidence.reason) throw new AgentError(422, 'This field has no verified applicable source value')
  const matches = parsed.entries.filter(e=>e.key===choice.key)
  if (matches.length!==1 || (matches[0].fields[choice.field] || '')!==change.before) throw new AgentError(409, 'Reference changed. Check again before applying.')
  // Other batches may have updated this document. Rebase only when the selected
  // value and the reference identity still match the checked evidence.
  for (const field of ['title','author','year','doi']) {
   const checked=evidence.fields.find(f=>f.field===field)
   if (!checked) continue
   const current=matches[0].fields[field] || ''
   const approved=evidence.actions?.find(action=>action.field===field)?.after
   if (current!==(checked.current || '') && current!==approved) throw new AgentError(409, `Reference ${choice.key} identity changed (${field}). Check this reference again before applying.`)
  }
  if (!selected.has(choice.key)) selected.set(choice.key,{entry:matches[0],changes:[]})
  selected.get(choice.key).changes.push(change)
 }
 let after = doc.content
 for (const {entry,changes} of [...selected.values()].sort((a,b)=>b.entry.start-a.entry.start)) after=after.slice(0,entry.start)+applyReferenceFields(entry,changes)+after.slice(entry.end)
 parseBibliography(after)
 if (after.length>500000) throw new AgentError(422,'Bibliography exceeds supported size')
 if (after===doc.content) throw new AgentError(409,'No unapplied changes remain')
 const id=randomUUID(); const proposalId=randomUUID()
 // Reuse the existing version-checked writer. All selected fields are one document
 // update; concurrent writers cannot silently overwrite the checked snapshot.
 await store.create({id,userId:user,projectId:project,status:'completed',instruction:`Apply ${fields.length} checked reference fields`,summary:`Requested fields: ${fields.map(f=>`${f.key}.${f.field}`).join(', ')}`,documents:[doc],proposals:[{id:proposalId,docId:doc.id,path:doc.path,version:doc.version,before:doc.content,after,status:'pending'}],createdAt:new Date()})
 const applied=await tasks.decide(user,project,id,proposalId,true)
 if (!applied.proposals?.every(p=>p.status==='accepted')) return applied
 const next=structuredClone(review)
 next.baseHash=hash(after)
 next.appliedCount=(next.appliedCount || 0)+fields.length
 for(const choice of fields){
  const entry=next.entries.find(e=>e.key===choice.key)
  const compared=entry.fields.find(f=>f.field===choice.field)
  if(compared){compared.current=entry.actions.find(c=>c.field===choice.field).after;compared.status='matches'}
  entry.actions=entry.actions.filter(c=>c.field!==choice.field)
 }
 await store.recordReferenceApplication(id,user,project,proposalId,next,`Applied ${fields.length} reference changes.`)
 return tasks.get(user,project,id)
}
