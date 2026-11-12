import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {applyReferenceReview} from '../../app/src/Features/WritingAssist/WritingAssistReferenceApply.mjs'
import {parseBibliography} from '../../app/src/Features/WritingAssist/WritingAssistBibTeX.mjs'
const hash=s=>createHash('sha256').update(s).digest('hex')
function fixture(){
 const state={allowed:true,writes:0,doc:{id:'b',path:'refs.bib',version:7,content:'% keep\n@article{a,title={Wrong},year={2020},custom={keep}}\n@article{b,title={Keep},year={2021}}'}}
 const review={docId:'b',baseHash:hash(state.doc.content),keys:['a','b'],entries:[{key:'a',source:'https://api.crossref.org/works/x',fields:[{field:'title',current:'Wrong',found:'Correct',status:'review-difference'},{field:'year',current:'2020',found:'2024',status:'review-difference'},{field:'publisher',current:'',found:'ACM',status:'missing-in-bibliography'}],actions:[{field:'title',before:'Wrong',after:'{Correct}'},{field:'year',before:'2020',after:'2024'},{field:'publisher',before:'',after:'ACM'}]},{key:'b',source:null,reason:'Unavailable',fields:[],actions:[]}]}
 const map=new Map([['audit',{id:'audit',userId:'u',projectId:'p',status:'completed',referenceReview:review,proposals:[]}]])
 const deps={canWrite:async()=>state.allowed,snapshot:async()=>[structuredClone(state.doc)],store:{find:async(id,u,p)=>{const t=map.get(id);return t?.userId===u && t?.projectId===p?t:null},create:async t=>map.set(t.id,t),finish:async(id,fields)=>{if(['preparing','submitting','running'].includes(map.get(id).status))Object.assign(map.get(id),fields)},recordReferenceApplication:async(id,u,p,pid,referenceReview,summary)=>{const t=map.get(id);assert.equal(t.userId,u);assert.equal(t.projectId,p);assert.equal(t.status,'completed');assert.equal(t.proposals.find(p=>p.id===pid).status,'accepted');Object.assign(t,{referenceReview,summary})}},tasks:{decide:async(u,p,id,pid)=>{const t=map.get(id),proposal=t.proposals[0];assert.equal(proposal.version,state.doc.version);assert.equal(proposal.before,state.doc.content);state.doc.content=proposal.after;state.doc.version++;state.writes++;proposal.status='accepted';return t},get:async(u,p,id)=>map.get(id)}}
 return {state,deps,map,run:input=>applyReferenceReview(deps,'u','p',input)}
}
test('single field writes exactly the selected value and keeps other fields/comments/entries',async()=>{
 const f=fixture();const result=await f.run({taskId:'audit',fields:[{key:'a',field:'year'}]})
 assert.equal(f.state.doc.content,'% keep\n@article{a,title={Wrong},year={2024},custom={keep}}\n@article{b,title={Keep},year={2021}}')
 assert.equal(result.referenceReview.appliedCount,1);assert.equal(result.referenceReview.baseHash,hash(f.state.doc.content));assert.equal(result.referenceReview.entries[0].actions.length,2)
 const final=await f.run({taskId:result.id,fields:[{key:'a',field:'title'},{key:'a',field:'publisher'}]})
 const parsed=parseBibliography(f.state.doc.content).entries[0];assert.equal(parsed.fields.title,'{Correct}');assert.equal(parsed.fields.publisher,'ACM');assert.equal(parsed.fields.custom,'keep');assert.equal(final.referenceReview.appliedCount,3);assert.equal(f.state.writes,2)
})
test('all fields are applied as one version-checked document update',async()=>{
 const f=fixture();await f.run({taskId:'audit',fields:['title','year','publisher'].map(field=>({key:'a',field}))});assert.equal(f.state.writes,1)
})
test('stale snapshot, replay, unauthorized user and arbitrary field selections cannot write',async()=>{
 const f=fixture();f.state.allowed=false;await assert.rejects(f.run({taskId:'audit',fields:[{key:'a',field:'year'}]}),{status:403});f.state.allowed=true
 for(const fields of [[{key:'a',field:'custom'}],[{key:'b',field:'year'}],[{key:'a',field:'year'},{key:'a',field:'year'}]]) await assert.rejects(f.run({taskId:'audit',fields}))
 await assert.rejects(applyReferenceReview(f.deps,'other','p',{taskId:'audit',fields:[{key:'a',field:'year'}]}),{status:404})
 f.state.doc.content=f.state.doc.content.replace('year={2020}','year={2019}');await assert.rejects(f.run({taskId:'audit',fields:[{key:'a',field:'year'}]}),{status:409});assert.equal(f.state.writes,0)
 const fresh=fixture();await fresh.run({taskId:'audit',fields:[{key:'a',field:'year'}]});await assert.rejects(fresh.run({taskId:'audit',fields:[{key:'a',field:'year'}]}),{status:409});assert.equal(fresh.state.writes,1)
})
test('source uncertainty and pending proposals block direct application',async()=>{
 const f=fixture();f.map.get('audit').referenceReview.entries[0].identity='Title-only candidate';await assert.rejects(f.run({taskId:'audit',fields:[{key:'a',field:'year'}]}),{status:422});assert.equal(f.state.writes,0)
 f.map.get('audit').proposals=[{status:'pending'}];await assert.rejects(f.run({taskId:'audit',fields:[{key:'a',field:'year'}]}),{status:409})
})

