import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { openTerminal, writeTerminal, pollTerminal, closeTerminal } from '../../app/src/Features/NativeGit/RepositoryTerminal.mjs'
test('real PTY preserves shell state, runs programs/pipes, interrupts and isolates sessions', async t => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'repo-terminal-'))
 const key='project:user', {id}=openTerminal(dir,key)
 t.after(()=>{try{closeTerminal(id,key)}catch{};return rm(dir,{recursive:true,force:true})})
 let output=''
 async function until(text){for(let i=0;i<80;i++){output+=pollTerminal(id,key).output;if(output.includes(text))return;await new Promise(r=>setTimeout(r,50))}assert.fail(output)}
 writeTerminal(id,key,'printf "PTY_READY\\n"\r');await until('PTY_READY')
 writeTerminal(id,key,'export HELLO=state; mkdir child; cd child\r')
 writeTerminal(id,key,'python3 -c \'import os; print("STATE="+os.environ["HELLO"]); print(os.getcwd())\' | cat\r')
 await until('STATE=state');await until(path.join(dir,'child'))
 assert.throws(()=>pollTerminal(id,'other:user'),/expired/)
 writeTerminal(id,key,undefined,100,30)
 writeTerminal(id,key,'sleep 30\r');await new Promise(r=>setTimeout(r,100));writeTerminal(id,key,'\x03');writeTerminal(id,key,'printf "AFTER_INTERRUPT\\n"\r');await until('AFTER_INTERRUPT')
})
