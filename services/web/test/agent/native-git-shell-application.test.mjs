import { ShellRecoveryService } from '../../app/src/Features/NativeGit/ShellRecoveryService.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { ShellDraftService } from '../../app/src/Features/NativeGit/ShellDraftService.mjs'
import { ShellApplicationService } from '../../app/src/Features/NativeGit/ShellApplicationService.mjs'
import { shellReviewFingerprint } from '../../app/src/Features/NativeGit/ShellDraftReview.mjs'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
async function fixture(t) {
 const root=await mkdtemp(Path.join(tmpdir(),'shell-apply-'));t.after(()=>rm(root,{recursive:true,force:true}))
 const f={epoch:2,blocked:false,writes:0,fail:false,allowed:true}
 f.snapshot={files:new Map([['a.tex',Buffer.from('original')]]),entries:new Map([['a.tex',{type:'doc',id:'doc',version:1}]]),folders:new Map()}
 const read=async()=>({...structuredClone(f.snapshot),files:new Map([...f.snapshot.files].map(([path,bytes])=>[path,Buffer.from(bytes)]))})
 const project={read,transaction:async(fn,options)=>{
  assert.deepEqual(options,{prepare:true,epoch:f.epoch})
  return fn({read,assertActive:async()=>{},advanceEpoch:async()=>{f.epoch++},apply:async(changes,before,progress)=>{
   for(const [step,c] of changes.entries()){
    await progress({phase:'before',step,path:c.path});f.writes++
    f.snapshot.files.set(c.path,c.after);f.snapshot.entries.get(c.path).version++
    if(f.fail)throw Error('lost write response')
    await progress({phase:'after',step,path:c.path})
   }
  }})
 }}
 const store=new CollaborationTaskStore(Path.join(root,'tasks'))
 f.drafts=new ShellDraftService({root:Path.join(root,'drafts'),store,project,withLock:fn=>fn(),authorize:async()=>{if(!f.allowed)throw Error('denied')},readEpoch:async()=>f.epoch,logicalProjectId:'root',workspaceId:'workspace',actorId:'actor',minFreeBytes:0})
 f.id=randomUUID();let task=await f.drafts.prepare(f.id)
 await writeFile(Path.join(f.drafts.paths(f.id).workingDirectory,'a.tex'),'shell')
 task=await f.drafts.seal(f.id,task.revision)
 f.options={revision:task.revision,fingerprint:shellReviewFingerprint(task)}
 f.workspaceStore={read:async()=>({mutationTaskId:f.blocked?f.id:null}),beginMutation:async()=>{f.blocked=true},finishMutation:async()=>{f.blocked=false}}
 f.application=new ShellApplicationService({drafts:f.drafts,workspaceStore:f.workspaceStore})
 f.recovery=new ShellRecoveryService({drafts:f.drafts,workspaceStore:f.workspaceStore})
 return f
}
test('sealed draft applies as uncommitted edit with prepared transaction and epoch advance',async t=>{
 const f=await fixture(t)
 const result=await f.application.apply(f.id,f.options)
 assert.equal(result.state,'applied');assert.equal(f.writes,1);assert.equal(f.epoch,3);assert.equal(f.blocked,false)
 assert.equal(f.snapshot.files.get('a.tex').toString(),'shell')
 await assert.rejects(f.application.apply(f.id,f.options),/review changed/);assert.equal(f.writes,1)
})
test('collaborator version change with identical bytes refuses overwrite',async t=>{
 const f=await fixture(t);f.snapshot.entries.get('a.tex').version++
 await assert.rejects(f.application.apply(f.id,f.options),/workspace changed/)
 assert.equal(f.writes,0);assert.equal(f.blocked,false)
})
test('lost write response retains recovery journal and never restores or replays',async t=>{
 const f=await fixture(t);f.fail=true
 await assert.rejects(f.application.apply(f.id,f.options),/lost write response/)
 const task=await f.drafts.get(f.id)
 assert.equal(task.state,'recovery-required');assert.equal(task.application.phase,'writing-document');assert.equal(f.blocked,true)
 assert.equal(f.snapshot.files.get('a.tex').toString(),'shell')
 await assert.rejects(f.application.apply(f.id,f.options),/review changed/);assert.equal(f.writes,1)
})
test('stale review fingerprint and revoked authorization cannot write',async t=>{
 const f=await fixture(t)
 await assert.rejects(f.application.apply(f.id,{...f.options,fingerprint:'0'.repeat(64)}),/review changed/)
 f.allowed=false;await assert.rejects(f.application.apply(f.id,f.options),/denied/)
 assert.equal(f.writes,0)
})