test('a matching pending combined preview does not block individual field application',async()=>{
 const f=fixture();f.map.get('audit').proposals=[{status:'pending',docId:'b',before:f.state.doc.content,after:'whole preview'}]
 const result=await f.run({taskId:'audit',fields:[{key:'a',field:'year'}]})
 assert.equal(f.state.writes,1);assert.equal(result.referenceReview.appliedCount,1)
 assert.match(f.state.doc.content,/title=\{Wrong\}/);assert.match(f.state.doc.content,/year=\{2024\}/)
})

for (const all of [false,true]) test(`four batches apply sequentially (${all?'all fields':'individual fields'}) without losing other edits`,async()=>{
 const f=fixture();f.state.doc.content=Array.from({length:4},(_,i)=>`@article{k${i},title={Title ${i}},year={2020}}`).join('\n')
 for(let i=0;i<4;i++)f.map.set(`batch${i}`,{id:`batch${i}`,userId:'u',projectId:'p',status:'completed',proposals:[],referenceReview:{docId:'b',baseHash:hash(f.state.doc.content),entries:[{key:`k${i}`,source:'https://example.org',fields:[{field:'title',current:`Title ${i}`,found:`Title ${i}`,status:'matches'},{field:'year',current:'2020',found:'2024',status:'review-difference'},{field:'publisher',current:'',found:'ACM',status:'missing-in-bibliography'}],actions:[{field:'year',before:'2020',after:'2024'},{field:'publisher',before:'',after:'ACM'}]}]}})
 f.state.doc.content+='\n% concurrent unrelated comment'
 for(let i=0;i<4;i++){
  const result=await f.run({taskId:`batch${i}`,fields:(all?['year','publisher']:['year']).map(field=>({key:`k${i}`,field}))})
  if(!all)await f.run({taskId:result.id,fields:[{key:`k${i}`,field:'publisher'}]})
 }
 assert.equal(f.state.writes,all?4:8)
 for(const entry of parseBibliography(f.state.doc.content).entries){assert.equal(entry.fields.year,'2024');assert.equal(entry.fields.publisher,'ACM')}
 assert.ok(f.state.doc.content.endsWith('% concurrent unrelated comment'))
})
test('rebasing refuses a changed reference identity even if selected field is unchanged',async()=>{
 const f=fixture();f.state.doc.content=f.state.doc.content.replace('title={Wrong}','title={Different paper}')
 await assert.rejects(f.run({taskId:'audit',fields:[{key:'a',field:'publisher'}]}),{status:409});assert.equal(f.state.writes,0)
})

const workspaceIdentity={projectId:'root',workspaceId:'p',branch:'draft',epoch:3}
test('derived reference application inherits review identity across partial batches',async()=>{
 const f=fixture();f.map.get('audit').workspaceIdentity={...workspaceIdentity}
 f.deps.readWorkspaceIdentity=async()=>({...workspaceIdentity})
 const first=await f.run({taskId:'audit',fields:[{key:'a',field:'year'}]})
 assert.deepEqual(first.workspaceIdentity,workspaceIdentity)
 const next=await f.run({taskId:first.id,fields:[{key:'a',field:'title'}]})
 assert.deepEqual(next.workspaceIdentity,workspaceIdentity)
})
for(const timing of ['before-snapshot','during-snapshot'])test(`reference review epoch change ${timing} cannot be rebased into new workspace`,async()=>{
 const f=fixture();f.map.get('audit').workspaceIdentity={...workspaceIdentity}
 let current={...workspaceIdentity,epoch:timing==='before-snapshot'?4:3}
 f.deps.readWorkspaceIdentity=async()=>({...current})
 const snapshot=f.deps.snapshot
 f.deps.snapshot=async()=>{current.epoch=4;return snapshot()}
 await assert.rejects(f.run({taskId:'audit',fields:[{key:'a',field:'year'}]}),{code:'AI_WORKSPACE_CHANGED'})
 assert.equal(f.state.writes,0);assert.equal(f.map.size,1)
})

test('reference continuation is persisted before writer dispatch and survives interrupted response',async()=>{
 const f=fixture()
 f.deps.tasks.decide=async(u,p,id)=>{
  const task=f.map.get(id),proposal=task.proposals[0]
  assert.equal(task.referenceReview,undefined)
  assert.equal(task.applicationOutcome.proposalId,proposal.id)
  assert.equal(task.applicationOutcome.afterHash,hash(proposal.after))
  assert.equal(task.applicationOutcome.fields.referenceReview.appliedCount,1)
  assert.equal(task.applicationOutcome.fields.referenceReview.entries[0].actions.some(a=>a.field==='year'),false)
  throw Error('interrupted response')
 }
 await assert.rejects(f.run({taskId:'audit',fields:[{key:'a',field:'year'}]}),/interrupted response/)
 assert.equal(f.map.size,2)
 assert.equal(f.map.get('audit').referenceReview.appliedCount,undefined)
})
