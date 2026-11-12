import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ShellDraftService, publicShellDraft } from '../../app/src/Features/NativeGit/ShellDraftService.mjs'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'

async function fixture(t) {
 const directory=await mkdtemp(Path.join(tmpdir(),'overleaf-shell-draft-'))
 t.after(()=>rm(directory,{recursive:true,force:true}))
 const files=new Map([['main.tex',Buffer.from('Original text')],['figures/data.bin',Buffer.from([0,255,1])]])
 const snapshot={files,entries:new Map([['main.tex',{type:'doc',id:'doc',version:7}],['figures/data.bin',{type:'file',id:'asset',hash:'a'.repeat(40)}]]),folders:new Map([['figures','folder']])}
 const f={directory,snapshot,allowed:true,epoch:2,reads:0,epochReads:0,locked:false,beforeLock:()=>{},onEpoch:()=>{},onRead:()=>{}}
 f.store=new CollaborationTaskStore(Path.join(directory,'records'))
 const options={root:Path.join(directory,'drafts'),store:f.store,project:{read:async()=>{f.reads++;f.onRead();return snapshot}},authorize:async()=>{if(!f.allowed)throw Object.assign(Error('denied'),{status:403})},readEpoch:async()=>{f.epochReads++;f.onEpoch();return f.epoch},withLock:async action=>{f.beforeLock();f.locked=true;try{return await action()}finally{f.locked=false}},logicalProjectId:'root',workspaceId:'workspace',actorId:'owner',minFreeBytes:0}
 f.service=new ShellDraftService(options);f.options=options;f.id=randomUUID()
 return f
}
test('draft bytes are independent from baseline and live snapshot; versions and binary assets retained',async t=>{
 const f=await fixture(t),task=await f.service.prepare(f.id),paths=f.service.paths(f.id)
 assert.equal(task.state,'ready');assert.equal(task.baseline.files.find(f=>f.path==='main.tex').version,7)
 await writeFile(Path.join(paths.workingDirectory,'main.tex'),'Shell edit')
 assert.equal((await readFile(Path.join(paths.baselineDirectory,'main.tex'))).toString(),'Original text')
 assert.equal(f.snapshot.files.get('main.tex').toString(),'Original text')
 assert.deepEqual((await f.service.baseline(f.id)).files.get('figures/data.bin'),Buffer.from([0,255,1]))
 assert.equal(publicShellDraft(task).workingDirectory,undefined)
 assert.equal(publicShellDraft(task).baseline,undefined)
})
test('repeated operation and service restart do not overwrite shell edits or create another snapshot',async t=>{
 const f=await fixture(t);await f.service.prepare(f.id)
 await writeFile(Path.join(f.service.paths(f.id).workingDirectory,'main.tex'),'Keep draft')
 f.snapshot.files.set('main.tex',Buffer.from('New editor text'))
 const restarted=new ShellDraftService(f.options)
 assert.equal((await restarted.prepare(f.id)).state,'ready');assert.equal(f.reads,1)
 assert.equal((await readFile(Path.join(restarted.paths(f.id).workingDirectory,'main.tex'))).toString(),'Keep draft')
})
test('epoch changing during snapshot creates no draft; changing during preparation retains recovery state',async t=>{
 const f=await fixture(t);f.onRead=()=>{f.epoch++}
 await assert.rejects(f.service.prepare(f.id),{status:409});await assert.rejects(f.store.read(f.id),{code:'ENOENT'})
 const g=await fixture(t);g.onEpoch=()=>{if(g.epochReads===3)g.epoch++}
 await assert.rejects(g.service.prepare(g.id),{status:409})
 assert.equal((await g.store.read(g.id)).state,'recovery-required')
 assert.equal((await g.service.prepare(g.id)).state,'recovery-required')
 assert.equal(g.reads,1)
 assert.equal((await readFile(Path.join(g.service.paths(g.id).baselineDirectory,'main.tex'))).toString(),'Original text')
})
test('revoked permission after lock wait or snapshot cannot prepare a usable draft',async t=>{
 const f=await fixture(t);f.beforeLock=()=>{f.allowed=false}
 await assert.rejects(f.service.prepare(f.id),{status:403});assert.equal(f.reads,0)
 const g=await fixture(t);g.onRead=()=>{g.allowed=false}
 await assert.rejects(g.service.prepare(g.id),{status:403});await assert.rejects(g.store.read(g.id),{code:'ENOENT'})
})
test('draft reads and lists are scoped to owner and workspace',async t=>{
 const f=await fixture(t);await f.service.prepare(f.id)
 for(const options of [{actorId:'other'},{workspaceId:'other'},{logicalProjectId:'other'}]){
  const other=new ShellDraftService({...f.options,...options})
  await assert.rejects(other.get(f.id),{status:403});await assert.rejects(other.prepare(f.id),{status:403});await assert.rejects(other.baseline(f.id),{status:403});assert.deepEqual(await other.list(),[])
 }
 assert.equal((await f.service.list()).length,1)
 f.allowed=false;await assert.rejects(f.service.list(),{status:403})
})
test('tampered baseline is refused, and a symlink collision never reaches its target',async t=>{
 const f=await fixture(t);await f.service.prepare(f.id)
 await writeFile(Path.join(f.service.paths(f.id).baselineDirectory,'main.tex'),'tampered')
 await assert.rejects(f.service.baseline(f.id),{status:409})
 const id=randomUUID();await symlink(f.directory,f.service.paths(id).directory)
 await assert.rejects(f.service.prepare(id),{code:'EEXIST'})
 assert.equal((await f.store.read(id)).state,'recovery-required')
 await assert.rejects(readFile(Path.join(f.directory,'work','main.tex')),{code:'ENOENT'})
})
test('capacity and workspace fencing checks fail before a draft record is admitted',async t=>{
 const f=await fixture(t);f.service.minFreeBytes=Number.MAX_SAFE_INTEGER
 await assert.rejects(f.service.prepare(f.id),{status:507});await assert.rejects(f.store.read(f.id),{code:'ENOENT'})
 f.service.minFreeBytes=0;f.epoch=null
 await assert.rejects(f.service.prepare(f.id),{status:409})
 for(const id of ['../escape','bad','/tmp/outside'])await assert.rejects(f.service.prepare(id),{status:400})
})

