import test from 'node:test'
import assert from 'node:assert/strict'
import {createGoalService,parseGoalReview,goalElapsed,goalTiming} from '../../app/src/Features/WritingAssist/WritingAssistGoalService.mjs'
import {normalizeScope,isInScope,assertScopedProposals} from '../../app/src/Features/WritingAssist/WritingAssistScope.mjs'
function fixture(mode='human'){
 let g={_id:'goal',userId:'u',projectId:'p',conversationId:'c',objective:'Fix the selected document',reviewMode:mode,scope:[{kind:'folder',path:'tex'}],skills:[],status:'active',stage:'work',taskId:'work',workTaskId:null,revision:0,leaseToken:'lease',steps:0,recent:[]},allowed=true
 const records=new Map(),created=[],decisions=[]
 const store={replace:async(id,rev,f)=>{if(rev!==g.revision)return null;g={...g,...f,revision:rev+1};return g},find:async()=>g,findId:async()=>g,active:async v=>v.revision===g.revision&&g.status==='active',save:async(v,f)=>{if(v.revision!==g.revision)return null;g={...g,...f,revision:g.revision+1};return g},action:async(id,rev,f)=>{if(rev!==g.revision)return null;g={...g,...f,revision:rev+1};return g}}
 const tasks={get:async(u,p,id)=>{if(!allowed)throw Object.assign(Error('denied'),{status:403});if(!records.has(id))throw Object.assign(Error('missing'),{status:404});return records.get(id)},create:async(u,p,instruction,options)=>{created.push({instruction,options});const t={taskId:options.taskId,status:'running',proposals:[]};records.set(t.taskId,t);return t},cancel:async(u,p,id)=>{if(records.has(id))records.get(id).status='cancelled'},decide:async(u,p,id,pid,accept)=>{decisions.push({pid,accept});const t=records.get(id);t.proposals=t.proposals.map(x=>x.id===pid?{...x,status:accept?'accepted':'rejected'}:x);return t}}
 const conversations={get:async()=>{if(!allowed)throw Object.assign(Error('denied'),{status:403});return {activeTaskId:null}}}
 const service=createGoalService({store,tasks,conversations})
 const work=(proposals=[])=>records.set(g.taskId,{taskId:g.taskId,status:'completed',summary:'Changed selected document; test passed',activity:[],proposals})
 const review=(decision='approve',goalStatus='continue')=>records.set(g.taskId,{taskId:g.taskId,status:'completed',summary:JSON.stringify({decision,goalStatus,reason:'Checked evidence',nextStep:'Verify result'}),proposals:[]})
 return {service,records,created,decisions,work,review,get goal(){return g},setGoal:fields=>{g={...g,...fields}},deny:()=>{allowed=false}}
}
test('scope validates paths and rejects prefix siblings and outside proposals',()=>{
 const scope=normalizeScope([{kind:'folder',path:'tex'},{kind:'file',path:'refs.bib'}]);assert.ok(isInScope('tex/a.tex',scope));assert.ok(isInScope('refs.bib',scope));assert.ok(!isInScope('text/a.tex',scope));assert.throws(()=>assertScopedProposals([{path:'main.tex'}],scope),{status:422});for(const path of ['../a','/tex','tex//a','tex/../a','tex\\a'])assert.throws(()=>normalizeScope([{kind:'folder',path}]))
})
test('human review waits then advances after explicit review; background state is durable',async()=>{
 const f=fixture();f.work([{id:'p1',path:'tex/a.tex',status:'pending'}]);await f.service.tick(f.goal);assert.equal(f.goal.stage,'review');f.review();await f.service.tick(f.goal);assert.equal(f.goal.status,'waiting_review');assert.equal(f.decisions.length,0);await f.service.tick(f.goal);assert.equal(f.goal.status,'waiting_review');f.records.get('work').proposals[0].status='accepted';await f.service.tick(f.goal);assert.equal(f.goal.status,'active');assert.equal(f.goal.stage,'work');assert.equal(f.goal.steps,1);assert.notEqual(f.goal.taskId,'work')
})
test('AI review completes an independently verified batch after successful application',async()=>{
 const f=fixture('ai');f.work([{id:'p1',path:'tex/a.tex',status:'pending'}]);await f.service.tick(f.goal);f.review('approve','complete');await f.service.tick(f.goal);assert.deepEqual(f.decisions,[{pid:'p1',accept:true}]);assert.equal(f.goal.status,'completed')
})
test('review revision rejects changes and continues; blocked review never applies',async()=>{
 for(const decision of ['revise','blocked']){const f=fixture('ai');f.work([{id:'p1',path:'tex/a.tex',status:'pending'}]);await f.service.tick(f.goal);f.review(decision);await f.service.tick(f.goal);assert.equal(f.goal.status,decision==='blocked'?'blocked':'active');assert.ok(f.decisions.every(d=>!d.accept));if(decision==='blocked')assert.equal(f.decisions.length,0)}
})
test('persisted task id is reused after worker restart; pause prevents new submission',async()=>{
 const f=fixture();await f.service.tick(f.goal);await f.service.tick(f.goal);assert.equal(f.created.length,1);assert.deepEqual(f.created[0].options.scope,f.goal.scope);await f.service.action('u','p','c','pause');await f.service.tick(f.goal);assert.equal(f.created.length,1);assert.equal(f.goal.status,'paused');await f.service.action('u','p','c','resume');await f.service.tick(f.goal);assert.equal(f.created.length,2)
})
test('stale lease cannot dispatch and invalid review cannot claim completion',async()=>{
 const f=fixture();const old=f.goal;f.setGoal({revision:2,status:'paused'});await f.service.tick(old);assert.equal(f.created.length,0);assert.throws(()=>parseGoalReview('All done'),{status:422});assert.throws(()=>parseGoalReview('{"decision":"approve"}'),{status:422});f.deny();await assert.rejects(f.service.get('u','p','c'),{status:403})
})

