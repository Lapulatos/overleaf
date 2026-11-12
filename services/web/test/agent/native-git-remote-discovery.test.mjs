import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rename, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { discoverRemote } from '../../app/src/Features/NativeGit/RemoteDiscovery.mjs'
async function fixture(t) {
 const root=await mkdtemp(Path.join(tmpdir(),'remote-discovery-'));t.after(()=>rm(root,{recursive:true,force:true}))
 const options={allowLocalRemotes:true}
 const external=await GitRepository.init(Path.join(root,'external'),options)
 await external.author('Fixture','fixture@example.test');await writeFile(Path.join(external.directory,'main.tex'),'base')
 await external.stage(['main.tex']);await external.commit('base')
 const remote=Path.join(root,'remote.git');await external.git.raw(['clone','--bare',external.directory,remote]);await external.addRemote('origin',remote)
 await mkdir(Path.join(root,'web'))
 const repo=new GitRepository(Path.join(root,'web'),options);await repo.clone(remote)
 const store=new CollaborationTaskStore(Path.join(root,'tasks')),credentials={read:async()=>null}
 const discover=(extra={})=>discoverRemote({repo,store,credentials,userId:'a'.repeat(24),remote:'origin',operationId:randomUUID(),authorize:async()=>{},...extra})
 const advance=async()=>{await writeFile(Path.join(external.directory,'main.tex'),randomUUID());await external.stage(['main.tex']);await external.commit('external edit');await external.git.raw(['push','origin','main']);return external.head()}
 return {root,repo,external,remote,store,discover,advance}
}
test('external push is discovered without changing dirty files index or local HEAD, ignoring configured refmap',async t=>{
 const f=await fixture(t),head=await f.repo.head()
 await writeFile(Path.join(f.repo.directory,'main.tex'),'web staged');await f.repo.stage(['main.tex'])
 await writeFile(Path.join(f.repo.directory,'main.tex'),'web unstaged')
 const index=await f.repo.git.raw(['write-tree'])
 await f.repo.git.raw(['config','--replace-all','remote.origin.fetch','+refs/heads/*:refs/heads/poison/*'])
 const incoming=await f.advance();const task=await f.discover()
 assert.equal(task.state,'fetched');assert.equal(task.applied,false)
 assert.ok(task.changes.some(change=>change.change==='advanced'&&change.after===incoming))
 assert.equal(await f.repo.head(),head);assert.equal(await f.repo.git.raw(['write-tree']),index)
 assert.equal(await readFile(Path.join(f.repo.directory,'main.tex'),'utf8'),'web unstaged')
 assert.equal((await f.repo.git.raw(['for-each-ref','refs/heads/poison'])).trim(),'')
 assert.equal((await f.discover({operationId:task.id})).revision,task.revision)
})
test('force push and branch deletion preserve old tips as recovery refs',async t=>{
 const f=await fixture(t),base=await f.repo.head(),advanced=await f.advance()
 await f.discover()
 await f.external.git.raw(['reset','--hard',base]);await f.external.git.raw(['push','--force','origin','main'])
 const rewrite=await f.discover();assert.ok(rewrite.changes.some(change=>change.change==='rewritten'&&change.before===advanced))
 assert.ok((await f.repo.git.raw(['for-each-ref','--format=%(objectname)',`refs/overleaf/remote-snapshots/${rewrite.id}`])).includes(advanced))
 await f.external.git.raw(['push','origin','main:temporary']);await f.discover()
 await f.external.git.raw(['push','origin',':temporary'])
 const deleted=await f.discover();assert.ok(deleted.changes.some(change=>change.ref.endsWith('/temporary')&&change.change==='deleted'))
 assert.equal(await f.repo.head(),base)
})
test('revocation stops discovery before refs or tasks change, and changed target cannot reuse operation ID',async t=>{
 const f=await fixture(t)
 await assert.rejects(f.discover({authorize:async()=>{throw Object.assign(Error('revoked'),{status:403})}}),/revoked/)
 assert.equal((await f.store.list()).length,0)
 const task=await f.discover()
 await f.repo.git.raw(['remote','set-url','origin',Path.join(f.root,'other.git')])
 await assert.rejects(f.discover({operationId:task.id}),/original target/)
})

test('discovery retry is bound to the initiating account', async t => {
 const f = await fixture(t), task = await f.discover()
 await assert.rejects(f.discover({ operationId: task.id, userId: 'b'.repeat(24) }), { status: 403 })
 assert.deepEqual(await f.store.read(task.id), task)
})

test('revocation after fetch leaves a retryable task without applying external text', async t => {
 const f = await fixture(t), original = await f.repo.head(), incoming = await f.advance()
 const operationId = randomUUID()
 let checks = 0
 await assert.rejects(f.discover({ operationId, authorize: async () => {
  if (++checks === 3) throw Object.assign(Error('revoked after fetch'), { status: 403 })
 } }), /revoked after fetch/)
 const interrupted = await f.store.read(operationId)
 assert.equal(interrupted.state, 'fetching')
 assert.equal(interrupted.before['refs/remotes/origin/main'], original)
 assert.equal(await f.repo.head(), original)
 assert.equal(await readFile(Path.join(f.repo.directory, 'main.tex'), 'utf8'), 'base')
 const recovered = await f.discover({ operationId })
 assert.equal(recovered.state, 'fetched')
 assert.ok(recovered.changes.some(change => change.before === original && change.after === incoming))
 assert.deepEqual(await f.discover({ operationId }), recovered)
})

test('transport failure retains original snapshot for retry', async t => {
 const f = await fixture(t), original = await f.repo.head(), incoming = await f.advance()
 const operationId = randomUUID()
 await rename(f.remote, `${f.remote}.offline`)
 try {
  await assert.rejects(f.discover({ operationId }), /repository|read from remote/i)
 } finally {
  await rename(`${f.remote}.offline`, f.remote)
 }
 assert.equal((await f.store.read(operationId)).state, 'fetching')
 assert.equal(await f.repo.head(), original)
 const recovered = await f.discover({ operationId })
 assert.ok(recovered.changes.some(change => change.before === original && change.after === incoming))
 assert.equal((await f.store.list()).length, 1)
})
