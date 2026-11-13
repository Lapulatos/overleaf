import test from 'node:test'
import assert from 'node:assert/strict'
import { createGitHubSkills } from '../../app/src/Features/Plugins/GitHubSkills.mjs'
const url='https://github.com/owner/repo', sha='a'.repeat(40), blob='b'.repeat(40)
function response(path){
 if(path.endsWith('/owner/repo'))return Response.json({default_branch:'main',private:false})
 if(path.includes('/commits/'))return Response.json({sha})
 if(path.includes('/trees/'))return Response.json({tree:[{path:'SKILL.md',type:'blob',mode:'100644',sha:blob,size:30}]})
 return Response.json({encoding:'base64',content:Buffer.from('---\nname: demo\n---\nInstructions').toString('base64')})
}
test('rate limit reports reset and avoids requests during cooldown',async()=>{
 let calls=0,clock=0
 const client=createGitHubSkills(async()=>{calls++;return Response.json({message:'API rate limit exceeded'},{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':'3600'}})},{now:()=>clock})
 await assert.rejects(client.discover(url),e=>e.status===429 && e.message.includes('01:00:00 UTC'))
 await assert.rejects(client.discover(url),{status:429});assert.equal(calls,1)
 clock=3600001;await assert.rejects(client.discover(url),{status:429});assert.equal(calls,2)
})
test('non-rate-limit 403 is not mislabeled; HTML 429 still respects Retry-After',async()=>{
 await assert.rejects(createGitHubSkills(async()=>Response.json({message:'Forbidden'},{status:403})).discover(url),e=>e.status===403 && /denied access/.test(e.message))
 const client=createGitHubSkills(async()=>new Response('<h1>Too many requests</h1>',{status:429,headers:{'Retry-After':'120'}}),{now:()=>0})
 await assert.rejects(client.discover(url),e=>e.status===429 && /00:02:00 UTC/.test(e.message))
})
test('discovery deduplicates parallel requests and caches immutable trees and blobs',async()=>{
 const calls=[];const client=createGitHubSkills(async path=>{calls.push(path);return response(path)})
 await Promise.all([client.discover(url),client.discover(url)])
 assert.equal(calls.length,3)
 await client.install(url,'SKILL.md',sha)
 await client.install(url,'SKILL.md',sha)
 assert.equal(calls.filter(x=>x.includes('/trees/')).length,1)
 assert.equal(calls.filter(x=>x.includes('/blobs/')).length,1)
 assert.equal(calls.filter(x=>x.includes('/commits/')).length,3)
})
test('cached tree never hides an updated branch during installation',async()=>{
 let changed=false
 const client=createGitHubSkills(async path=>path.includes('/commits/') && changed?Response.json({sha:'c'.repeat(40)}):response(path))
 await client.discover(url);changed=true
 await assert.rejects(client.install(url,'SKILL.md',sha),{status:409})
})
test('dedicated token is sent only to fixed API origin and private repositories are refused',async()=>{
 const calls=[]
 const client=createGitHubSkills(async(path,options)=>{calls.push(path);assert.ok(path.startsWith('https://api.github.com/repos/'));assert.equal(options.headers.Authorization,'Bearer test-only');assert.equal(options.redirect,'error');return Response.json({private:true,default_branch:'main'})},{token:'test-only'})
 await assert.rejects(client.discover(url+'/tree/main'),{status:422});assert.equal(calls.length,1)
})
test('immutable cache expires and invalid credentials have distinct sanitized errors',async()=>{
 let clock=0,trees=0
 const client=createGitHubSkills(async path=>{if(path.includes('/trees/'))trees++;return response(path)},{now:()=>clock})
 await client.discover(url);clock=300001;await client.discover(url);assert.equal(trees,2)
 await assert.rejects(createGitHubSkills(async()=>Response.json({message:'secret'},{status:401})).discover(url),e=>e.status===502 && !e.message.includes('secret') && e.message.includes('credential'))
})
test('bounded cache evicts old tree entries',async()=>{
 let trees=0
 const client=createGitHubSkills(async path=>{
  if(path.includes('/commits/'))return Response.json({sha})
  if(path.includes('/trees/'))trees++
  if(!path.includes('/git/'))return Response.json({default_branch:'main',private:false})
  return response(path)
 })
 for(let i=0;i<65;i++)await client.discover(`https://github.com/owner/repo${i}`)
 assert.equal(trees,65)
 await client.discover('https://github.com/owner/repo0');assert.equal(trees,66)
})
test('installed files remain pinned text instructions and exclude scripts',async()=>{
 const client=createGitHubSkills(async path=>path.includes('/trees/')?Response.json({tree:[
  {path:'demo/SKILL.md',type:'blob',mode:'100644',sha:blob,size:30},
  {path:'demo/run.sh',type:'blob',mode:'100644',sha:blob,size:30},
 ]}):response(path))
 const installed=await client.install(url,'demo/SKILL.md',sha)
 assert.equal(installed.commit,sha);assert.equal(installed.files.length,1)
 assert.deepEqual(installed.unsupportedFiles,['run.sh'])
})
test('batch installation retains successful Skills and reports each failed path',async()=>{
 const client=createGitHubSkills(async path=>response(path))
 const saved=[]
 const results=await client.installMany(url,['SKILL.md','missing/SKILL.md'],sha,async skill=>{saved.push(skill.name);return {command:skill.name}})
 assert.deepEqual(saved,['demo'])
 assert.equal(results[0].plugin.command,'demo')
 assert.match(results[1].error,/discovered Skills/)
})
test('batch rejects a changed revision before saving any Skill',async()=>{
 const client=createGitHubSkills(async path=>response(path))
 let saves=0
 await assert.rejects(client.installMany(url,['SKILL.md'],'c'.repeat(40),async()=>{saves++}),e=>e.status===409)
 assert.equal(saves,0)
})
test('import normalizes stray NUL characters in otherwise valid UTF-8 text',async()=>{
 const client=createGitHubSkills(async path=>path.includes('/blobs/')?Response.json({encoding:'base64',content:Buffer.from('---\nname: demo\n---\nExtracted\0 text').toString('base64')}):response(path))
 const skill=await client.install(url,'SKILL.md',sha)
 assert.equal(skill.files[0].content.includes('\0'),false)
 assert.match(skill.files[0].content,/Extracted text/)
})
