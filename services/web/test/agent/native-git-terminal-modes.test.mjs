import test from 'node:test'
import assert from 'node:assert/strict'
import {TerminalReviews,reviewCommand} from '../../app/src/Features/NativeGit/TerminalReview.mjs'
import {terminalContainerArgs,mountsFor} from '../../app/src/Features/NativeGit/TerminalContainer.mjs'
const project='a'.repeat(24),directory=`/var/lib/overleaf/native-git/${project}/worktrees/test`,commonDirectory=`/var/lib/overleaf/native-git/${project}/repository/.git`
test('review allowlist does not accept shell composition or whitespace normalization',()=>{
 assert.equal(reviewCommand('pwd').automatic,true)
 for(const text of ['pwd; rm x','ls\nrm x','$(pwd)','ls > x','ls -la /',' pwd','cat x','python3 x'])assert.equal(reviewCommand(text).automatic,false,text)
})
test('review approvals bind exact command, owner, session, expiry and single use',()=>{
 const reviews=new TerminalReviews(),text='touch draft'
 const grant=reviews.authorize('a','owner',text)
 assert.equal(grant.approvalRequired,true)
 assert.throws(()=>reviews.authorize('a','other',text,grant.approval),/match/)
 const next=reviews.authorize('a','owner',text)
 assert.throws(()=>reviews.authorize('a','owner','touch other',next.approval),/match/)
 const ok=reviews.authorize('a','owner',text)
 assert.equal(reviews.authorize('a','owner',text,ok.approval).command,text)
 assert.throws(()=>reviews.authorize('a','owner',text,ok.approval),/match/)
 const expired=reviews.authorize('a','owner',text);reviews.pending.get('a').expires=0
 assert.throws(()=>reviews.authorize('a','owner',text,expired.approval),/expired/)
 const revoked=reviews.authorize('a','owner',text);reviews.revoke('a')
 assert.throws(()=>reviews.authorize('a','owner',text,revoked.approval),/expired/)
})
test('all modes use only scoped named-volume mounts, isolated network and protected metadata',()=>{
 for(const mode of ['read-only','workspace-write','auto-review','full-access']) {
  const args=terminalContainerArgs({project,directory,commonDirectory,mode},'test-volume','test-image')
  assert.equal(args[args.indexOf('--network')+1],'none')
  assert.equal(args.includes('--read-only'),mode!=='full-access')
  assert.equal(args.includes('--privileged'),false)
  const mounts=args.filter((_,i)=>args[i-1]==='--mount')
  assert.equal(mounts.length,3)
  assert.ok(mounts.every(m=>m.startsWith('type=volume,src=test-volume,')))
  assert.ok(mounts.find(m=>m.includes(`dst=${commonDirectory},`)).endsWith(',readonly'))
  assert.ok(!args.some(a=>a.includes('docker.sock')||a.includes('host.docker.internal')))
 }
})
test('rejects host paths, cross-project paths, retired grants and traversal',()=>{
 for(const dir of ['/Users/example',directory+'/../other','/var/lib/overleaf/native-git/'+ 'b'.repeat(24)+'/repo'])assert.throws(()=>mountsFor({directory:dir,mode:'full-access'},project))
 assert.throws(()=>mountsFor({directory,mode:'extended'},project))
 assert.throws(()=>mountsFor({directory,mode:'full-access',directories:['/Users']},project))
})
