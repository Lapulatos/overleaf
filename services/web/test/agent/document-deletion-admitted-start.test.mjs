/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { createAdmittedReservationStart } from '../../app/src/Features/WritingAssist/DocumentDeletionAdmittedStart.mjs'
function fixture() {
 const input={projectId:'a'.repeat(24),docId:'b'.repeat(24),userId:'c'.repeat(24),taskId:randomUUID(),proposalId:randomUUID(),expectedVersion:0,path:'test.tex',baseHash:createHash('sha256').update('text').digest('hex')}
 const operationId=randomUUID(),session={identity:'transaction'},calls=[]
 const task={status:'completed',proposals:[{id:input.proposalId,status:'applying',mode:'delete-document',docId:input.docId,path:input.path,version:0,before:'text'}]}
 let row
 const f={input,operationId,task,calls,admitted:true}
 const adapters={objectId:id=>id,withTransaction:fn=>fn(session),
  tasks:{findOne:async(_,opts)=>{assert.equal(opts.session,session);return task},updateOne:async(_,__,opts)=>{assert.equal(opts.session,session);calls.push('task');return {matchedCount:1}}},
  projects:{updateOne:async(query,_,opts)=>{assert.equal(opts.session,session);assert.equal(query[`documentDeletionAdmissions.${input.docId}.operationId`],operationId);calls.push('project');return {matchedCount:f.admitted?1:0}}},
  reservations:{updateOne:async(_,update,opts)=>{assert.equal(opts.session,session);calls.push('reservation');row={...update.$setOnInsert}},findOne:async(_,opts)=>{assert.equal(opts.session,session);return row}},
 }
 f.run=()=>createAdmittedReservationStart(adapters)(input,operationId)
 return f
}
test('reservation creation touches task and admission in the same transaction',async()=>{
 const f=fixture();const result=await f.run();assert.equal(result.operationId,f.operationId);assert.deepEqual(f.calls,['task','project','reservation'])
})
test('terminal or modified proposals cannot create late reservations',async()=>{
 for(const change of [{status:'accepted'},{status:'conflict'},{before:'changed'},{version:1}]) {
  const f=fixture();Object.assign(f.task.proposals[0],change)
  await assert.rejects(f.run(),{status:409});assert.deepEqual(f.calls,[])
 }
})
test('missing admission stops before reservation insertion',async()=>{
 const f=fixture();f.admitted=false
 await assert.rejects(f.run(),{status:409});assert.deepEqual(f.calls,['task','project'])
})