test('uncertain written bytes cannot resume; preserve retains collaborator edits and is idempotent',async t=>{
 const f=await fixture(t);f.fail=true
 await assert.rejects(f.application.apply(f.id,f.options),/lost write response/)
 let preview=await f.recovery.preview(f.id)
 assert.equal(preview.canResume,false)
 await assert.rejects(f.recovery.recover(f.id,{revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'resume',operationId:randomUUID()}),/risk overwriting/)
 f.snapshot.files.set('a.tex',Buffer.from('new collaborator edit'));f.snapshot.entries.get('a.tex').version++
 await assert.rejects(f.recovery.recover(f.id,{revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'preserve-current',operationId:randomUUID()}),/preview is stale/)
 preview=await f.recovery.preview(f.id)
 const command={revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'preserve-current',operationId:randomUUID()}
 const result=await f.recovery.recover(f.id,command)
 assert.equal(result.state,'preserved');assert.equal(f.blocked,false);assert.equal(f.writes,1)
 assert.equal(f.snapshot.files.get('a.tex').toString(),'new collaborator edit')
 assert.equal((await f.recovery.recover(f.id,command)).state,'preserved');assert.equal(f.epoch,3)
})
test('confirmed complete checkpoint can settle without repeating document writes',async t=>{
 const f=await fixture(t)
 const finish=f.workspaceStore.finishMutation
 f.workspaceStore.finishMutation=async()=>{throw Error('settlement unavailable')}
 await assert.rejects(f.application.apply(f.id,f.options),/settlement unavailable/)
 f.workspaceStore.finishMutation=finish
 const preview=await f.recovery.preview(f.id)
 assert.equal(preview.canResume,true)
 const result=await f.recovery.recover(f.id,{revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'resume',operationId:randomUUID()})
 assert.equal(result.state,'applied');assert.equal(f.writes,1);assert.equal(f.blocked,false)
})
test('recovery cannot release another task mutation block',async t=>{
 const f=await fixture(t);f.fail=true
 await assert.rejects(f.application.apply(f.id,f.options))
 f.workspaceStore.read=async()=>({mutationTaskId:randomUUID()})
 await assert.rejects(f.recovery.preview(f.id),/ownership changed/)
 assert.equal(f.blocked,true)
})

test('failure before mutation acquisition can recover without leaving a stuck draft',async t=>{
 const f=await fixture(t), begin=f.workspaceStore.beginMutation
 f.workspaceStore.beginMutation=async()=>{throw Error('acquisition failed')}
 await assert.rejects(f.application.apply(f.id,f.options),/acquisition failed/)
 assert.equal(f.blocked,false);assert.equal(f.writes,0)
 f.workspaceStore.beginMutation=begin
 const preview=await f.recovery.preview(f.id)
 assert.equal(preview.acquireMutation,true);assert.equal(preview.canResume,true)
 await f.recovery.recover(f.id,{revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'resume',operationId:randomUUID()})
 assert.equal(f.writes,1);assert.equal(f.blocked,false)
})
test('preserve-current settlement failure never enables later resume of abandoned shell edits',async t=>{
 const f=await fixture(t);f.fail=true
 await assert.rejects(f.application.apply(f.id,f.options))
 f.snapshot.files.set('a.tex',Buffer.from('keep collaborator text'));f.snapshot.entries.get('a.tex').version++
 let preview=await f.recovery.preview(f.id)
 const finish=f.workspaceStore.finishMutation
 f.workspaceStore.finishMutation=async()=>{throw Error('settlement failed')}
 await assert.rejects(f.recovery.recover(f.id,{revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'preserve-current',operationId:randomUUID()}),/settlement failed/)
 f.workspaceStore.finishMutation=finish
 preview=await f.recovery.preview(f.id)
 assert.equal(preview.canResume,false)
 await assert.rejects(f.recovery.recover(f.id,{revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'resume',operationId:randomUUID()}),/risk overwriting/)
 assert.equal(f.snapshot.files.get('a.tex').toString(),'keep collaborator text');assert.equal(f.writes,1)
})

test('same recovery request finishes settlement after a lost response without another epoch or document write', async t => {
 const f=await fixture(t), finish=f.workspaceStore.finishMutation
 f.workspaceStore.finishMutation=async()=>{throw Error('settlement unavailable')}
 await assert.rejects(f.application.apply(f.id,f.options),/settlement unavailable/)
 const preview=await f.recovery.preview(f.id)
 const request={revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'resume',operationId:randomUUID()}
 await assert.rejects(f.recovery.recover(f.id,request),/settlement unavailable/)
 const epoch=f.epoch,writes=f.writes
 f.workspaceStore.finishMutation=finish
 const recovered=await f.recovery.recover(f.id,request)
 assert.equal(recovered.state,'applied');assert.equal(f.epoch,epoch);assert.equal(f.writes,writes);assert.equal(f.blocked,false)
 assert.equal((await f.recovery.recover(f.id,request)).state,'applied')
 assert.equal(f.epoch,epoch)
})
