import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { createSessionRecoveryService } from '../../app/src/Features/NativeGit/SessionRecoveryService.mjs'

async function fixture(t) {
 const root=await mkdtemp(Path.join(tmpdir(),'session-recovery-'))
 t.after(()=>rm(root,{recursive:true,force:true}))
 const f={root,id:randomUUID(),current:7,advances:0,reads:0,notifications:[],held:false,fail:'',text:'accepted edit'}
 f.store=new CollaborationTaskStore(Path.join(root,'tasks'))
 const active=async()=>assert.equal(f.held,true)
 f.recover=createSessionRecoveryService({projectId:'a'.repeat(24),store:f.store,snapshotsDirectory:Path.join(root,'snapshots'),
  withLock:action=>action(),withExclusiveWrite:async action=>{f.held=true;try{return await action({assertActive:active,writeToken:'lease'})}finally{f.held=false}},
  readSnapshot:async()=>{await active();f.reads++;return {files:new Map([['main.tex',Buffer.from(f.text)]]),entries:new Map([['main.tex',{id:'doc',version:f.reads}]]),folders:new Map()}},
  epoch:{read:async()=>f.current,advance:async expected=>{await active();assert.equal(expected,f.current);if(f.fail==='before-cas')throw Error('before CAS');f.current++;f.advances++;if(f.fail==='publish')throw Error('publish failed');return f.current},hydrate:async()=>{await active();if(f.fail==='hydrate')throw Error('hydrate failed');return f.current}},
  recoverMembership:async request=>{await active();assert.equal(request.nextEpoch,f.current);if(f.fail==='membership')throw Error('membership failed')},
  beforeResolve:async()=>{await active();if(f.fail==='link')throw Error('merge journal link failed')},
  notify:async value=>{assert.equal(f.held,false);f.notifications.push(value)},
 })
 f.snapshot=task=>readFile(Path.join(root,'snapshots',f.id,String(task.snapshotRevision),'main.tex'),'utf8')
 return f
}
test('recovery snapshots accepted edits and completes once under the write lease',async t=>{
 const f=await fixture(t),task=await f.recover(f.id)
 assert.equal(task.state,'resolved');assert.equal(await f.snapshot(task),'accepted edit')
 assert.deepEqual(f.notifications,[8]);assert.equal(f.advances,1)
 await f.recover(f.id);assert.equal(f.advances,1);assert.equal(f.reads,1)
})
test('database advancement followed by publish failure resumes without a second increment',async t=>{
 const f=await fixture(t);f.fail='publish'
 await assert.rejects(f.recover(f.id),/publish failed/)
 assert.equal((await f.store.read(f.id)).state,'pending');assert.equal(f.current,8)
 f.fail='';await f.recover(f.id)
 assert.equal(f.advances,1);assert.equal(f.reads,1);assert.deepEqual(f.notifications,[8])
})
test('failure before database advancement snapshots newer edits on retry and retains old snapshot',async t=>{
 const f=await fixture(t);f.fail='before-cas';await assert.rejects(f.recover(f.id),/before CAS/)
 const original=await f.store.read(f.id)
 f.text='newer accepted edit';f.fail='';const task=await f.recover(f.id)
 assert.equal(await f.snapshot(original),'accepted edit');assert.equal(await f.snapshot(task),'newer accepted edit')
 assert.equal(f.advances,1)
})
test('lost membership rebuild leaves a resumable journal and refuses overlapping recovery',async t=>{
 const f=await fixture(t);f.fail='membership';await assert.rejects(f.recover(f.id),/membership failed/)
 await assert.rejects(f.recover(randomUUID()),/existing session recovery/)
 f.fail='';await f.recover(f.id);assert.equal(f.advances,1)
})
test('corrupted durable snapshot blocks retry after advancement',async t=>{
 const f=await fixture(t);f.fail='membership';await assert.rejects(f.recover(f.id),/membership failed/)
 const task=await f.store.read(f.id)
 await writeFile(Path.join(f.root,'snapshots',f.id,String(task.snapshotRevision),'main.tex'),'corrupted')
 f.fail='';await assert.rejects(f.recover(f.id),/snapshot changed/)
 assert.equal((await f.store.read(f.id)).state,'pending');assert.equal(f.advances,1)
})
test('a later unrelated epoch cannot be reconciled by this recovery',async t=>{
 const f=await fixture(t);f.fail='membership';await assert.rejects(f.recover(f.id),/membership failed/)
 f.current=9;f.fail='';await assert.rejects(f.recover(f.id),/advanced beyond/)
 assert.equal(f.advances,1)
})

test('merge journal link failure keeps session recovery pending until retry',async t=>{
 const f=await fixture(t);f.fail='link'
 await assert.rejects(f.recover(f.id),/merge journal link failed/)
 assert.equal((await f.store.read(f.id)).state,'pending')
 f.fail='';assert.equal((await f.recover(f.id)).state,'resolved')
 assert.equal(f.advances,1);assert.equal(f.reads,1)
})
