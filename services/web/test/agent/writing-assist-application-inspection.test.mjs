import test from 'node:test'
import assert from 'node:assert/strict'
import { createApplicationInspection } from '../../app/src/Features/WritingAssist/WritingAssistApplicationInspection.mjs'
const identity={projectId:'root',workspaceId:'p',branch:'draft',epoch:2}
function fixture(){
 const proposal={id:'change',docId:'d',path:'main.tex',version:2,before:'old',after:'new',status:'uncertain'}
 const state={allowed:true,identity:{...identity},docs:[{id:'d',path:'main.tex',version:3,content:'new'}],reads:0}
 const task={userId:'u',projectId:'p',workspaceIdentity:{...identity},proposals:[proposal]}
 const inspect=createApplicationInspection({canWrite:async()=>state.allowed,readWorkspaceIdentity:async()=>structuredClone(state.identity),store:{find:async(id,user,project)=>id==='task'&&user==='u'&&project==='p'?structuredClone(task):null},snapshot:async()=>{state.reads++;await state.onRead?.();return structuredClone(state.docs)}})
 return {state,task,proposal,inspect:()=>inspect('u','p','task','change'),raw:inspect}
}
for(const [name,docs] of [
 ['matches-proposal',[{id:'d',path:'main.tex',version:3,content:'new'}]],
 ['matches-baseline',[{id:'d',path:'main.tex',version:4,content:'old'}]],
 ['changed',[{id:'d',path:'main.tex',version:4,content:'other'}]],
 ['missing',[]],
 ['replaced',[{id:'replacement',path:'main.tex',version:1,content:'new'}]],
 ['renamed',[{id:'d',path:'renamed.tex',version:3,content:'new'}]],
])test(`inspection reports ${name} without settling or allowing replay`,async()=>{
 const f=fixture();f.state.docs=docs
 const before=structuredClone(f.task),result=await f.inspect()
 assert.equal(result.comparison,name);assert.equal(result.confirmed,false);assert.equal(result.canRetry,false);assert.equal(result.readOnly,true)
 assert.deepEqual(f.task,before)
 assert.equal(result.baseline.content,'old');assert.equal(result.proposed.content,'new')
})
test('old workspace identity is reported rather than silently rebound',async()=>{
 const f=fixture();f.state.identity.epoch++
 const result=await f.inspect();assert.equal(result.workspaceMatches,false)
 assert.equal(result.workspace.baseline.epoch,2);assert.equal(result.workspace.current.epoch,3)
})
test('new-file inspection remains unconfirmed even when a file has matching text',async()=>{
 const f=fixture();delete f.proposal.docId;f.proposal.mode='create-document';f.proposal.before=''
 const result=await f.inspect();assert.equal(result.comparison,'matches-proposal');assert.equal(result.confirmed,false)
})
for(const change of ['document','epoch','permission'])test(`inspection refuses ${change} changes during reads`,async()=>{
 const f=fixture();f.state.onRead=()=>{if(f.state.reads!==2)return;if(change==='document')f.state.docs[0].version++;else if(change==='epoch')f.state.identity.epoch++;else f.state.allowed=false}
 await assert.rejects(f.inspect(),{status:change==='permission'?403:409})
})
test('inspection is owner scoped and refuses unsupported proposal states',async()=>{
 const f=fixture();await assert.rejects(f.raw('other','p','task','change'),{status:404})
 await assert.rejects(f.raw('u','elsewhere','task','change'),{status:404})
 f.proposal.status='accepted';await assert.rejects(f.inspect(),{status:409})
 f.proposal.status='uncertain';f.proposal.mode='delete-document';await assert.rejects(f.inspect(),{status:409})
})
