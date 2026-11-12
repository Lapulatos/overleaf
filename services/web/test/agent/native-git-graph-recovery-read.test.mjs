import test from 'node:test'
import assert from 'node:assert/strict'
import { executeGitCommand, commandSchema } from '../../app/src/Features/NativeGit/GitCommands.mjs'
test('graph reads history while document export is blocked by recovery',async()=>{
 let reads=0
 const workspace={run:async()=>{throw Error('Pending workspace recovery must not export documents')},
  readHistory:async action=>{reads++;return action({graph:async options=>{assert.equal(options.ref,'topic');return [{hash:'a'.repeat(40)}]}})}}
 const result=await executeGitCommand(workspace,{command:'graph',ref:'topic'})
 assert.equal(result[0].hash,'a'.repeat(40));assert.equal(reads,1)
})

test('advertised branches command validates and reads refs without exporting documents',async()=>{
 const command=commandSchema.parse({command:'branches'})
 const branches=[{ref:'refs/heads/topic',name:'topic',commit:'a'.repeat(40),remote:false}]
 const workspace={run:async()=>assert.fail('branch listing must not export documents'),readHistory:async action=>action({branches:async()=>branches})}
 assert.deepEqual(await executeGitCommand(workspace,command),branches)
 assert.equal(commandSchema.safeParse({command:'branches',directory:'/etc'}).success,false)
})