test('session attempt is durable before startup and review uses a sealed independent copy',async t=>{
 const f=await fixture(t);const ready=await f.service.prepare(f.id);let started=0,stopped=0
 f.service.terminal={start:async request=>{
  started++;const record=await f.store.read(f.id)
  assert.equal(record.state,'starting');assert.equal(record.sessionAttemptId,request.attemptId)
  assert.equal(request.directory,f.service.paths(f.id).workingDirectory)
  await writeFile(Path.join(request.directory,'main.tex'),'Shell result')
  return {attemptId:request.attemptId,sessionId:'session'}
 },stop:async request=>{stopped++;assert.equal((await f.store.read(f.id)).state,'stopping');return {attemptId:request.attemptId,quiescent:true}}}
 const running=await f.service.start(f.id,ready.revision,'workspace-write')
 await assert.rejects(f.service.start(f.id,running.revision,'workspace-write'),{status:409});assert.equal(started,1)
 const sealed=await f.service.seal(f.id,running.revision)
 assert.equal(sealed.state,'review-ready');assert.equal(stopped,1);assert.deepEqual(sealed.changedPaths,['main.tex'])
 await writeFile(Path.join(f.service.paths(f.id).workingDirectory,'main.tex'),'Later scratch modification')
 const review=await f.service.review(f.id);assert.equal(review.changes[0].after.toString(),'Shell result');assert.equal(review.changes[0].before.toString(),'Original text')
 assert.equal((await f.service.seal(f.id,sealed.revision)).revision,sealed.revision);assert.equal(stopped,1)
 await assert.rejects(f.service.start(f.id,sealed.revision,'full-access'),{status:409})
})
test('ambiguous startup is never replayed and can be stopped by persisted attempt after restart',async t=>{
 const f=await fixture(t),ready=await f.service.prepare(f.id);let attemptId,starts=0
 f.service.terminal={start:async request=>{starts++;attemptId=request.attemptId;throw Error('lost runner response')}}
 await assert.rejects(f.service.start(f.id,ready.revision,'full-access'),/lost runner response/)
 const failed=await f.store.read(f.id);assert.equal(failed.state,'recovery-required');assert.equal(failed.sessionAttemptId,attemptId)
 await assert.rejects(f.service.start(f.id,failed.revision,'full-access'),{status:409});assert.equal(starts,1)
 const restarted=new ShellDraftService({...f.options,terminal:{stop:async request=>{assert.equal(request.attemptId,attemptId);return {attemptId,quiescent:true}}}})
 assert.equal((await restarted.seal(f.id,failed.revision)).state,'review-ready')
})
for(const response of [{quiescent:false},{quiescent:true,attemptId:'wrong'}])test('unconfirmed or mismatched stop never admits a review snapshot',async t=>{
 const f=await fixture(t),ready=await f.service.prepare(f.id)
 f.service.terminal={start:async r=>({attemptId:r.attemptId,sessionId:'session'}),stop:async r=>({attemptId:r.attemptId,...response})}
 const running=await f.service.start(f.id,ready.revision,'read-only')
 await assert.rejects(f.service.seal(f.id,running.revision),{status:409})
 assert.equal((await f.store.read(f.id)).failurePhase,'stop')
 await assert.rejects(f.service.review(f.id),{status:409})
 await assert.rejects(readFile(Path.join(f.service.paths(f.id).reviewDirectory,'main.tex')),{code:'ENOENT'})
})
test('stopping stale epoch retains review on original identity but does not reopen shell',async t=>{
 const f=await fixture(t),ready=await f.service.prepare(f.id)
 f.service.terminal={start:async r=>({attemptId:r.attemptId,sessionId:'session'}),stop:async r=>({attemptId:r.attemptId,quiescent:true})}
 const running=await f.service.start(f.id,ready.revision,'auto-review');f.epoch++
 const sealed=await f.service.seal(f.id,running.revision)
 assert.equal(sealed.workspaceEpoch,2);assert.equal(sealed.reviewedEpoch,3)
 assert.equal((await f.service.review(f.id)).task.workspaceEpoch,2)
})
test('unsafe shell output and tampered review are refused without touching baseline',async t=>{
 const f=await fixture(t),ready=await f.service.prepare(f.id)
 await symlink('/tmp',Path.join(f.service.paths(f.id).workingDirectory,'escape'))
 await assert.rejects(f.service.seal(f.id,ready.revision),/symbolic link/)
 assert.equal((await f.store.read(f.id)).failurePhase,'seal')
 assert.equal((await f.service.baseline(f.id)).files.get('main.tex').toString(),'Original text')
 const g=await fixture(t),other=await g.service.prepare(g.id);await g.service.seal(g.id,other.revision)
 await writeFile(Path.join(g.service.paths(g.id).reviewDirectory,'main.tex'),'tampered')
 await assert.rejects(g.service.review(g.id),{status:409})
})

