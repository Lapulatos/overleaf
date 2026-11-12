import { test } from 'node:test'
import assert from 'node:assert/strict'
import { executeShellDraftCommand, shellDraftTerminal } from '../../app/src/Features/NativeGit/ShellDraftCommands.mjs'
const task={id:'draft',kind:'shell-draft',state:'running',sessionId:'session',baseline:{secret:'private'},baselineManifest:{},reviewManifest:{},sessionAttemptId:'private-attempt'}
test('public draft response excludes internal paths, manifests and attempts',async()=>{
 const result=await executeShellDraftCommand({drafts:{get:async()=>task},command:{command:'shellDraftGet',id:'draft'}})
 assert.equal(result.id,'draft');assert.equal(result.baseline,undefined);assert.equal(result.sessionAttemptId,undefined);assert.equal(result.sessionId,undefined)
})
test('start is gated and uses only server policy when enabled',async()=>{
 let called=false
 const drafts={start:async(id,revision,mode)=>{called=true;assert.equal(mode,'read-only');return task}}
 const args={drafts,command:{command:'shellDraftStart',id:'draft',revision:3,mode:'full-access'},policy:{mode:'read-only'}}
 await assert.rejects(executeShellDraftCommand(args),/safe-import/);assert.equal(called,false)
 assert.equal((await executeShellDraftCommand({...args,startEnabled:true})).sessionId,'session')
})
test('review overview contains file sizes and statuses without snapshot bytes',async()=>{
 const result=await executeShellDraftCommand({drafts:{review:async()=>({task,changes:[{path:'a',before:Buffer.from('old'),after:Buffer.from('new')},{path:'b',after:Buffer.from('binary')},{path:'c',before:Buffer.from('removed')}]})},command:{command:'shellDraftReview'}})
 assert.deepEqual(result.changes.map(x=>x.status),['modified','added','deleted'])
 assert.equal(result.changes[0].before,undefined);assert.equal(result.changes[0].beforeBytes,3)
})
test('runner adapter pins request owner fields to server scope',async()=>{
 const sent=[];const terminal=shellDraftTerminal(async body=>{sent.push(body);return {ok:true}})
 await terminal.start({logicalProjectId:'project',actorId:'actor',project:'spoof',user:'spoof',action:'open'})
 await terminal.stop({logicalProjectId:'project',actorId:'actor'})
 assert.equal(sent[0].action,'draft-start');assert.equal(sent[0].project,'project');assert.equal(sent[0].user,'actor');assert.equal(sent[1].action,'draft-stop')
})
test('draft terminal commands reject client session ids and oversized payloads',async()=>{
 const {commandSchema}=await import('../../app/src/Features/NativeGit/GitCommands.mjs')
 const id='11111111-1111-4111-8111-111111111111'
 for(const command of [
  {command:'shellDraftPoll',id,sessionId:'spoof'},
  {command:'shellDraftInput',id,input:'x'.repeat(65537)},
  {command:'shellDraftResize',id,cols:501,rows:24},
  {command:'shellDraftRun',id,text:'pwd',mode:'full-access'},
 ])assert.equal(commandSchema.safeParse(command).success,false)
 const sent=[];const drafts={session:async(...args)=>{sent.push(args);return {output:'ok'}}}
 for(const [command,action] of [['shellDraftPoll','poll'],['shellDraftInput','input'],['shellDraftRun','run'],['shellDraftResize','resize']]){
  await executeShellDraftCommand({drafts,command:{command,id}})
  assert.equal(sent.at(-1)[0],id);assert.equal(sent.at(-1)[1],action)
 }
})
