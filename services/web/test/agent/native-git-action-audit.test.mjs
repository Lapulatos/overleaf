import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import Path from 'node:path'
import {tmpdir} from 'node:os'
import {GitRepository} from '../../app/src/Features/NativeGit/GitRepository.mjs'
async function fixture(t){
 const root=await mkdtemp(Path.join(tmpdir(),'git-action-audit-'))
 t.after(()=>rm(root,{recursive:true,force:true}))
 const repo=await GitRepository.init(Path.join(root,'repo'),{allowLocalRemotes:true,worktreeRoot:Path.join(root,'worktrees')})
 await repo.author('Audit','audit@example.test')
 await writeFile(Path.join(repo.directory,'old.tex'),'Paper\n')
 await repo.stage(['old.tex']);await repo.commit('Initial')
 return {root,repo}
}
test('Unstage renamed file removes both sides from index and retains renamed worktree',async t=>{
 const {repo}=await fixture(t)
 await repo.git.raw(['mv','old.tex','new.tex'])
 await repo.unstage(['new.tex'])
 assert.equal(await repo.diff({staged:true}),'')
 assert.equal(await readFile(Path.join(repo.directory,'new.tex'),'utf8'),'Paper\n')
})
test('staged rename diff shows native rename instead of a phantom added file',async t=>{
 const {repo}=await fixture(t)
 await repo.git.raw(['mv','old.tex','new.tex'])
 const diff=await repo.fileDiff('new.tex',true)
 assert.match(diff,/rename from old.tex/);assert.match(diff,/rename to new.tex/)
})
test('Undo initial commit preserves staged and unstaged bytes and returns unborn branch',async t=>{
 const {repo}=await fixture(t)
 await writeFile(Path.join(repo.directory,'old.tex'),'Unfinished\n')
 const index=await repo.git.raw(['write-tree']),preview=await repo.undoDetails()
 assert.equal(preview.target,null)
 await repo.undoCommit(preview.fingerprint)
 await assert.rejects(repo.head())
 assert.equal(await repo.git.raw(['write-tree']),index)
 assert.equal(await readFile(Path.join(repo.directory,'old.tex'),'utf8'),'Unfinished\n')
 await repo.commit('New initial');assert.equal((await repo.graph())[0].parents.length,0)
})
test('Undo rejects stale preview and then soft-resets exactly one commit',async t=>{
 const {repo}=await fixture(t),parent=await repo.head()
 await repo.git.raw(['commit','--allow-empty','-m','Second'])
 const preview=await repo.undoDetails()
 await writeFile(Path.join(repo.directory,'old.tex'),'Later edit\n')
 await assert.rejects(repo.undoCommit(preview.fingerprint),/changed/)
 await repo.undoCommit((await repo.undoDetails()).fingerprint)
 assert.equal(await repo.head(),parent)
 assert.equal(await readFile(Path.join(repo.directory,'old.tex'),'utf8'),'Later edit\n')
})
import {executeRemoteCommand} from '../../app/src/Features/NativeGit/RemoteOperations.mjs'
import {mkdir} from 'node:fs/promises'
async function remoteFixture(t){
 const {root,repo}=await fixture(t)
 const fetchDir=Path.join(root,'fetch.git'),pushDir=Path.join(root,'push.git')
 for(const dir of [fetchDir,pushDir]){await mkdir(dir);await new GitRepository(dir,{allowLocalRemotes:true}).git.init(true)}
 await repo.addRemote('origin',fetchDir);await repo.push('origin','main',{publish:true})
 await repo.git.raw(['remote','set-url','--push','origin',pushDir])
 const calls=[],credentials={read:async url=>{calls.push(['read',url]);return undefined},save:async(...a)=>calls.push(['save',...a]),remove:async url=>calls.push(['remove',url])}
 return {root,repo,fetchDir,pushDir,calls,credentials}
}
test('Sync pulls then pushes current branch to its distinct push URL using matching credentials',async t=>{
 const {repo,fetchDir,pushDir,calls,credentials}=await remoteFixture(t)
 await executeRemoteCommand(repo,{command:'sync',remote:'origin',branch:'main'},{credentials})
 assert.equal((await new GitRepository(pushDir).git.raw(['rev-parse','main'])).trim(),await repo.head())
 assert.deepEqual(calls,[['read',fetchDir],['read',pushDir]])
})
test('Sync with missing remote branch stops before push and does not advance destination',async t=>{
 const {repo,pushDir,calls,credentials}=await remoteFixture(t)
 await repo.git.raw(['config','remote.origin.fetch','+refs/heads/*:refs/remotes/origin/*'])
 await repo.git.raw(['update-ref','-d','refs/remotes/origin/main'])
 // Remove source branch on isolated bare remote; pull must fail before any push.
 const fetchDir=await repo.remoteUrl('origin')
 await new GitRepository(fetchDir).git.raw(['update-ref','-d','refs/heads/main'])
 await assert.rejects(executeRemoteCommand(repo,{command:'sync',remote:'origin',branch:'main'},{credentials}))
 assert.equal(calls.some(c=>c[1]===pushDir),false)
 assert.equal((await new GitRepository(pushDir).git.raw(['for-each-ref'])).trim(),'')
})
test('credential status/save/remove can target push independently without returning token',async t=>{
 const {repo,pushDir,fetchDir,calls,credentials}=await remoteFixture(t)
 await executeRemoteCommand(repo,{command:'saveCredential',remote:'origin',target:'push',username:'audit',token:'fixture-secret'},{credentials})
 assert.deepEqual(calls[0],['save',pushDir,'audit','fixture-secret'])
 await executeRemoteCommand(repo,{command:'removeCredential',remote:'origin',target:'push'},{credentials})
 assert.deepEqual(calls[1],['remove',pushDir])
 const result=await executeRemoteCommand(repo,{command:'credentialStatus',remote:'origin'},{credentials})
 assert.equal(result.url,fetchDir);assert.equal('token' in result,false)
})
test('remote service routes publish, tag push and guarded remote deletion to push destination',async t=>{
 const {repo,pushDir,credentials}=await remoteFixture(t)
 await executeRemoteCommand(repo,{command:'push',remote:'origin',branch:'main',publish:true},{credentials})
 await repo.createTag('audit-tag')
 await executeRemoteCommand(repo,{command:'pushTags',remote:'origin'},{credentials})
 const ref=await executeRemoteCommand(repo,{command:'remoteRef',remote:'origin',kind:'tag',name:'audit-tag'},{credentials})
 await executeRemoteCommand(repo,{command:'deleteRemoteRef',remote:'origin',kind:'tag',name:'audit-tag',expectedHash:ref.hash},{credentials})
 assert.equal((await new GitRepository(pushDir).git.raw(['tag','--list'])).trim(),'')
 assert.equal((await repo.tags()).includes('audit-tag'),true)
})
