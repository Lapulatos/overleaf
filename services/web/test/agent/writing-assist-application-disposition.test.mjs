import test from 'node:test'
import assert from 'node:assert/strict'
import { createApplicationDisposition, inspectionFingerprint } from '../../app/src/Features/WritingAssist/WritingAssistApplicationDisposition.mjs'
function fixture() {
 const task={id:'t',userId:'u',projectId:'p',status:'completed',workspaceIdentity:{projectId:'root'},proposals:[{id:'q',status:'uncertain',before:'old',after:'new'}]}
 const observation={taskId:'t',proposalId:'q',workspace:{current:{epoch:2}},baseline:{content:'old'},proposed:{content:'new'},current:{id:'doc',version:2,content:'new'},acknowledgement:null}
 const f={task,observation,allowed:true,closed:0,locked:false,beforeLock:()=>{},cas:true}
 const store={find:async(id,user,project)=>id==='t'&&user==='u'&&project==='p'?structuredClone(task):null,closeUnconfirmed:async(t,p,d)=>{
  assert.equal(f.locked,true)
  if(!f.cas)return false
  task.proposals[0].status='closed-unconfirmed';task.proposals[0].applicationDisposition=d;f.closed++;return true
 }}
 f.close=createApplicationDisposition({canWrite:async()=>f.allowed,store,inspect:async()=>structuredClone(observation),withApplicationLock:async(id,action)=>{assert.equal(id,'root');f.beforeLock();f.locked=true;try{return await action()}finally{f.locked=false}}})
 f.input={fingerprint:inspectionFingerprint(observation),decision:'close-without-retry'}
 f.run=()=>f.close('u','p','t','q',f.input)
 return f
}
test('manual closure records unconfirmed outcome and immutable observation without claiming acceptance',async()=>{
 const f=fixture();const result=await f.run();const p=result.proposals[0]
 assert.equal(p.status,'closed-unconfirmed');assert.equal(p.applicationDisposition.outcome,'unconfirmed');assert.equal(p.applicationDisposition.replayAllowed,false)
 assert.equal(p.before,'old');assert.equal(p.after,'new');assert.deepEqual(p.applicationDisposition.observation,f.observation)
 await f.run();assert.equal(f.closed,1)
})
for(const field of ['content','version','id'])test(`stale reviewed ${field} prevents closure`,async()=>{
 const f=fixture();f.observation.current[field]=field==='version'?3:'changed'
 await assert.rejects(f.run(),{status:409});assert.equal(f.closed,0)
})
test('changed workspace and newly recorded acknowledgement require new decision',async()=>{
 const f=fixture();f.observation.workspace.current.epoch++
 await assert.rejects(f.run(),{status:409});assert.equal(f.closed,0)
 const g=fixture();g.observation.acknowledgement={state:'server-acknowledged'}
 await assert.rejects(g.run(),{status:409});assert.equal(g.closed,0)
})
test('permission revocation while queued and another owner are refused',async()=>{
 const f=fixture();f.beforeLock=()=>{f.allowed=false}
 await assert.rejects(f.run(),{status:403});assert.equal(f.closed,0)
 const g=fixture();await assert.rejects(g.close('other','p','t','q',g.input),{status:404})
})
for(const change of [f=>{f.task.proposals[0].mode='delete-document'},f=>{f.task.proposals[0].status='accepted'},f=>{f.task.status='running'},f=>{f.cas=false}])test('ineligible or racing task never closes',async()=>{
 const f=fixture();change(f);await assert.rejects(f.run(),{status:409});assert.equal(f.closed,0)
})
test('review timestamp does not invalidate identical inspection but evidence does',()=>{
 const f=fixture();assert.equal(inspectionFingerprint({...f.observation,checkedAt:'later'}),f.input.fingerprint)
 assert.notEqual(inspectionFingerprint({...f.observation,proposed:{content:'different'}}),f.input.fingerprint)
})
test('closure requires explicit decision and fingerprint',async()=>{
 const f=fixture();f.input.decision='accept';await assert.rejects(f.run(),{status:400});assert.equal(f.closed,0)
})
