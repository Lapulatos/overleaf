import {test} from 'node:test'
import assert from 'node:assert/strict'
import {shellSessionWorkspace} from '../../app/src/Features/NativeGit/ShellSessionWorkspace.mjs'
const task={kind:'shell-draft',logicalProjectId:'project',createdBy:'me',workspaceId:'branch-a'}
const args={store:{read:async()=>task},logicalProjectId:'project',actorId:'me',currentWorkspaceId:'branch-b'}
test('session actions follow stored workspace; creation/apply stay in viewed workspace',async()=>{
 for(const name of ['shellDraftGet','shellDraftInput','shellDraftStart','shellDraftDelete','shellDraftHistory'])assert.equal(await shellSessionWorkspace({...args,command:{command:name,id:'session',workspaceId:'spoof'}}),'branch-a')
 for(const name of ['shellDraftPrepare','shellDraftList','shellDraftApply','shellDraftRecover'])assert.equal(await shellSessionWorkspace({...args,command:{command:name,id:'session'}}),'branch-b')
})
test('foreign and removed sessions cannot be routed',async()=>{
 for(const patch of [{logicalProjectId:'other'},{createdBy:'other'},{deletedAt:1}])await assert.rejects(shellSessionWorkspace({...args,store:{read:async()=>({...task,...patch})},command:{command:'shellDraftInput',id:'session'}}))
})
