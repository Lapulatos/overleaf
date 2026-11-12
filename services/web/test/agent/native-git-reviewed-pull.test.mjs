import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareReviewedPull } from '../../app/src/Features/NativeGit/ReviewedPull.mjs'
const oid = 'a'.repeat(40), operationId = '11111111-1111-4111-8111-111111111111'
const command = { remote: 'origin', branch: 'paper/topic', operationId }
function fixture() {
 const calls=[]
 return { calls, options: { command, authorize: async()=>calls.push('authorize'),
 discover: async request=>{calls.push(request);return {state:'fetched',after:{'refs/remotes/origin/paper/topic':oid}}},
 prepare: async request=>{calls.push(request);return {id:operationId,state:'conflicted'}} } }
}
test('pull pins fetched commit and returns shared review without applying documents',async()=>{
 const {calls,options}=fixture()
 assert.equal((await prepareReviewedPull(options)).state,'conflicted')
 assert.deepEqual(calls,['authorize',{remote:'origin',operationId},'authorize',{operationId,ref:'refs/remotes/origin/paper/topic',expectedSourceOid:oid}])
})
test('revocation during fetch prevents preparing a merge',async()=>{
 const {options}=fixture();let n=0
 options.authorize=async()=>{if(++n===2)throw Object.assign(Error('revoked'),{status:403})}
 options.prepare=async()=>assert.fail('must not prepare')
 await assert.rejects(prepareReviewedPull(options),{status:403})
})
test('deleted or incomplete remote snapshot cannot prepare a merge',async()=>{
 for(const snapshot of [{state:'fetched',after:{}},{state:'fetching',after:{'refs/remotes/origin/paper/topic':oid}}]){
 const {options}=fixture();options.discover=async()=>snapshot;options.prepare=async()=>assert.fail('must not prepare')
 await assert.rejects(prepareReviewedPull(options),{status:409})
 }
})
test('collaborative rebase is refused before fetching',async()=>{
 const {options,calls}=fixture();options.command={...command,rebase:true}
 await assert.rejects(prepareReviewedPull(options),{status:409});assert.deepEqual(calls,[])
})
