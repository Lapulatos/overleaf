import {test} from 'node:test'
import assert from 'node:assert/strict'
import {annotateAutoSyncBranches} from '../../app/src/Features/NativeGit/AutoCommitIndicators.mjs'
test('sync marker follows enabled local workspace, not remote target; disabling removes it',async()=>{
 const branches=[{name:'local'},{name:'remote-target'},{name:'local',remote:true},{name:'local',tag:true}]
 const workspaces=[{id:'a',branch:'local'}]
 const policy={enabled:true,state:'scheduled',workspaceBranch:'local',branch:'remote-target'}
 const read=async()=>policy
 const enabled=await annotateAutoSyncBranches(branches,workspaces,read)
 assert.deepEqual(enabled.map(b=>!!b.autoSync),[true,false,false,false])
 policy.enabled=false
 assert.ok((await annotateAutoSyncBranches(branches,workspaces,read)).every(b=>!b.autoSync))
 assert.ok(branches.every(b=>!b.autoSync))
})
test('paused remains marked; archived, missing or changed branch schedules are omitted',async()=>{
 const branches=[{name:'a'},{name:'b'},{name:'c'},{name:'d'}]
 const workspaces=branches.map(b=>({id:b.name,branch:b.name,archived:b.name==='b'}))
 const result=await annotateAutoSyncBranches(branches,workspaces,async id=>id==='d'?null:{enabled:true,state:'paused',workspaceBranch:id==='c'?'old':id})
 assert.equal(result[0].autoSync.state,'paused')
 assert.ok(result.slice(1).every(b=>!b.autoSync))
})