test('insufficient review capacity retains stopped draft and never reports review-ready',async t=>{
 const f=await fixture(t),ready=await f.service.prepare(f.id);f.service.minFreeBytes=Number.MAX_SAFE_INTEGER
 await assert.rejects(f.service.seal(f.id,ready.revision),{status:507})
 assert.equal((await f.store.read(f.id)).failurePhase,'seal')
 assert.equal((await readFile(Path.join(f.service.paths(f.id).workingDirectory,'main.tex'))).toString(),'Original text')
})

test('session controls bind private runner id and refuse foreign scope, stale epoch, policy change and stopped task',async t=>{
 const f=await fixture(t),sent=[]
 f.service.terminal={start:async body=>({attemptId:body.attemptId,sessionId:'private-session'}),session:async body=>{assert.equal(f.locked,true);sent.push(body);return {output:'ok'}}}
 let mode='workspace-write';f.service.readPermissionMode=async()=>mode
 const ready=await f.service.prepare(f.id),running=await f.service.start(f.id,ready.revision,mode)
 await f.service.session(f.id,'input',{input:'pwd\r',id:'spoof',actorId:'spoof',directory:'/host'})
 assert.deepEqual(sent[0],{action:'input',id:'private-session',logicalProjectId:'root',actorId:'owner',input:'pwd\r'})
 for(const scope of [{actorId:'other'},{workspaceId:'other'},{logicalProjectId:'other'}]){
  const other=new ShellDraftService({...f.options,...scope,terminal:f.service.terminal,readPermissionMode:async()=>mode})
  await assert.rejects(other.session(f.id,'poll'),{status:403})
 }
 await assert.rejects(f.service.session(f.id,'run',{text:'pwd'}),/Reviewed session/)
 f.epoch++
 await assert.rejects(f.service.session(f.id,'input',{input:'pwd\r'}),/Workspace changed/)
 await f.service.session(f.id,'poll')
 f.epoch--;mode='read-only'
 await assert.rejects(f.service.session(f.id,'resize',{cols:80,rows:24}),/permissions changed/)
 await f.service.session(f.id,'poll')
 await f.store.write({...running,state:'stopping'})
 await assert.rejects(f.service.session(f.id,'poll'),/no running shell/)
 assert.equal(sent.length,3)
})
test('reviewed shell accepts commands only through review and rechecks authorization after runner response',async t=>{
 const f=await fixture(t),sent=[]
 f.service.readPermissionMode=async()=>'auto-review'
 f.service.terminal={start:async body=>({attemptId:body.attemptId,sessionId:'review-session'}),session:async body=>{sent.push(body);return {approvalRequired:true}}}
 const ready=await f.service.prepare(f.id)
 await f.service.start(f.id,ready.revision,'auto-review')
 await assert.rejects(f.service.session(f.id,'input',{input:'rm file\r'}),/Raw input/)
 const result=await f.service.session(f.id,'run',{text:'pwd',approval:'approval'})
 assert.equal(result.approvalRequired,true);assert.equal(sent[0].approval,'approval')
 f.service.terminal.session=async()=>{f.allowed=false;return {output:'private'}}
 await assert.rejects(f.service.session(f.id,'poll'),{status:403})
})
test('startup refuses permission mode changed while waiting for draft lock',async t=>{
 const f=await fixture(t),ready=await f.service.prepare(f.id)
 f.service.readPermissionMode=async()=>'read-only'
 await assert.rejects(f.service.start(f.id,ready.revision,'full-access'),/permissions changed/)
 assert.equal((await f.store.read(f.id)).state,'ready')
})
