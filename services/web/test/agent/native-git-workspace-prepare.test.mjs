import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import Redis from 'ioredis'
const {default:module}=await import(process.env.PREPARE_GATE_MODULE || '@overleaf/redis-wrapper/WorkspacePrepareGate.js')
const {createWorkspacePrepareGate,keyFor,sessionsKey}=module
const url=process.env.NATIVE_GIT_TEST_REDIS_URL
async function fixture(t){
 const client=new Redis(url),other=new Redis(url),project=randomBytes(12).toString('hex'),id=randomUUID()
 t.after(async()=>{await client.del(`native-git:project-write:${project}`,keyFor(project),sessionsKey(project),`native-git:workspace-epoch:${project}`);await Promise.all([client.quit(),other.quit()])})
 return {client,project,id,epoch:7,gate:createWorkspacePrepareGate(client),other:createWorkspacePrepareGate(other)}
}
test('all authenticated session acknowledgements are required across independent workers',{skip:!url},async t=>{
 const f=await fixture(t)
 await f.gate.begin(f.project,{...f,sessions:['A','B']})
 await assert.rejects(f.other.claim(f.project,f),/NOT_READY/)
 await f.gate.acknowledge(f.project,{...f,session:'A',saved:true})
 await assert.rejects(f.other.claim(f.project,f),/NOT_READY/)
 await assert.rejects(f.other.acknowledge(f.project,{...f,session:'D',saved:true}),/NOT_MEMBER/)
 await f.other.acknowledge(f.project,{...f,session:'B',saved:true})
 const results=await Promise.allSettled([f.gate.claim(f.project,f),f.other.claim(f.project,f)])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 await assert.rejects(f.other.acknowledge(f.project,{...f,session:'A',saved:true}),/CLOSED/)
})
test('disconnect or unsaved rejection cannot be undone by a delayed success',{skip:!url},async t=>{
 const f=await fixture(t);await f.gate.begin(f.project,{...f,sessions:['A']})
 await f.gate.acknowledge(f.project,{...f,session:'A',saved:false})
 await f.other.acknowledge(f.project,{...f,session:'A',saved:true})
 await assert.rejects(f.gate.claim(f.project,f),/NOT_READY/)
})
test('old operation and old epoch acknowledgements cannot release a new preparation',{skip:!url},async t=>{
 const f=await fixture(t);await f.gate.begin(f.project,{...f,sessions:['A']})
 await assert.rejects(f.gate.begin(f.project,{...f,id:randomUUID(),sessions:['A']}),/BUSY/)
 await assert.rejects(f.gate.acknowledge(f.project,{...f,epoch:6,session:'A',saved:true}),/STALE/)
 assert.equal(await f.gate.cancel(f.project,randomUUID()),false)
 assert.equal(await f.gate.cancel(f.project,f.id),true)
 const old=f.id;f.id=randomUUID();await f.other.begin(f.project,{...f,sessions:['A']})
 await assert.rejects(f.gate.acknowledge(f.project,{...f,id:old,session:'A',saved:true}),/STALE/)
 assert.equal(await f.gate.cancel(f.project,old),false)
})
test('deadline and Redis loss fail closed rather than treating missing acknowledgements as success',{skip:!url},async t=>{
 const f=await fixture(t);await f.gate.begin(f.project,{...f,sessions:['A']})
 // Set an elapsed server deadline deterministically rather than sleeping.
 const record=JSON.parse(await f.client.get(keyFor(f.project)));record.deadline=1
 await f.client.set(keyFor(f.project),JSON.stringify(record))
 await assert.rejects(f.gate.claim(f.project,f),/EXPIRED/)
 await assert.rejects(f.gate.acknowledge(f.project,{...f,session:'A',saved:true}),/EXPIRED/)
 await f.client.del(keyFor(f.project));await assert.rejects(f.gate.claim(f.project,f),/MISSING/)
})