test('task service rejects an out-of-scope apply before claiming or writing',async()=>{
 const {createAgentService}=await import('../../app/src/Features/WritingAssist/WritingAssistAgentService.mjs');let claimed=false,written=false
 const service=createAgentService({canWrite:async()=>true,store:{find:async()=>({id:'t',status:'completed',scope:[{kind:'file',path:'allowed.tex'}],proposals:[{id:'p',path:'outside.tex',before:'x',after:'y',status:'pending'}]}),claim:async()=>{claimed=true;return true}},writeDocument:async()=>{written=true}})
 await assert.rejects(service.decide('u','p','t','p',true),{status:422});assert.equal(claimed,false);assert.equal(written,false)
})
test('out-of-scope creation from the agent fails the entire batch',async()=>{
 const {createAgentService}=await import('../../app/src/Features/WritingAssist/WritingAssistAgentService.mjs');let task={id:'t',status:'running',scope:[{kind:'folder',path:'tex'}],documents:[]}
 const service=createAgentService({canWrite:async()=>true,store:{find:async()=>task,finish:async(id,fields)=>{task={...task,...fields}}},daemon:async()=>({status:'completed',summary:'Done',diffs:[{kind:'create',path:'outside.tex',content:'outside'}]})})
 const result=await service.get('u','p','t');assert.equal(result.status,'failed');assert.deepEqual(result.proposals,[])
})

test('review task supplies immutable baseline evidence and explains pending snapshot semantics',async()=>{
 const f=fixture();f.setGoal({baseline:[{path:'tex/a.tex',hash:'before'}]});f.work([{id:'p1',path:'tex/a.tex',before:'old',after:'new',status:'pending'}]);await f.service.tick(f.goal);await f.service.tick(f.goal)
 const review=f.created[0];assert.equal(review.options.reportOnly,true);assert.equal(review.options.includeProjectAssets,true);assert.match(review.instruction,/NOT YET applied/);const evidence=JSON.parse(Buffer.from(review.options.extraAssets[0].data,'base64').toString());assert.equal(evidence.initialFiles[0].hash,'before');assert.equal(evidence.proposals[0].after,'new')
})


