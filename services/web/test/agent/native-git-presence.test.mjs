import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import Redis from 'ioredis'
const {default:module}=await import(process.env.PRESENCE_MODULE || '@overleaf/redis-wrapper/GitPresenceStore.js')
const {createGitPresenceStore,keyFor}=module
const url=process.env.NATIVE_GIT_TEST_REDIS_URL
async function fixture(t){
 const client=new Redis(url),other=new Redis(url),project=randomBytes(12).toString('hex')
 t.after(async()=>{await client.del(keyFor(project));await Promise.all([client.quit(),other.quit()])})
 const value={sessionId:'tabA',userId:'a'.repeat(24),workspaceId:'b'.repeat(24),epoch:1,sequence:1,displayName:'Author',branch:'unpublished-topic',head:'c'.repeat(40),dirty:true,viewedCommit:null}
 return {client,project,value,store:createGitPresenceStore(client),other:createGitPresenceStore(other)}
}
test('same user tabs retain independent editing and viewing positions across workers',{skip:!url},async t=>{
 const f=await fixture(t)
 await f.store.update(f.project,{...f.value,email:'private',text:'manuscript'})
 const result=await f.other.update(f.project,{...f.value,sessionId:'tabB',workspaceId:'d'.repeat(24),branch:'main',viewedCommit:'e'.repeat(40)})
 assert.equal(result.sessions.length,2);assert.equal(result.revision,2)
 assert.equal(result.sessions[0].branch,'unpublished-topic');assert.equal(result.sessions[1].viewedCommit,'e'.repeat(40))
 assert.equal('email' in result.sessions[0],false);assert.equal('text' in result.sessions[0],false)
})
test('out-of-order positions cannot restore older state or refresh its heartbeat',{skip:!url},async t=>{
 const f=await fixture(t)
 const newer=await f.store.update(f.project,{...f.value,sequence:3,branch:'newer'})
 const stale=await f.other.update(f.project,{...f.value,sequence:2})
 assert.equal(stale.accepted,false);assert.equal(stale.revision,newer.revision)
 assert.deepEqual(stale.sessions,newer.sessions)
})
test('disconnect tombstones prevent late first or subsequent updates resurrecting users',{skip:!url},async t=>{
 const f=await fixture(t)
 await f.store.leave(f.project,'tabA')
 assert.equal((await f.other.update(f.project,f.value)).accepted,false)
 await f.store.update(f.project,{...f.value,sessionId:'tabB'})
 await f.other.leave(f.project,'tabB')
 const result=await f.store.update(f.project,{...f.value,sessionId:'tabB',sequence:8})
 assert.equal(result.accepted,false);assert.equal(result.sessions[0].online,false)
})
test('timeout marks offline while preserving last-seen position, retention removes it',{skip:!url},async t=>{
 const f=await fixture(t);await f.store.update(f.project,f.value)
 const item=JSON.parse(await f.client.hget(keyFor(f.project),'tabA'))
 item.lastSeen=Date.now()-120000
 await f.client.hset(keyFor(f.project),'tabA',JSON.stringify(item))
 const offline=await f.store.snapshot(f.project)
 assert.equal(offline.sessions[0].online,false);assert.equal(offline.sessions[0].lastSeen,item.lastSeen)
 assert.equal(offline.revision,2)
 item.lastSeen=1;await f.client.hset(keyFor(f.project),'tabA',JSON.stringify(item))
 const expired=await f.store.snapshot(f.project);assert.deepEqual(expired.sessions,[]);assert.equal(expired.revision,3)
})
test('Redis loss changes snapshot generation instead of reusing an old revision cursor',{skip:!url},async t=>{
 const f=await fixture(t),before=await f.store.update(f.project,f.value)
 await f.client.del(keyFor(f.project))
 const after=await f.other.snapshot(f.project)
 assert.notEqual(after.generation,before.generation);assert.equal(after.revision,0);assert.deepEqual(after.sessions,[])
})

test('capacity refusal does not prune or silently mutate snapshot revision',{skip:!url},async t=>{
 const f=await fixture(t);await f.store.update(f.project,f.value)
 const item=JSON.parse(await f.client.hget(keyFor(f.project),'tabA'))
 for(let i=0;i<999;i++)await f.client.hset(keyFor(f.project),'full'+i,JSON.stringify({...item,sessionId:'full'+i}))
 await assert.rejects(f.store.update(f.project,{...f.value,sessionId:'overflow'}),/GIT_PRESENCE_LIMIT/)
 assert.equal(await f.client.hlen(keyFor(f.project)),1002)
 assert.equal(await f.client.hget(keyFor(f.project),'__revision'),'1')

})

// A reconnect must not require an already-online client to prune the store first.
test('fresh connection prunes expired capacity without a preceding snapshot',{skip:!url},async t=>{
 const f=await fixture(t);await f.store.update(f.project,f.value)
 const item=JSON.parse(await f.client.hget(keyFor(f.project),'tabA'))
 for(let i=0;i<999;i++)await f.client.hset(keyFor(f.project),'old'+i,JSON.stringify({...item,sessionId:'old'+i,lastSeen:1}))
 const result=await f.store.update(f.project,{...f.value,sessionId:'reconnected'})
 assert.equal(result.accepted,true)
 assert.equal(result.revision,2)
 assert.deepEqual(result.sessions.map(s=>s.sessionId),['reconnected','tabA'])
})

test('read-only viewing capability survives storage without exposing document text',{skip:!url},async t=>{
 const f=await fixture(t)
 const result=await f.store.update(f.project,{...f.value,readOnly:true,viewedCommit:'e'.repeat(40),text:'not public'})
 assert.equal(result.sessions[0].readOnly,true);assert.equal(result.sessions[0].viewedCommit,'e'.repeat(40));assert.equal('text' in result.sessions[0],false)
 await assert.rejects(f.store.update(f.project,{...f.value,readOnly:'true'}),/Invalid verified presence/)
})
