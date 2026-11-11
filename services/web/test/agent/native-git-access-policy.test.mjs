import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {readAccessPolicy,saveAccessPolicy,requireRepositoryWrite} from '../../app/src/Features/NativeGit/AccessPolicy.mjs'
import {approveTerminal,consumeTerminalApproval} from '../../app/src/Features/NativeGit/TerminalAccess.mjs'
test('policy persists per user, denies read-only writes and drops retired grants even before expiry',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'access-policy-'));t.after(()=>rm(root,{recursive:true,force:true}))
 assert.equal((await readAccessPolicy(root,'a')).mode,'workspace-write')
 await saveAccessPolicy(root,'a',{mode:'read-only',directories:[]})
 assert.throws(()=>requireRepositoryWrite({mode:'read-only'}),/Read-only/)
 assert.equal((await readAccessPolicy(root,'a')).mode,'read-only');assert.equal((await readAccessPolicy(root,'b')).mode,'workspace-write')
 await saveAccessPolicy(root,'a',{mode:'extended',directories:['/var/lib/overleaf/extra'],expires:Date.now()+30*60*1000})
 assert.deepEqual(await readAccessPolicy(root,'a'),{mode:'workspace-write',directories:[]})
})
test('approval is single-use and bound to exact owner and directories',()=>{
 const dirs=['/var/lib/overleaf/extra'];const {approval}=approveTerminal('project:user',dirs)
 assert.throws(()=>consumeTerminalApproval('other:user',approval,dirs),/Approve/)
 const grant=approveTerminal('project:user',dirs);consumeTerminalApproval('project:user',grant.approval,dirs)
 assert.throws(()=>consumeTerminalApproval('project:user',grant.approval,dirs),/Approve/)
 const another=approveTerminal('project:user',dirs);assert.throws(()=>consumeTerminalApproval('project:user',another.approval,['/var/lib/overleaf/other']),/Approve/)
})