test('active time excludes pauses and review waits; restart retains time, reset clears it',async()=>{
 const g={status:'active',elapsedMs:5000,runningSince:new Date(10000)}
 assert.equal(goalElapsed(g,14000),9000)
 assert.deepEqual(goalTiming(g,'paused',14000),{elapsedMs:9000,runningSince:null})
 assert.equal(goalElapsed({...g,status:'waiting_review'},14000),5000)
 const f=fixture();f.setGoal({status:'paused',elapsedMs:9000,runningSince:null,workTaskId:'old-work',steps:3});
 await f.service.action('u','p','c','resume');assert.equal(f.goal.elapsedMs,9000);assert.equal(f.goal.stage,'work');assert.equal(f.goal.workTaskId,null);assert.equal(f.goal.steps,3)
 await f.service.action('u','p','c','pause');await f.service.action('u','p','c','reset');assert.equal(f.goal.elapsedMs,0);assert.equal(f.goal.steps,0);assert.deepEqual(f.goal.recent,[])
})
test('expired countdown pauses before dispatch or apply and resume cannot silently reset it',async()=>{
 const f=fixture('ai');f.setGoal({elapsedMs:60000,timeLimitMs:60000,runningSince:new Date()});await f.service.tick(f.goal);assert.equal(f.goal.status,'paused');assert.equal(f.created.length,0);assert.equal(f.decisions.length,0);await assert.rejects(f.service.action('u','p','c','resume'),{status:409});await f.service.action('u','p','c','reset');assert.equal(f.goal.elapsedMs,0);assert.equal(f.goal.timeLimitMs,60000)
})
test('resume of stopped goal starts a fresh task and keeps accumulated history/time',async()=>{
 const f=fixture();f.setGoal({status:'cancelled',elapsedMs:12000,runningSince:null});await f.service.action('u','p','c','resume');assert.equal(f.goal.status,'active');assert.equal(f.goal.elapsedMs,12000);assert.notEqual(f.goal.taskId,'work');await f.service.tick(f.goal);assert.equal(f.created.length,1)
})

test('replacing a goal validates the new objective before stopping and resets its timer',async()=>{
 const f=fixture();f.setGoal({elapsedMs:5000,steps:2});await assert.rejects(f.service.start('u','p','c',{objective:'',replaceExisting:true}),{status:400});assert.equal(f.goal.status,'active');assert.equal(f.goal.elapsedMs,5000)
 await f.service.start('u','p','c',{objective:'A new objective',replaceExisting:true,reviewMode:'ai'});assert.equal(f.goal.objective,'A new objective');assert.equal(f.goal.elapsedMs,0);assert.equal(f.goal.steps,0);assert.equal(f.goal.status,'active');assert.notEqual(f.goal.taskId,'work')
})

 test('changed summary wording cannot keep a stalled goal running',async()=>{
 const f=fixture('ai');
 for(let i=0;i<3;i++){
 f.work();f.records.get(f.goal.taskId).summary=`Different wording ${i}, same inaccessible sources`;
 await f.service.tick(f.goal);f.review();await f.service.tick(f.goal);
 }
 assert.equal(f.goal.status,'blocked');assert.equal(f.goal.noProgress,3);
 assert.equal(f.goal.recent.length,3);
 })
 test('new verified checkpoints advance read-only work; repeated ones do not',async()=>{
 const f=fixture('ai');
 for(let i=0;i<2;i++){
 f.work();await f.service.tick(f.goal);f.review();
 const review=f.records.get(f.goal.taskId);review.summary=JSON.stringify({...JSON.parse(review.summary),checkpoints:['reference:foo:doi:verified']});
 await f.service.tick(f.goal);
 }
 assert.equal(f.goal.status,'active');assert.equal(f.goal.noProgress,1);
 })
 test('explicit external blocker overrides an inconsistent continue decision',async()=>{
 const f=fixture('ai');f.work();await f.service.tick(f.goal);f.review();
 const task=f.records.get(f.goal.taskId);task.summary=JSON.stringify({...JSON.parse(task.summary),blocker:'DNS resolution unavailable for all authoritative sources'});
 await f.service.tick(f.goal);assert.equal(f.goal.status,'blocked');assert.equal(f.decisions.length,0);
 })