async function initialized(f){
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch)
 await f.gate.initialize(f.project,f.epoch)
}
test('registration and preparation snapshot are atomic across workers',{skip:!url},async t=>{
 const f=await fixture(t);await initialized(f)
 await f.gate.register(f.project,f.epoch,'A')
 const results=await Promise.allSettled([f.gate.beginRegistered(f.project,f),f.other.register(f.project,f.epoch,'B')])
 assert.equal(results[0].status,'fulfilled')
 const record=results[0].value
 if(results[1].status==='fulfilled')assert.equal(record.members.B,'pending')
 else assert.match(results[1].reason.message,/BUSY/)
 assert.equal(record.members.A,'pending')
 await assert.rejects(f.other.register(f.project,f.epoch,'C'),/BUSY/)
})
test('disconnect invalidates an already saved participant instead of shrinking expected membership',{skip:!url},async t=>{
 const f=await fixture(t);await initialized(f);await f.gate.register(f.project,f.epoch,'A')
 await f.gate.beginRegistered(f.project,f);await f.gate.acknowledge(f.project,{...f,session:'A',saved:true})
 await f.other.leave(f.project,'A');await assert.rejects(f.gate.claim(f.project,f),/NOT_READY/)
})
test('missing membership never means that no users need to save',{skip:!url},async t=>{
 const f=await fixture(t)
 await assert.rejects(f.gate.beginRegistered(f.project,f),/UNAVAILABLE/)
 await assert.rejects(f.gate.register(f.project,f.epoch,'A'),/UNAVAILABLE/)
 await initialized(f);await f.gate.beginRegistered(f.project,f)
 await f.client.del(sessionsKey(f.project));await assert.rejects(f.gate.claim(f.project,f),/UNAVAILABLE/)
})
test('older workspace registrations and implicit generation reinitialization are refused',{skip:!url},async t=>{
 const f=await fixture(t);await initialized(f)
 await assert.rejects(f.gate.register(f.project,f.epoch-1,'A'),/UNAVAILABLE/)
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch+1)
 await assert.rejects(f.gate.initialize(f.project,f.epoch+1),/REINITIALIZATION_REQUIRED/)
})

async function claimed(f){
 await initialized(f);await f.gate.register(f.project,f.epoch,'A')
 await f.gate.beginRegistered(f.project,f)
 await f.gate.acknowledge(f.project,{...f,session:'A',saved:true})
 await f.gate.claim(f.project,f)
}
test('claimed preparation is invalidated by disconnect before application',{skip:!url},async t=>{
 const f=await fixture(t);await claimed(f)
 await f.other.assertClaimed(f.project,f)
 await f.other.leave(f.project,'A')
 await assert.rejects(f.gate.assertClaimed(f.project,f),/NOT_READY/)
})
test('late negative acknowledgement revokes a claim; success cannot restore it',{skip:!url},async t=>{
 const f=await fixture(t);await claimed(f)
 await f.other.acknowledge(f.project,{...f,session:'A',saved:false})
 await assert.rejects(f.gate.acknowledge(f.project,{...f,session:'A',saved:true}),/CLOSED/)
 await assert.rejects(f.gate.assertClaimed(f.project,f),/NOT_READY/)
})
test('epoch mirror loss or advancement prevents both claim and application',{skip:!url},async t=>{
 const f=await fixture(t);await claimed(f)
 await f.client.del(`native-git:workspace-epoch:${f.project}`)
 await assert.rejects(f.gate.assertClaimed(f.project,f),/STALE/)
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch+1)
 await assert.rejects(f.gate.assertClaimed(f.project,f),/STALE/)
 await f.gate.cancel(f.project,f.id)
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch)
 await f.gate.beginRegistered(f.project,f)
 await f.gate.acknowledge(f.project,{...f,session:'A',saved:true})
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch+1)
 await assert.rejects(f.gate.claim(f.project,f),/STALE/)
})
test('application recheck rejects expired and cancelled claims',{skip:!url},async t=>{
 const f=await fixture(t);await claimed(f)
 const record=JSON.parse(await f.client.get(keyFor(f.project)));record.deadline=1
 await f.client.set(keyFor(f.project),JSON.stringify(record))
 await assert.rejects(f.gate.assertClaimed(f.project,f),/EXPIRED/)
 await f.gate.cancel(f.project,f.id)
 await assert.rejects(f.gate.assertClaimed(f.project,f),/MISSING/)
})

