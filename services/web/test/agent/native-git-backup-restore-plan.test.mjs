import test from 'node:test'
import assert from 'node:assert/strict'
import { planBackupRestore } from '../../app/src/Features/NativeGit/BackupRestorePlan.mjs'
const root='000000000000000000000001', child='000000000000000000000002', owner='000000000000000000000003'
function fixture() {
  const manifest={format:'overleaf-git-collaboration-backup',version:1,projectId:root,id:'archive',workspaces:[{workspaceId:root},{workspaceId:child}]}
  const meta=[root,child].map((id,i)=>({project:{_id:id,name:'Paper',rootDoc_id:`00000000000000000000001${i}`,rootFolder:[{_id:`00000000000000000000002${i}`,name:'rootFolder',docs:[{_id:`00000000000000000000001${i}`,name:'main.tex'}],folders:[],fileRefs:[]}],gitWorkspaceEpoch:12+i,gitWorkspace:i?{logicalProjectId:root,branch:'topic',state:'ready'}:undefined,tokens:{readOnly:'never restore'},collaberator_refs:['old-member']},documents:{'main.tex':{id:`00000000000000000000001${i}`,version:7,lines:['paper'],ranges:{comments:[{id:'thread'}]}}},threads:{},messages:[]}))
  return {manifest,meta}
}
test('restore uses private new identities and newer epochs while keeping text and references',()=>{
  const {manifest,meta}=fixture(), original=JSON.stringify(meta)
  const plan=planBackupRestore(manifest,meta,owner)
  assert.notEqual(plan.targetProjectId,root)
  assert.equal(plan.taskPolicy,'evidence-only');assert.equal(plan.schedulePolicy,'disabled')
  for(let i=0;i<2;i++){
    const w=plan.workspaces[i];assert.notEqual(w.project._id,meta[i].project._id)
    assert.equal(w.project.gitWorkspaceEpoch,13+i)
    assert.equal(w.project.name,'Paper (restored)')
    assert.equal(w.project.rootDoc_id,w.documents['main.tex'].id)
    assert.deepEqual(w.documents['main.tex'].lines,['paper'])
    assert.equal(w.project.tokens,undefined);assert.deepEqual(w.project.collaberator_refs,[])
  }
  assert.equal(plan.workspaces[1].project.gitWorkspace.logicalProjectId,plan.targetProjectId)
  assert.equal(JSON.stringify(meta),original)
})
test('incomplete, cross-project, reused identities and invalid epochs refuse restoration',()=>{
  const {manifest,meta}=fixture()
  assert.throws(()=>planBackupRestore(manifest,meta.slice(1),owner),/Incomplete/)
  assert.throws(()=>planBackupRestore(manifest,meta,owner,{allocate:()=>root}),/collision/)
  meta[1].project.gitWorkspace.logicalProjectId=owner
  assert.throws(()=>planBackupRestore(manifest,meta,owner),/another project/)
  meta[1].project.gitWorkspace.logicalProjectId=root;meta[1].project.gitWorkspaceEpoch=Number.MAX_SAFE_INTEGER
  assert.throws(()=>planBackupRestore(manifest,meta,owner),/epoch/)
})
