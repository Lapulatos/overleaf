import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ProjectDeletion } from '../../app/src/Features/NativeGit/ProjectDeletion.mjs'
function fixture() {
 let task = { id:'operation', actorId:'owner', revision:1, state:'planned', workspaceIds:['child','parent'], completedSteps:[] }
 const frozen = new Set(), removed = new Set(), calls = []
 const a = {
  resources:['documents','history','project'], lock:async(id,fn)=>fn(), read:async()=>structuredClone(task), save:async t=>{task=structuredClone(t)},
  authorize:async(t,actor)=>{if(t.actorId!==actor)throw Object.assign(Error('forbidden'),{status:403})},
  verifyRetainedBackup:async()=>{calls.push('verify-backup')}, verifyInventory:async()=>{},
  freeze:async(t,id)=>{calls.push(`freeze:${id}`);frozen.add(id)},
  unfreeze:async(t,id)=>{calls.push(`unfreeze:${id}`);frozen.delete(id)},
  assertAllFrozen:async()=>{assert.equal(frozen.size,2)}, verifySnapshot:async()=>{calls.push('verify-snapshot')},
  retainPrivateRecords:async()=>{calls.push('private-records')},
  remove:async(t,id,resource)=>{assert.equal(task.state,'deleting');calls.push(`remove:${id}:${resource}`);removed.add(`${id}:${resource}`)},
  removeRepository:async()=>{calls.push('repository')},
 }
 return {a,calls,frozen,removed,service:new ProjectDeletion(a),read:()=>task}
}
test('both workspaces and private records are protected before first removal',async()=>{
 const f=fixture();await f.service.run('operation','owner')
 assert.equal(f.read().state,'completed');assert.equal(f.removed.size,6)
 assert.ok(f.calls.indexOf('private-records')<f.calls.indexOf('remove:child:documents'))
 const before=f.calls.length;await f.service.run('operation','owner');assert.equal(f.calls.length,before)
})
test('snapshot or retained-backup mismatch cannot remove anything; reversible freeze can be cancelled',async()=>{
 for(const phase of ['verifyRetainedBackup','verifySnapshot','retainPrivateRecords']) {
  const f=fixture();f.a[phase]=async()=>{throw Error('changed')}
  await assert.rejects(f.service.run('operation','owner'),/changed/);assert.equal(f.removed.size,0)
  await f.service.cancel('operation','owner');assert.equal(f.read().state,'cancelled');assert.equal(f.frozen.size,0)
 }
})
test('lost service response resumes the same resource and never re-enumerates source',async()=>{
 const f=fixture(),remove=f.a.remove;let fail=true
 f.a.remove=async(...args)=>{await remove(...args);if(fail){fail=false;throw Error('response lost')}}
 await assert.rejects(f.service.run('operation','owner'),/response lost/)
 assert.equal(f.read().state,'deleting')
 f.a.verifyInventory=async()=>assert.fail('must not change persisted inventory')
 await assert.rejects(f.service.cancel('operation','owner'),{status:409})
 await f.service.run('operation','owner');assert.equal(f.read().state,'completed');assert.equal(f.removed.size,6)
})
test('revoked access and newly damaged retained backup stop resumed destructive work',async()=>{
 const f=fixture(),remove=f.a.remove
 f.a.remove=async(...args)=>{await remove(...args);throw Error('interrupted')}
 await assert.rejects(f.service.run('operation','owner'))
 const count=f.calls.length;await assert.rejects(f.service.run('operation','editor'),{status:403});assert.equal(f.calls.length,count)
 f.a.verifyRetainedBackup=async()=>{throw Error('corrupt backup')}
 const before=f.removed.size;await assert.rejects(f.service.run('operation','owner'),/corrupt backup/);assert.equal(f.removed.size,before)
})
