import test from 'node:test'
import assert from 'node:assert/strict'
import { createGitPresenceHandler } from '../../app/src/Features/NativeGit/GitPresenceHandlers.mjs'
function fixture(options={}){
 const calls=[],headers={},req={params:{Project_id:'A'.repeat(24)},body:{userId:'B'.repeat(24)}}
 const res={statusCode:200,status(code){this.statusCode=code;return this},sendStatus(code){this.statusCode=code},set(key,value){headers[key]=value},json(body){this.body=body}}
 const handler=createGitPresenceHandler({enabled:()=>true,runtime:{presencePosition:async(...args)=>{calls.push(args);return {branch:'topic'}}},...options})
 return {calls,headers,req,res,run:()=>handler(req,res)}
}
test('private presence handler normalizes identity and forwards only verified intent',async()=>{
 const f=fixture();await f.run();assert.equal(f.res.statusCode,200)
 assert.deepEqual(f.calls,[['a'.repeat(24),'b'.repeat(24),null]])
 assert.equal(f.headers['Cache-Control'],'no-store')
})
test('forged session, branch, epoch and malformed identities do not reach runtime',async()=>{
 for(const extra of [{sessionId:'fake'},{branch:'main'},{epoch:9},{userId:'bad'},{viewedCommit:'HEAD'}]){
  const f=fixture();Object.assign(f.req.body,extra);await f.run()
  assert.equal(f.res.statusCode,400);assert.equal(f.calls.length,0)
 }
})
test('feature disablement and revoked membership are explicit refusals',async()=>{
 const disabled=fixture({enabled:()=>false});await disabled.run();assert.equal(disabled.res.statusCode,404)
 const denied=fixture({runtime:{presencePosition:async()=>{throw Object.assign(Error('revoked'),{status:403})}}})
 await denied.run();assert.equal(denied.res.statusCode,403);assert.equal(denied.res.body.error,'revoked')
})
