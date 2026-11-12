import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shellReviewFingerprint, shellReviewOverview, shellReviewFile } from '../../app/src/Features/NativeGit/ShellDraftReview.mjs'
const task={id:'draft',revision:8,logicalProjectId:'project',workspaceId:'workspace',workspaceEpoch:3,createdBy:'actor',baseline:{documents:{a:{id:'doc',version:2}}},baselineManifest:[{path:'a',hash:'old'}],reviewManifest:[{path:'a',hash:'new'}]}
const review={task,changes:[{path:'a',before:Buffer.from('original'),after:Buffer.from('edited')}]}
test('sealed review binds file previews to exact task and baseline identity',()=>{
 const overview=shellReviewOverview(review)
 const file=shellReviewFile(review,'a',overview.fingerprint)
 assert.equal(file.before.text,'original');assert.equal(file.after.text,'edited')
 assert.notEqual(file.before.hash,file.after.hash)
 assert.equal(file.task.baseline,undefined)
 for(const change of [{revision:9},{workspaceEpoch:4},{createdBy:'other'},{baseline:{documents:{a:{id:'doc',version:3}}}},{reviewManifest:[]}]){
  const changed={...review,task:{...task,...change}}
  assert.notEqual(shellReviewFingerprint(changed.task),overview.fingerprint)
  assert.throws(()=>shellReviewFile(changed,'a',overview.fingerprint),/review changed/)
 }
})
test('binary, invalid UTF8 and large files are described without lossy text',()=>{
 for(const bytes of [Buffer.from([0,1]),Buffer.from([0xff,0xfe]),Buffer.alloc(1024*1024+1,65)]){
  const item={task,changes:[{path:'binary',after:bytes}]}
  const file=shellReviewFile(item,'binary',shellReviewFingerprint(task))
  assert.equal(file.before.exists,false);assert.equal(file.after.exists,true)
  assert.equal(file.after.text,null);assert.equal(file.after.bytes,bytes.length)
  assert.match(file.after.hash,/^[a-f0-9]{64}$/)
 }
})
test('empty existing file is distinct from deletion and unrelated paths are refused',()=>{
 const item={task,changes:[{path:'empty',before:Buffer.alloc(0)}]}
 const fp=shellReviewFingerprint(task), file=shellReviewFile(item,'empty',fp)
 assert.equal(file.before.exists,true);assert.equal(file.before.text,'');assert.equal(file.after.exists,false)
 assert.throws(()=>shellReviewFile(item,'../baseline',fp),/not part/)
})
