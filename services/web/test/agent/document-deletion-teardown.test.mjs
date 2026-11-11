/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createDeletionTeardown } from '../../app/src/Features/WritingAssist/DocumentDeletionTeardown.mjs'

function fixture(state = 'committing', status = 'applying') {
  const row = { projectId:'a'.repeat(24), docId:'b'.repeat(24), userId:'c'.repeat(24), taskId:randomUUID(), proposalId:randomUUID(), operationId:randomUUID(), expectedVersion:3, baseHash:createHash('sha256').update('original').digest('hex'), path:'chapter.tex', state }
  const task = { projectId:row.projectId, userId:row.userId, status:'completed', proposals:[{id:row.proposalId,mode:'delete-document',status,docId:row.docId,path:row.path,version:3,before:'original'}] }
  let present = true
  const calls = []
  const adapters = {
    withProjectLock: async(id,fn)=>{assert.equal(id,row.projectId);return fn()},
    authorizeTeardown: async()=>{},
    listReservations: async()=>present?[structuredClone(row)]:[],
    readReservation: async()=>present?structuredClone(row):null,
    readTask: async()=>structuredClone(task),
    claimRetry: async()=>{calls.push('claim');task.proposals[0].status='applying';return true},
    holdApplying: async()=>{calls.push('hold');return task.proposals[0].status==='applying'},
    resumeExisting: async(input,operationId)=>{assert.equal(operationId,row.operationId);assert.equal(input.baseHash,row.baseHash);calls.push('resume');row.state='committed'},
    settle: async(id,proposalId,status)=>{assert.equal(id,row.taskId);assert.equal(proposalId,row.proposalId);calls.push('settle');task.proposals[0].status=status},
  }
  return {row,task,calls,adapters,remove:()=>{present=false},run:()=>createDeletionTeardown(adapters)(row.projectId,'d'.repeat(24))}
}

test('recovers the existing accepted operation and settles its task',async()=>{
 const f=fixture();const id=f.row.operationId
 assert.deepEqual(await f.run(),{completed:1,conflicts:0})
 assert.equal(f.row.operationId,id);assert.equal(f.task.proposals[0].status,'accepted')
 assert.deepEqual(f.calls,['hold','resume','settle'])
})
test('claims uncertain tasks before resuming while terminal receipts need no task',async()=>{
 const f=fixture('fenced','uncertain');await f.run();assert.equal(f.calls[0],'claim')
 const terminal=fixture('committed');terminal.adapters.readTask=async()=>null
 assert.deepEqual(await terminal.run(),{completed:0,conflicts:0});assert.deepEqual(terminal.calls,[])
})
test('never executes unreviewed proposals or mismatched snapshots',async()=>{
 for(const change of [{status:'pending'},{before:'edited'},{docId:'e'.repeat(24)},{version:4}]) {
  const f=fixture();Object.assign(f.task.proposals[0],change)
  await assert.rejects(f.run(),{code:'DELETION_TEARDOWN_BLOCKED'});assert.deepEqual(f.calls,[])
 }
})
test('missing task and cross-project rows block teardown without recovery',async()=>{
 const f=fixture();f.adapters.readTask=async()=>null
 await assert.rejects(f.run(),{code:'DELETION_TEARDOWN_BLOCKED'});assert.deepEqual(f.calls,[])
 const other=fixture();other.adapters.listReservations=async()=>[{...other.row,projectId:'e'.repeat(24)}]
 await assert.rejects(other.run(),{code:'DELETION_TEARDOWN_BLOCKED'});assert.deepEqual(other.calls,[])
})
test('rechecks whole-project deletion authority before resuming',async()=>{
 const f=fixture();let count=0
 f.adapters.authorizeTeardown=async()=>{if(++count===2)throw Object.assign(Error('revoked'),{status:403})}
 await assert.rejects(f.run(),{status:403});assert.deepEqual(f.calls,['hold'])
})
test('lost resume response preserves applying task and does not settle',async()=>{
 const f=fixture();f.adapters.resumeExisting=async()=>{f.row.state='committed';throw Error('response lost')}
 await assert.rejects(f.run(),/response lost/);assert.equal(f.task.proposals[0].status,'applying');assert.deepEqual(f.calls,['hold'])
})
test('requires the original persisted committed binding, not an adapter success response',async()=>{
 const f=fixture();f.adapters.resumeExisting=async()=>{f.row.state='committed';f.row.operationId=randomUUID()}
 await assert.rejects(f.run(),{code:'DELETION_TEARDOWN_BLOCKED'});assert.equal(f.task.proposals[0].status,'applying')
})
test('settles a proven aborted preparing conflict but retains later-stage conflicts',async()=>{
 const f=fixture('preparing');f.adapters.resumeExisting=async()=>{f.remove();throw Object.assign(Error('changed'),{code:'DELETION_SNAPSHOT_CONFLICT'})}
 assert.deepEqual(await f.run(),{completed:0,conflicts:1});assert.equal(f.task.proposals[0].status,'conflict')
 const fenced=fixture('fenced');fenced.adapters.resumeExisting=async()=>{throw Object.assign(Error('changed'),{code:'DELETION_SNAPSHOT_CONFLICT'})}
 await assert.rejects(fenced.run(),{code:'DELETION_SNAPSHOT_CONFLICT'});assert.equal(fenced.task.proposals[0].status,'applying')
})

