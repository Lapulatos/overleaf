import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { readWorktree, writeWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
import { readGitPresencePosition } from '../../app/src/Features/NativeGit/GitPresencePosition.mjs'
async function fixture(t){
 const root=await mkdtemp(Path.join(tmpdir(),'presence-position-'));t.after(()=>rm(root,{recursive:true,force:true}))
 const repo=await GitRepository.init(root);await repo.author('Fixture','fixture@example.test')
 const files=new Map([['main.tex',Buffer.from('base')]])
 await writeWorktree(root,files);await repo.stage(['main.tex']);await repo.commit('base')
 const head=await repo.head(),binding={branch:'main'},epoch={read:async()=>1}
 const workspace={store:{read:async()=>binding},current:async()=>repo,project:{read:async()=>({files})}}
 return {root,repo,files,head,binding,epoch,workspace,read:extra=>readGitPresencePosition({workspace,epoch,logicalProjectId:'a'.repeat(24),workspaceId:'b'.repeat(24),userId:'c'.repeat(24),displayName:'Author',...extra})}
}
test('presence reads live dirtiness without exporting, staging or changing HEAD',async t=>{
 const f=await fixture(t);assert.equal((await f.read()).dirty,false)
 f.files.set('main.tex',Buffer.from('unsaved to Git'))
 const position=await f.read({viewedCommit:f.head})
 assert.equal(position.dirty,true);assert.equal(position.head,f.head);assert.equal(position.viewedCommit,f.head)
 assert.equal(position.branch,'main');assert.equal((await readWorktree(f.root)).get('main.tex').toString(),'base')
 assert.equal((await f.repo.status()).files.length,0);assert.equal(await f.repo.head(),f.head)
})
test('invalid or missing history revisions and inconsistent workspace identity are rejected',async t=>{
 const f=await fixture(t)
 await assert.rejects(f.read({viewedCommit:'main'}),/Invalid/)
 await assert.rejects(f.read({viewedCommit:'f'.repeat(40)}))
 f.binding.branch='other';await assert.rejects(f.read(),/branch changed/)
 f.binding.branch='main';f.binding.mutationTaskId='pending';await assert.rejects(f.read(),/recovered/)
})
test('epoch transition during position read cannot publish the previous generation',async t=>{
 const f=await fixture(t);let reads=0;f.epoch.read=async()=>++reads
 await assert.rejects(f.read(),/version changed/)
})
