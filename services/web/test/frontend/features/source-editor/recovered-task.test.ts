import { expect } from 'chai'
import { replaceRecoveredTask } from '@/features/source-editor/extensions/writing-assist/recovered-task'
import type { Task } from '@/features/source-editor/extensions/writing-assist/agent-task-result'
const current:Task={taskId:'task',projectId:'p',workspaceIdentity:{projectId:'root',workspaceId:'p',branch:'draft',epoch:2},status:'completed',instruction:'Edit',summary:'Old',output:'',proposals:[]}
describe('recovered task identity',()=>{
 it('updates the original task with full recovered metadata',()=>{
  const recovered={...current,summary:'Recovered'}
  expect(replaceRecoveredTask(current,recovered)).to.equal(recovered)
 })
 it('never resurrects a cleared task',()=>{
  expect(replaceRecoveredTask(null,current)).to.equal(null)
  expect(replaceRecoveredTask(undefined,current)).to.equal(undefined)
 })
 for(const changed of [{taskId:'other'},{projectId:'other'},{workspaceIdentity:null},...['projectId','workspaceId','branch','epoch'].map(key=>({workspaceIdentity:{...current.workspaceIdentity!,[key]:key==='epoch'?3:'other'}}))])it(`rejects late response with changed ${JSON.stringify(changed)}`,()=>{
  expect(replaceRecoveredTask(current,{...current,...changed})).to.equal(current)
 })
 it('permits legacy tasks only when both lack workspace identity',()=>{
  const legacy={...current,workspaceIdentity:null};const recovered={...legacy,summary:'Recovered'}
  expect(replaceRecoveredTask(legacy,recovered)).to.equal(recovered)
  expect(replaceRecoveredTask(legacy,current)).to.equal(legacy)
 })
})
