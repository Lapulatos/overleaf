import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'
import { BackupRetention } from '../../app/src/Features/NativeGit/BackupRetention.mjs'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
async function fixture(t) {
 const root=await mkdtemp(Path.join(tmpdir(),'backup-retention-'))
 t.after(()=>rm(root,{recursive:true,force:true}))
 const id=randomUUID(),dir=Path.join(root,'backups',id)
 await mkdir(dir,{recursive:true});await writeFile(Path.join(dir,'partial'),'retained text')
 const c={root,recoveryLock:fn=>fn()},now=()=>Date.now()+2*86400000
 return {root,id,dir,c,service:new BackupRetention(c,async()=>{},now)}
}
test('only old unpublished unreferenced captures can be removed, with idempotent receipt',async t=>{
 const f=await fixture(t)
 const item=(await f.service.preview()).items[0];assert.equal(item.eligible,true)
 const done=await f.service.apply(f.id,item.fingerprint);assert.equal(done.state,'completed')
 assert.deepEqual(await f.service.apply(f.id,item.fingerprint),done)
 assert.equal((await f.service.preview()).items.length,0)
})
test('complete, referenced and fresh captures survive; stale preview cannot delete changed data',async t=>{
 const f=await fixture(t),item=(await f.service.preview()).items[0]
 await writeFile(Path.join(f.dir,'new'),'new text')
 await assert.rejects(f.service.apply(f.id,item.fingerprint),{status:409})
 assert.equal(await readFile(Path.join(f.dir,'partial'),'utf8'),'retained text')
 const fresh=new BackupRetention(f.c,async()=>{});assert.equal((await fresh.preview()).items[0].eligible,false)
 const store=new CollaborationTaskStore(Path.join(f.root,'backup-restores'))
 await store.write({id:randomUUID(),revision:1,backupId:f.id,state:'failed'})
 assert.equal((await f.service.preview()).items[0].reason,'Referenced by a restore attempt')
 await writeFile(Path.join(f.dir,'manifest.json'),'{}')
 assert.equal((await f.service.preview()).items[0].reason,'Completed backup retained')
})
test('unauthorized caller and symbolic links cannot clean data',async t=>{
 const f=await fixture(t)
 await assert.rejects(new BackupRetention(f.c,async()=>{throw Object.assign(Error('denied'),{status:403})}).preview(),{status:403})
 await symlink('/tmp',Path.join(f.dir,'outside'))
 await assert.rejects(f.service.preview(),{status:409})
})
test('lost quarantine receipt resumes approved private destination only',async t=>{
 const f=await fixture(t),item=(await f.service.preview()).items[0]
 const id=randomUUID(),destination=Path.join(f.root,'backup-cleanup-quarantine',id)
 await f.service.receipts.write({id,revision:1,backupId:f.id,fingerprint:item.fingerprint,state:'prepared'})
 await mkdir(Path.dirname(destination),{recursive:true});await rename(f.dir,destination)
 assert.equal((await f.service.apply(f.id,item.fingerprint)).state,'completed')
})