if (process.env.PREPARATION_MODULE) {
 const { createWorkspacePreparation } = await import(process.env.PREPARATION_MODULE)
 test('orchestrator waits for two independent session confirmations before exclusive action',{skip:!url},async t=>{
  const f=await fixture(t);await initialized(f)
  await f.gate.register(f.project,f.epoch,'A');await f.other.register(f.project,f.epoch,'B')
  const events=[];let locked=false
  const run=createWorkspacePreparation({gate:f.gate,
   emit:async(project,event,value)=>{
    events.push(event)
    if(event==='nativeGitPrepare'){
     assert.equal(locked,false)
     await f.gate.acknowledge(project,{...value,session:'A',saved:true})
     await assert.rejects(f.gate.claim(project,value),/NOT_READY/)
     await f.other.acknowledge(project,{...value,session:'B',saved:true})
    }
   },
   withExclusiveWrite:async(project,action)=>{locked=true;try{return await action(async()=>assert.equal(locked,true))}finally{locked=false}}
  })
  const result=await run(f.project,f.epoch,async check=>{await check();return 'applied'})
  assert.equal(result,'applied');assert.equal(locked,false)
  assert.deepEqual(events,['nativeGitPrepare','nativeGitPrepareFinished'])
  assert.equal(await f.client.get(keyFor(f.project)),null)
  await f.other.register(f.project,f.epoch,'C')
 })
 test('disconnect between confirmation and lease prevents orchestrated application',{skip:!url},async t=>{
  const f=await fixture(t);await initialized(f);await f.gate.register(f.project,f.epoch,'A')
  const events=[]
  const run=createWorkspacePreparation({gate:f.gate,
   emit:async(project,event,value)=>{events.push(event);if(event==='nativeGitPrepare')await f.other.acknowledge(project,{...value,session:'A',saved:true})},
   withExclusiveWrite:async(project,action)=>{await f.other.leave(project,'A');return action(async()=>{})}
  })
  await assert.rejects(run(f.project,f.epoch,()=>assert.fail('must not apply')),/NOT_READY/)
  assert.equal(await f.client.get(keyFor(f.project)),null)
  assert.deepEqual(events,['nativeGitPrepare','nativeGitPrepareFinished'])
 })
}

test('prepared epoch transition removes old membership and admits only the new epoch after release',{skip:!url},async t=>{
 const f=await fixture(t);await claimed(f)
 await assert.rejects(f.gate.advanceMembership(f.project,f,f.epoch+1),/STALE/)
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch+1)
 await f.gate.advanceMembership(f.project,f,f.epoch+1)
 await f.other.assertClaimed(f.project,f)
 await f.other.advanceMembership(f.project,f,f.epoch+1)
 assert.deepEqual(await f.client.hgetall(sessionsKey(f.project)),{__epoch:String(f.epoch+1)})
 await assert.rejects(f.gate.register(f.project,f.epoch+1,'B'),/BUSY/)
 await f.gate.cancel(f.project,f.id)
 await assert.rejects(f.gate.register(f.project,f.epoch,'A'),/UNAVAILABLE/)
 await f.gate.register(f.project,f.epoch+1,'B')
 await f.gate.leave(f.project,'A')
 assert.equal(await f.client.hget(sessionsKey(f.project),'B'),String(f.epoch+1))
})
test('epoch transition refuses foreign task, failed participant and missing registry',{skip:!url},async t=>{
 const f=await fixture(t);await claimed(f)
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch+1)
 await assert.rejects(f.gate.advanceMembership(f.project,{...f,id:randomUUID()},f.epoch+1),/STALE/)
 await assert.rejects(f.gate.advanceMembership(f.project,f,f.epoch+2),/Invalid/)
 await f.gate.leave(f.project,'A')
 await assert.rejects(f.gate.advanceMembership(f.project,f,f.epoch+1),/NOT_READY/)
 await f.client.del(sessionsKey(f.project))
 await assert.rejects(f.gate.advanceMembership(f.project,f,f.epoch+1),/UNAVAILABLE/)
})

