import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'
import { BackupArchive } from '../../app/src/Features/NativeGit/BackupArchive.mjs'
import { RecoveryVault } from '../../app/src/Features/NativeGit/RecoveryVault.mjs'
const owner='a'.repeat(24), project='b'.repeat(24)
async function fixture(t) {
 const root=await mkdtemp(Path.join(tmpdir(),'recovery-vault-'));t.after(()=>rm(root,{recursive:true,force:true}))
 const id=randomUUID(),directory=Path.join(root,project,'backups',id),archive=new BackupArchive(directory)
 await archive.begin();await archive.add('paper.tex',Buffer.from('preserve paper'))
 const manifest=await archive.publish({id,projectId:project,workspaces:[{workspaceId:project}]},async()=>true)
 return {root,id,directory,manifest,vault:new RecoveryVault(root,owner)}
}
test('owner copy survives complete source directory removal and retains original capture time',async t=>{
 const f=await fixture(t),summary=await f.vault.retain(f,async()=>{})
 assert.equal(summary.capturedAt,f.manifest.capturedAt)
 assert.deepEqual(await f.vault.retain(f,async()=>{}),summary)
 await rm(Path.join(f.root,project),{recursive:true})
 const kept=await f.vault.resolve(f.id)
 assert.equal(await readFile(Path.join(kept.directory,'paper.tex'),'utf8'),'preserve paper')
 assert.equal((await f.vault.list()).length,1)
 assert.equal((await new RecoveryVault(f.root,'c'.repeat(24)).list()).length,0)
 await assert.rejects(new RecoveryVault(f.root,'c'.repeat(24)).resolve(f.id),{status:404})
})
test('revoked authority, changed content and path identities cannot publish retained copies',async t=>{
 const f=await fixture(t)
 await assert.rejects(f.vault.retain(f,async()=>{throw Object.assign(Error('revoked'),{status:403})}),{status:403})
 await writeFile(Path.join(f.directory,'paper.tex'),'changed')
 await assert.rejects(f.vault.retain(f,async()=>{}),{status:409})
 assert.equal((await f.vault.list()).length,0)
 await assert.rejects(f.vault.resolve('../escape'),{status:400})
 assert.throws(()=>new RecoveryVault(f.root,'../owner'))
})
test('ownership recheck at publication leaves only an invisible partial copy',async t=>{
 const f=await fixture(t);let checks=0
 await assert.rejects(f.vault.retain(f,async()=>{if(++checks===2)throw Object.assign(Error('revoked'),{status:403})}),{status:403})
 assert.equal((await f.vault.list()).length,0)
})
