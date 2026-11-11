import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import settings from '@overleaf/settings'
const state=JSON.parse(await fs.readFile('/var/lib/overleaf/git-sync/git-ux-acceptance.json','utf8'))
assert.equal(state.projectId,'6aee30c179c897758e370d23')
const dir=settings.gitSync.repositoryRoot+'/'+state.repositoryKey
const owner=await fs.stat('/var/lib/overleaf');const run=promisify(execFile)
const git=async(...args)=>(await run('git',['-c','user.name=Git UX Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false',...args],{cwd:dir,uid:owner.uid,gid:owner.gid})).stdout.trim()
assert.equal(await git('rev-parse','HEAD'),state.baseCommit)
assert.equal(await git('status','--porcelain'),'')
assert.equal(await git('branch','--list','conflict-review'),'')
await git('checkout','-b','conflict-review')
await fs.writeFile(dir+'/main.tex',state.baseText.replace('Original introduction.','Repository introduction.').replace('Original conclusion.','Repository conclusion.'))
await git('add','main.tex');await git('commit','-m','Alternative manuscript with two conflicts')
const conflictCommit=await git('rev-parse','HEAD');await git('checkout','main')
console.log(JSON.stringify({projectId:state.projectId,conflictCommit,mainUnchanged:await git('rev-parse','HEAD')===state.baseCommit}))
