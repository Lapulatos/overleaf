import test from 'node:test'
import assert from 'node:assert/strict'
import { annotateTerminalLocations } from '../../app/src/Features/NativeGit/TerminalIndicators.mjs'
const snapshot = {branches:[{name:'main'},{name:'other'},{name:'main',remote:true}],graph:[{hash:'old'},{hash:'new'}]}
const task = {id:'12345678-abcd',kind:'shell-draft',logicalProjectId:'project',createdBy:'alice',state:'running',sourcePosition:{branch:'main',head:'old'},sessionId:'secret',directory:'/private/path',terminalHistory:'private output'}
const options = {logicalProjectId:'project',users:new Map([['alice','Alice Example'],['bob','Bob Example']]),health:async()=> 'running'}
test('maps all collaborators to original commit and local branch, exposes only display fields',async()=>{
 const result=await annotateTerminalLocations(snapshot,[task,{...task,id:'bob-task',createdBy:'bob',state:'review-ready'}],options)
 assert.equal(result.graph[0].terminals.length,2)
 assert.equal(result.graph[1].terminals.length,0)
 assert.equal(result.branches[0].terminals.length,2)
 assert.equal(result.branches[1].terminals.length,0)
 assert.equal(result.branches[2].terminals.length,0)
 assert.deepEqual(result.graph[0].terminals[0],{branch:'main',userId:'alice',displayName:'Alice Example',name:'Terminal 12345678',state:'running'})
 assert.equal(result.graph[0].terminals[1].state,'stopped')
 assert.doesNotMatch(JSON.stringify(result),/secret|private output|private\/path/)
})
test('ended, unavailable, detached and deleted sessions retain accurate locations',async()=>{
 const tasks=[task,{...task,deletedAt:1},{...task,logicalProjectId:'another'}, {...task,sourcePosition:{branch:null,head:'new'},name:'Detached'}]
 const result=await annotateTerminalLocations(snapshot,tasks,{...options,health:async()=> 'stopped'})
 assert.equal(result.branches[0].terminals.length,1)
 assert.equal(result.graph[0].terminals[0].state,'stopped')
 assert.equal(result.graph[1].terminals[0].name,'Detached')
 const unavailable=await annotateTerminalLocations(snapshot,[task],{...options,health:async()=>{throw Error('offline')}})
 assert.equal(unavailable.graph[0].terminals[0].state,'unavailable')
 const deleted=await annotateTerminalLocations(snapshot,[{...task,deletedAt:1}],options)
 assert.equal(deleted.graph[0].terminals.length,0)
})