test('retry settles a task even when the prior commit response was lost',async()=>{
 const f=fixture();const resume=f.adapters.resumeExisting
 f.adapters.resumeExisting=async(...args)=>{await resume(...args);throw Error('response lost')}
 await assert.rejects(f.run(),/response lost/)
 assert.equal(f.row.state,'committed');assert.equal(f.task.proposals[0].status,'applying')
 f.adapters.resumeExisting=resume
 assert.deepEqual(await f.run(),{completed:1,conflicts:0})
 assert.equal(f.task.proposals[0].status,'accepted')
})
test('failed retry claim cannot start recovery',async()=>{
 const f=fixture('fenced','uncertain');f.adapters.claimRetry=async()=>false
 await assert.rejects(f.run(),{code:'DELETION_TEARDOWN_BLOCKED'});assert.deepEqual(f.calls,[])
})


test('accepted committed operation retries settlement without deleting again', async () => {
 const f=fixture('committed','accepted')
 assert.deepEqual(await f.run(),{completed:0,conflicts:0})
 assert.deepEqual(f.calls,['settle'])
})
test('failed terminal cleanup blocks teardown and can be retried', async () => {
 const f=fixture('committed','accepted');const settle=f.adapters.settle
 f.adapters.settle=async()=>{throw Error('cleanup unavailable')}
 await assert.rejects(f.run(),/cleanup unavailable/)
 assert.equal(f.row.state,'committed');assert.equal(f.task.proposals[0].status,'accepted')
 assert.deepEqual(f.calls,[])
 f.adapters.settle=settle;await f.run();assert.deepEqual(f.calls,['settle'])
})
test('revoked project-removal authority prevents terminal cleanup', async () => {
 const f=fixture('committed','accepted');let count=0
 f.adapters.authorizeTeardown=async()=>{if(++count===2)throw Object.assign(Error('revoked'),{status:403})}
 await assert.rejects(f.run(),{status:403});assert.deepEqual(f.calls,[])
})


test('admitted crash gap uses only the explicitly verified admission recovery adapter', async () => {
 const f=fixture('admitted');const read=f.adapters.readReservation
 f.adapters.readReservation=async()=>f.row.state==='admitted'?null:read()
 f.adapters.resumeExisting=async()=>assert.fail('missing receipt is not existing-only recovery')
 f.adapters.resumeAdmitted=async(input,id)=>{assert.equal(id,f.row.operationId);assert.equal(input.taskId,f.row.taskId);f.calls.push('admitted');f.row.state='committed'}
 assert.deepEqual(await f.run(),{completed:1,conflicts:0})
 assert.deepEqual(f.calls,['hold','admitted','settle'])
})
test('admitted crash gap without a verifier cannot execute or settle', async () => {
 const f=fixture('admitted');f.adapters.readReservation=async()=>null
 await assert.rejects(f.run(),{code:'DELETION_TEARDOWN_BLOCKED'})
 assert.deepEqual(f.calls,['hold'])
})

test('admission closes only after authorization, with a final drain check', async () => {
 const f=fixture();const order=[]
 f.adapters.authorizeTeardown=async()=>{order.push('authorize')}
 f.adapters.closeAdmission=async()=>{order.push('close')}
 f.adapters.assertDrained=async()=>{order.push('drained')}
 await f.run();assert.deepEqual(order,['authorize','close','authorize','drained'])
 const denied=fixture();denied.adapters.authorizeTeardown=async()=>{throw Object.assign(Error('denied'),{status:403})}
 denied.adapters.closeAdmission=async()=>assert.fail('unauthorized closure')
 await assert.rejects(denied.run(),{status:403})
})
test('remaining admissions block project removal even when receipts are committed', async () => {
 const f=fixture('committed','accepted')
 f.adapters.assertDrained=async()=>{throw Object.assign(Error('ticket remains'),{status:409})}
 await assert.rejects(f.run(),{status:409})
})
test('terminal conflict admission is cleaned without executing deletion', async () => {
 const f=fixture('admitted','conflict');f.adapters.readReservation=async()=>null
 const settle=f.adapters.settle;f.adapters.settle=async(...args)=>{await settle(...args);f.remove()}
 assert.deepEqual(await f.run(),{completed:0,conflicts:1});assert.deepEqual(f.calls,['settle'])
})



test('retired integration receipts can be retained but unfinished work cannot be resumed', async () => {
  const f = fixture('committed')
  delete f.row.taskId
  delete f.row.proposalId
  f.row.source = 'retired-integration'
  f.adapters.readTask = async () => { throw new Error('Retired integration has no assistant task') }
  assert.deepEqual(await f.run(), { completed: 0, conflicts: 0 })
  assert.deepEqual(f.calls, [])
  f.row.state = 'committing'
  await assert.rejects(f.run(), { code: 'DELETION_TEARDOWN_BLOCKED' })
  assert.deepEqual(f.calls, [])
})
