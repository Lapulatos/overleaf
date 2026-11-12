import test from 'node:test'
import assert from 'node:assert/strict'
import {buildClaimReview,applyClaimSuggestion} from '../../app/src/Features/WritingAssist/WritingAssistClaimReview.mjs'
const before='The intervention always succeeds \\cite{paper}.'
const after='The intervention sometimes succeeds \\cite{paper}.'
const quote='The intervention succeeds in some but not all evaluated cases.'
const input={checkedAt:'now',contexts:[{id:'c0',path:'main.tex',line:2,keys:['paper'],text:before}],evidence:[{key:'paper',abstract:quote,source:{url:'https://example.org/paper'}}],documents:[{id:'d',path:'main.tex',version:1,content:'Start\n'+before+'\nEnd'}]}
const summary=JSON.stringify({findings:[{contextId:'c0',citationKey:'paper',verdict:'contradicted',reason:'The evidence does not establish universal success.',quote,after}]})
test('claim cards require exact supplied source evidence and preserve LaTeX commands',()=>{
 const r=buildClaimReview(input,summary);assert.equal(r.items[0].status,'pending');assert.equal(r.items[0].after,after)
 for(const changed of [summary.replace(quote,'An invented quotation that is sufficiently long.'),summary.replace('paper}.' ,'other}.'),'{bad json}'])assert.notEqual(buildClaimReview(input,changed).items[0].status,'pending')
 assert.equal(buildClaimReview({...input,evidence:[]},summary).items[0].verdict,'insufficient')
 assert.equal(buildClaimReview(input,summary.replace('contradicted','supported')).items[0].after,null)
})
test('one suggestion applies exactly once and rejects stale or unavailable-evidence corrections',async()=>{
 let doc=structuredClone(input.documents[0]);const map=new Map([['audit',{status:'completed',claimInput:input,claimReview:buildClaimReview(input,summary),proposals:[]}]])
 let writes=0
 const deps={canWrite:async()=>true,snapshot:async()=>[doc],store:{find:async id=>map.get(id),create:async t=>map.set(t.id,t),recordClaimApplication:async(id,u,p,pid,claimInput,claimReview)=>Object.assign(map.get(id),{claimInput,claimReview})},tasks:{decide:async(u,p,id)=>{const t=map.get(id);assert.equal(t.proposals[0].before,doc.content);doc={...doc,content:t.proposals[0].after,version:doc.version+1};t.proposals[0].status='accepted';writes++;return t},get:async(u,p,id)=>map.get(id)}}
 const t=await applyClaimSuggestion(deps,'u','p',{taskId:'audit',suggestionId:'c0'})
 assert.equal(doc.content,'Start\n'+after+'\nEnd');assert.equal(writes,1);assert.equal(t.claimReview.items[0].status,'accepted')
 await assert.rejects(applyClaimSuggestion(deps,'u','p',{taskId:'audit',suggestionId:'c0'}),{status:409})
 await assert.rejects(applyClaimSuggestion(deps,'u','p',{taskId:t.id,suggestionId:'c0'}),{status:422})
 await assert.rejects(applyClaimSuggestion({...deps,canWrite:async()=>false},'u','p',{taskId:t.id,suggestionId:'c0'}),{status:403})
})

test('claim application preserves original workspace identity and refuses stale review',async()=>{
 const identity={projectId:'root',workspaceId:'p',branch:'draft',epoch:2}
 const doc={id:'d',path:'main.tex',version:1,content:'Original claim.'}
 const task={id:'audit',status:'completed',workspaceIdentity:identity,proposals:[],claimInput:{documents:[doc]},claimReview:{items:[{id:'c',path:doc.path,before:doc.content,after:'Corrected claim.',status:'pending'}]}}
 let current={...identity},saved,decisions=0
 const deps={canWrite:async()=>true,readWorkspaceIdentity:async()=>({...current}),snapshot:async()=>[doc],store:{find:async()=>task,create:async value=>saved=value},tasks:{decide:async()=>{decisions++;return {proposals:[{status:'pending'}]}}}}
 await applyClaimSuggestion(deps,'u','p',{taskId:'audit',suggestionId:'c'})
 assert.deepEqual(saved.workspaceIdentity,identity);assert.equal(decisions,1)
 saved=null;current.epoch++
 await assert.rejects(applyClaimSuggestion(deps,'u','p',{taskId:'audit',suggestionId:'c'}),{code:'AI_WORKSPACE_CHANGED'})
 assert.equal(saved,null);assert.equal(decisions,1)
 current={...identity}
 deps.snapshot=async()=>{current.epoch++;return [doc]}
 await assert.rejects(applyClaimSuggestion(deps,'u','p',{taskId:'audit',suggestionId:'c'}),{code:'AI_WORKSPACE_CHANGED'})
 assert.equal(saved,null);assert.equal(decisions,1)
})

test('claim continuation is persisted before dispatch without prematurely accepting original review',async()=>{
 const original={status:'completed',claimInput:structuredClone(input),claimReview:buildClaimReview(input,summary),proposals:[]}
 let saved
 const deps={canWrite:async()=>true,snapshot:async()=>structuredClone(input.documents),store:{find:async()=>original,create:async t=>{saved=structuredClone(t)}},tasks:{decide:async()=>{throw Error('interrupted response')}}}
 await assert.rejects(applyClaimSuggestion(deps,'u','p',{taskId:'audit',suggestionId:'c0'}),/interrupted response/)
 assert.equal(original.claimReview.items[0].status,'pending')
 assert.equal(saved.claimReview,undefined)
 assert.equal(saved.applicationOutcome.proposalId,saved.proposals[0].id)
 assert.equal(saved.applicationOutcome.fields.claimReview.items[0].status,'accepted')
 assert.equal(saved.applicationOutcome.fields.claimInput.documents[0].content,saved.proposals[0].after)
})
