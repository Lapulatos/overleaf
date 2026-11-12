import test from 'node:test'
import assert from 'node:assert/strict'
import { createGitPresenceSession } from '../../../real-time/app/js/GitPresenceSession.js'
const pending=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function fixture(resolvePosition){
 const events=[],project='a'.repeat(24),position={userId:'user',workspaceId:'workspace',logicalProjectId:project,branch:'topic',viewedCommit:null}
 const session=createGitPresenceSession({sessionId:'socketA',userId:'user',workspaceId:'workspace',resolvePosition:resolvePosition|| (async()=>position),
  store:{update:async(p,v)=>{events.push(['update',v]);return {revision:v.sequence}},snapshot:async()=>{events.push(['snapshot']);return {revision:99}},leave:async()=>{events.push(['leave']);return {revision:100}}},
  subscribe:async()=>events.push(['subscribe']),unsubscribe:async()=>events.push(['unsubscribe']),publish:async(p,v)=>events.push(['publish',v])})
 return {events,session,position}
}
test('derives position from trusted resolver and subscribes before snapshot',async()=>{
 const f=fixture();await f.session.update({viewedCommit:'b'.repeat(40)})
 assert.deepEqual(f.events.map(e=>e[0]),['subscribe','update','publish','snapshot'])
 assert.equal(f.events[1][1].branch,'topic');assert.equal(f.events[1][1].sessionId,'socketA')
 assert.equal(f.events[1][1].viewedCommit,null)
 await assert.rejects(f.session.update({userId:'forged'}),/Invalid/)
})
test('late async position cannot replace a newer history viewing intent',async()=>{
 const first=pending(),second=pending();let calls=0
 const f=fixture(()=>++calls===1?first.promise:second.promise)
 const one=f.session.update(),two=f.session.update()
 second.resolve({...f.position,branch:'new'});await two
 first.resolve({...f.position,branch:'old'});assert.equal(await one,null)
 assert.equal(f.events.filter(e=>e[0]==='update').length,1)
 assert.equal(f.events.find(e=>e[0]==='update')[1].branch,'new')
})
test('disconnect during position lookup never registers or subscribes',async()=>{
 const lookup=pending(),f=fixture(()=>lookup.promise),update=f.session.update()
 await f.session.close();lookup.resolve(f.position);assert.equal(await update,null)
 assert.deepEqual(f.events,[]);await assert.rejects(f.session.update(),/closed/)
})
test('permission revocation removes presence and subscription',async()=>{
 let deny=false;const f=fixture(async()=>{if(deny)throw Object.assign(Error('denied'),{status:403});return f.position})
 await f.session.update();deny=true;await assert.rejects(f.session.update(),/denied/)
 assert.deepEqual(f.events.slice(-3).map(e=>e[0]),['leave','publish','unsubscribe'])
 await assert.rejects(f.session.update(),/closed/)
})
test('transient resolver error does not falsely move or disconnect existing presence',async()=>{
 let fail=false;const f=fixture(async()=>{if(fail)throw Error('network');return f.position})
 await f.session.update();const count=f.events.length;fail=true
 await assert.rejects(f.session.update(),/network/);assert.equal(f.events.length,count)
 fail=false;await f.session.update();assert.equal(f.events.filter(e=>e[0]==='update').length,2)
})
test('disconnect while room subscription is pending leaves the room after it completes',async()=>{
 const join=pending(),events=[]
 const session=createGitPresenceSession({sessionId:'socket',userId:'u',workspaceId:'w',
  resolvePosition:async()=>({userId:'u',workspaceId:'w',logicalProjectId:'a'.repeat(24)}),
  store:{leave:async()=>{events.push('leave');return {}},update:async()=>{throw Error('must not update')},snapshot:async()=>{}},
  subscribe:async()=>{events.push('subscribe');await join.promise},unsubscribe:async()=>events.push('unsubscribe'),publish:async()=>events.push('publish')})
 const updating=session.update()
 while(!events.length)await Promise.resolve()
 const closing=session.close();join.resolve()
 await Promise.all([updating,closing])
 assert.deepEqual(events,['subscribe','leave','publish','unsubscribe'])
})
