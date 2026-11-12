import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, stat, symlink, writeFile, readFile } from 'node:fs/promises'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { shellAttemptLock } from '../src/shell-attempt-lock.mjs'
const moduleUrl = new URL('../src/shell-attempt-lock.mjs', import.meta.url).href
async function setup(t) {
 const dir=await mkdtemp(Path.join(tmpdir(),'attempt-lock-'))
 t.after(()=>rm(dir,{recursive:true,force:true}))
 return {dir,id:randomUUID()}
}
test('independent processes exclude each other and release after SIGKILL', async t=>{
 const {dir,id}=await setup(t)
 const script=`import {shellAttemptLock} from ${JSON.stringify(moduleUrl)}; await shellAttemptLock(process.argv[1])(process.argv[2],async()=>{process.stdout.write('held\\n');await new Promise(()=>{})})`
 const child=spawn(process.execPath,['--input-type=module','-e',script,dir,id],{stdio:['ignore','pipe','pipe']})
 t.after(()=>child.kill('SIGKILL'))
 await once(child.stdout,'data')
 const before=await stat(Path.join(dir,`${id}.lock`))
 let called=false
 await assert.rejects(shellAttemptLock(dir,{timeoutMs:100})(id,async()=>{called=true}),/timed out/)
 assert.equal(called,false)
 const exited=once(child,'exit');child.kill('SIGKILL');await exited
 await shellAttemptLock(dir,{timeoutMs:3000})(id,async()=>{called=true})
 assert.equal(called,true)
 assert.equal((await stat(Path.join(dir,`${id}.lock`))).ino,before.ino)
})
test('callback failure releases lock and different attempts do not block',async t=>{
 const {dir,id}=await setup(t)
 const lock=shellAttemptLock(dir,{timeoutMs:1000})
 await assert.rejects(lock(id,async()=>{throw Error('operation failed')}),/operation failed/)
 await lock(id,()=>lock(randomUUID(),async()=>42))
})
test('symlink lock target is refused without changing target',async t=>{
 const {dir,id}=await setup(t)
 const target=Path.join(dir,'target');await writeFile(target,'unchanged')
 await symlink(target,Path.join(dir,`${id}.lock`))
 await assert.rejects(shellAttemptLock(dir)(id,async()=>assert.fail()),/lock failed/)
 assert.equal(await readFile(target,'utf8'),'unchanged')
})
