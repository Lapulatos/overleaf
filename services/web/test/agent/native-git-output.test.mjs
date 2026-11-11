import test from 'node:test'
import assert from 'node:assert/strict'
import {PassThrough} from 'node:stream'
import {appendGitOutput,gitOutput,captureGitOutput} from '../../app/src/Features/NativeGit/GitOutput.mjs'
test('native output retains operations, isolates repositories and redacts split secrets',async()=>{
 const out=new PassThrough(),err=new PassThrough()
 captureGitOutput('/fixture/output',['secret-token'])('git',out,err,['fetch','origin'])
 out.end('Fetched branch\n');err.write('secret-');err.end('token\nAuthorization: Bearer private\n')
 await new Promise(resolve=>setImmediate(resolve))
 const value=gitOutput('/fixture/output')
 assert.match(value,/fetch origin/);assert.match(value,/Fetched branch/);assert.doesNotMatch(value,/secret-token|private/);assert.match(value,/\[redacted\]/)
 assert.doesNotMatch(gitOutput('/fixture/other'),/Fetched/)
 appendGitOutput('/fixture/output','x'.repeat(300000));assert.equal(gitOutput('/fixture/output').length,200000)
})

test('real native Git commands are recorded by the repository adapter',async t=>{
 const {mkdtemp,rm}=await import('node:fs/promises')
 const {tmpdir}=await import('node:os')
 const Path=await import('node:path')
 const {GitRepository}=await import('../../app/src/Features/NativeGit/GitRepository.mjs')
 const directory=await mkdtemp(Path.join(tmpdir(),'git-output-'))
 t.after(()=>rm(directory,{recursive:true,force:true}))
 const repo=await GitRepository.init(directory)
 await repo.status()
 assert.match(gitOutput(directory),/status/)
})