async function recovering(f) {
 await initialized(f)
 await f.gate.register(f.project,f.epoch,'deadWorkerSession')
 await f.gate.beginRegistered(f.project,f)
 const writeToken=randomUUID()
 await f.client.set(`native-git:project-write:${f.project}`,writeToken,'PX',30000)
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch+1)
 return {epoch:f.epoch,nextEpoch:f.epoch+1,writeToken}
}
test('explicit recovery requires a currently owned write lease and advanced epoch',{skip:!url},async t=>{
 const f=await fixture(t),request=await recovering(f)
 await assert.rejects(f.gate.recoverMembership(f.project,{...request,writeToken:randomUUID()}),/PROJECT_WRITE_BUSY/)
 await f.client.set(`native-git:workspace-epoch:${f.project}`,f.epoch)
 await assert.rejects(f.gate.recoverMembership(f.project,request),/STALE/)
 assert.equal(await f.client.hget(sessionsKey(f.project),'deadWorkerSession'),String(f.epoch))
 await f.client.set(`native-git:workspace-epoch:${f.project}`,request.nextEpoch)
 await f.client.del(`native-git:project-write:${f.project}`)
 await assert.rejects(f.gate.recoverMembership(f.project,request),/PROJECT_WRITE_BUSY/)
 assert.ok(await f.client.get(keyFor(f.project)))
})
test('recovery fences old joins and retries preserve newly registered users',{skip:!url},async t=>{
 const f=await fixture(t),request=await recovering(f)
 const results=await Promise.allSettled([f.gate.recoverMembership(f.project,request),f.other.register(f.project,f.epoch,'lateOldSession')])
 assert.equal(results[0].value,true)
 assert.equal(results[1].status,'rejected')
 assert.equal(await f.client.get(keyFor(f.project)),null)
 await f.other.register(f.project,request.nextEpoch,'newSession')
 assert.equal(await f.gate.recoverMembership(f.project,request),false)
 assert.deepEqual(await f.client.hgetall(sessionsKey(f.project)),{__epoch:String(request.nextEpoch),newSession:String(request.nextEpoch)})
 await assert.rejects(f.other.acknowledge(f.project,{...f,session:'deadWorkerSession',saved:true}),/MISSING/)
})
test('recovery can rebuild lost membership but cannot erase a different generation',{skip:!url},async t=>{
 const f=await fixture(t),request=await recovering(f)
 await f.client.hset(sessionsKey(f.project),'__epoch',f.epoch-1)
 await assert.rejects(f.gate.recoverMembership(f.project,request),/REINITIALIZATION_REQUIRED/)
 await f.client.del(sessionsKey(f.project))
 assert.equal(await f.gate.recoverMembership(f.project,request),true)
 assert.deepEqual(await f.client.hgetall(sessionsKey(f.project)),{__epoch:String(request.nextEpoch)})
})
test('recovery refuses to cancel another generation preparation',{skip:!url},async t=>{
 const f=await fixture(t),request=await recovering(f)
 const record=JSON.parse(await f.client.get(keyFor(f.project)))
 record.epoch=request.nextEpoch
 await f.client.set(keyFor(f.project),JSON.stringify(record))
 await assert.rejects(f.gate.recoverMembership(f.project,request),/STALE/)
 assert.equal(await f.client.hget(sessionsKey(f.project),'deadWorkerSession'),String(f.epoch))
 assert.equal(JSON.parse(await f.client.get(keyFor(f.project))).epoch,request.nextEpoch)
})
