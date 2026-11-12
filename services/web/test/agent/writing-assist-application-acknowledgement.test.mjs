import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationAcknowledgement, validatedApplicationAcknowledgement } from '../../app/src/Features/WritingAssist/WritingAssistApplicationAcknowledgement.mjs'
const task={id:'task',userId:'u',projectId:'p',workspaceIdentity:{projectId:'root',workspaceId:'p',branch:'draft',epoch:2}}
const proposal={id:'change',docId:'doc',path:'main.tex',version:3,before:'old',after:'new',status:'applying'}
test('acknowledgement binds operation to identity and exact proposal contents',()=>{
 const value={...proposal,applicationAcknowledgement:applicationAcknowledgement(task,proposal)}
 assert.equal(validatedApplicationAcknowledgement(task,value).state,'server-acknowledged')
 for(const key of ['id','docId','path','version','before','after','mode']){
  const changed={...value,[key]:key==='version'?4:'different'}
  assert.equal(validatedApplicationAcknowledgement(task,changed),null,key)
 }
 for(const key of ['id','userId','projectId'])assert.equal(validatedApplicationAcknowledgement({...task,[key]:'other'},value),null,key)
 assert.equal(validatedApplicationAcknowledgement({...task,workspaceIdentity:{...task.workspaceIdentity,epoch:3}},value),null)
})
test('missing malformed or deletion acknowledgements never confirm an operation',()=>{
 assert.equal(validatedApplicationAcknowledgement(task,proposal),null)
 const receipt=applicationAcknowledgement(task,proposal)
 for(const acknowledgedAt of [undefined,'invalid',42])assert.equal(validatedApplicationAcknowledgement(task,{...proposal,applicationAcknowledgement:{...receipt,acknowledgedAt}}),null)
 assert.equal(validatedApplicationAcknowledgement(task,{...proposal,mode:'delete-document',applicationAcknowledgement:receipt}),null)
})
