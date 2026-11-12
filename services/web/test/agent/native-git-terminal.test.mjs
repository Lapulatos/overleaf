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

test('independent draft terminals and cursor readers do not close sessions or consume each other output',async t=>{
 const {PassThrough}=await import('node:stream'),{EventEmitter}=await import('node:events')
 const fake=()=>Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),kill:()=>{}})
 const a=fake(),b=fake(),key='draft-owner'
 const first=openTerminal('/draft-a',key,()=>a,false),second=openTerminal('/draft-b',key,()=>b,false)
 t.after(()=>{for(const {id} of [first,second])try{closeTerminal(id,key)}catch{}})
 const emit=(child,text)=>child.stdout.write(JSON.stringify({data:Buffer.from(text).toString('base64')})+'\n')
 emit(a,'first 中文\n');emit(b,'second\n')
 const tabA=pollTerminal(first.id,key,0),tabB=pollTerminal(first.id,key,0)
 assert.deepEqual(tabA,tabB);assert.equal(tabA.output,'first 中文\n')
 assert.equal(pollTerminal(second.id,key,0).output,'second\n')
 writeTerminal(first.id,key,'pwd\r');writeTerminal(second.id,key,'pwd\r')
 emit(a,'next\n')
 assert.equal(pollTerminal(first.id,key,tabA.cursor).output,'next\n')
 assert.equal(pollTerminal(first.id,key,tabB.cursor).output,'next\n')
 assert.equal(pollTerminal(first.id,key).output,'first 中文\nnext\n')
 assert.equal(pollTerminal(first.id,key).output,'')
 assert.equal(pollTerminal(first.id,key,0).output,'first 中文\nnext\n')
 assert.throws(()=>pollTerminal(first.id,key,-1),/cursor/)
 assert.throws(()=>pollTerminal(first.id,key,Number.MAX_SAFE_INTEGER),/cursor/)
 emit(a,'x'.repeat(1024*1024+10))
 const bounded=pollTerminal(first.id,key,0)
 assert.equal(bounded.truncated,true);assert.equal(bounded.output.length,1024*1024)
 assert.equal(pollTerminal(first.id,key,bounded.cursor).output,'')
})
