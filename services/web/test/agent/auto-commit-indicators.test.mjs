import {test} from 'node:test'
import assert from 'node:assert/strict'
import {annotateAutoCommitBranches} from '../../app/src/Features/NativeGit/AutoCommitIndicators.mjs'
test('indicators follow persisted workspace schedules and omit remote/tag/disabled branches',async()=>{
 const branches=[{name:'main'},{name:'topic'},{name:'main',remote:true},{name:'main',tag:true}]
 let enabled=true
 const read=async id=>id==='a'?{enabled,state:'scheduled'}:{enabled:false}
 const workspaces=[{id:'a',branch:'main'},{id:'b',branch:'topic'}]
 let result=await annotateAutoCommitBranches(branches,workspaces,read)
 assert.deepEqual(result.map(b=>!!b.autoCommit),[true,false,false,false])
 enabled=false;result=await annotateAutoCommitBranches(branches,workspaces,read)
 assert.ok(result.every(b=>!b.autoCommit))
 assert.ok(branches.every(b=>!b.autoCommit))
})
test('paused schedules stay identifiable and archived workspaces are omitted',async()=>{
 const result=await annotateAutoCommitBranches([{name:'a'},{name:'b'}],[{id:'1',branch:'a'},{id:'2',branch:'b',archived:true}],async()=>({enabled:true,state:'paused'}))
 assert.equal(result[0].autoCommit.state,'paused');assert.equal(result[1].autoCommit,undefined)
})
