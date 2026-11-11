import test from 'node:test'
import assert from 'node:assert/strict'
import {parseGitHubSource,createGitHubSkills} from '../../app/src/Features/Plugins/GitHubSkills.mjs'
import {createSkillResolver} from '../../app/src/Features/Plugins/SkillInvocation.mjs'
const sha='a'.repeat(40),blob='b'.repeat(40)
function github({mode='100644',large=false,rootSkill=false}={}){
 const calls=[]
 const api=createGitHubSkills(async(url,options)=>{calls.push(url);assert.equal(options.redirect,'error');assert.ok(url.startsWith('https://api.github.com/repos/owner/repo'))
  if(url.endsWith('/repos/owner/repo'))return Response.json({default_branch:'main'})
  if(url.includes('/commits/'))return Response.json({sha})
  if(url.includes('/git/trees/'))return Response.json({truncated:large,tree:[...(rootSkill?[{path:'SKILL.md',type:'blob',mode:'100644',sha:blob,size:60}]:[]),{path:'skills/.curated/demo/SKILL.md',type:'blob',mode,sha:blob,size:60},{path:'skills/.curated/demo/scripts/run.py',type:'blob',mode:'100644',sha:blob,size:20}]})
  return Response.json({encoding:'base64',content:Buffer.from('---\nname: demo\ndescription: Example skill\n---\nCheck the project.').toString('base64')})
 });return {api,calls}
}
test('only GitHub HTTPS sources accepted; hidden curated source folders supported',()=>{
 for(const url of ['http://github.com/a/b','https://localhost/a/b','https://github.com@evil.test/a/b','https://github.com/a/b?token=x','https://github.com/a/b/tree/main/%2e%2e/x','https://github.com/a/b/tree/main/%ZZ'])assert.throws(()=>parseGitHubSource(url))
 assert.equal(parseGitHubSource('https://github.com/owner/repo/tree/main/skills/.curated/demo').path,'skills/.curated/demo')
 assert.equal(parseGitHubSource('https://github.com/owner/repo/blob/main/skills/demo/SKILL.md').path,'skills/demo')
})
test('discovers and installs pinned Skill text while reporting unsupported scripts',async()=>{
 const {api,calls}=github();const found=await api.discover('https://github.com/owner/repo');assert.equal(found.skills.length,1)
 const skill=await api.install('https://github.com/owner/repo',found.skills[0].path,sha)
 assert.equal(skill.name,'demo');assert.equal(skill.commit,sha);assert.equal(skill.files[0].path,'SKILL.md');assert.deepEqual(skill.unsupportedFiles,['scripts/run.py']);assert.ok(calls.some(url=>url.includes('/git/trees/'+sha)))
})
test('ref changes, oversized trees and symlink Skills are rejected',async()=>{
 await assert.rejects(github().api.install('https://github.com/owner/repo',undefined,'c'.repeat(40)),{status:409})
 await assert.rejects(github({large:true}).api.discover('https://github.com/owner/repo'),{status:422})
 await assert.rejects(github({mode:'120000'}).api.discover('https://github.com/owner/repo'),{status:422})
})
test('resolver is account-scoped, requires enabled plugin, preserves normal requests',async()=>{
 let enabled=true
 const resolve=createSkillResolver({findCommand:async(user,command)=>user==='owner' && command==='demo'?{_id:'test-id',command,commit:sha,enabled,files:[{path:'SKILL.md',content:'Check references.'},{path:'references/guide.md',content:'Evidence rules'}]}:null})
 assert.deepEqual(await resolve('owner','Ordinary request'),{instruction:'Ordinary request',assets:[]})
 await assert.rejects(resolve('other','/demo test'),{status:404})
 const value=await resolve('owner','/demo Check this paper');assert.match(value.instruction,/Check references/);assert.match(value.instruction,/Check this paper/);assert.equal(value.assets.length,2);assert.equal(value.plugin.commit,sha)
 enabled=false;await assert.rejects(resolve('owner','/demo test'),{status:409})
})
test('invalid command fails before any task or file is created',async()=>{
 const resolve=createSkillResolver({findCommand:async()=>null});await assert.rejects(resolve('owner','/missing request'),{status:404})
})
test('shared agent entrypoint expands Skill for daemon while preserving visible request and pinned revision',async()=>{
 const {createAgentService}=await import('../../app/src/Features/WritingAssist/WritingAssistAgentService.mjs')
 let record,submitted,allowed=true
 const resolver=createSkillResolver({findCommand:async()=>({_id:'id',command:'demo',commit:sha,enabled:true,files:[{path:'SKILL.md',content:'Check references.'}]})})
 const service=createAgentService({canWrite:async()=>allowed,resolveSkill:resolver,snapshot:async()=>[{id:'doc',path:'main.tex',version:1,content:'Original'}],snapshotAssets:async()=>[],store:{create:async value=>{record=value},prepare:async()=>true,markRunning:async()=>{record.status='running';return true},find:async()=>record,finish:async()=>{}},daemon:async(path,method,body)=>{if(path==='/agent/health')return {capabilities:{documentHarness:true}};submitted=body}})
 const result=await service.create('owner','project','/demo Check it',{model:'chosen',effort:'low'})
 assert.equal(result.instruction,'/demo Check it');assert.equal(result.plugin.commit,sha);assert.equal(submitted.model,'chosen');assert.match(submitted.instruction,/Check references/);assert.equal(submitted.context.assets.length,1);assert.equal(submitted.context.documents[0].content,'Original')
 allowed=false;await assert.rejects(service.create('other','project','/demo'),{status:403})
})

test('a root Skill does not suppress resources of an explicitly selected nested Skill',async()=>{
 const skill=await github({rootSkill:true}).api.install('https://github.com/owner/repo','skills/.curated/demo/SKILL.md',sha)
 assert.equal(skill.files[0].path,'SKILL.md')
})

test('display descriptions read folded and literal frontmatter without changing instructions',async()=>{
 const {skillDescription}=await import('../../app/src/Features/Plugins/SkillMetadata.mjs')
 for(const marker of ['>-','>','|','|-'])assert.equal(skillDescription(`---\nname: test\ndescription: ${marker}\n  Collect papers.\n  Verify references.\nlicense: MIT\n---\n# Instructions\nNever use body metadata`,'>-'),'Collect papers. Verify references.')
 assert.equal(skillDescription('---\r\ndescription: "Check papers."\r\n---\r\nBody'),'Check papers.')
 assert.equal(skillDescription('# Test\ndescription: not frontmatter','Existing summary'),'Existing summary')
 assert.doesNotMatch(skillDescription('', '>-'),/^[>|]/)
})

test('selected Skills compose once and disabled selections cannot be invoked',async()=>{
 const resolve=createSkillResolver({findCommand:async(user,command)=>({_id:command,command,commit:sha,enabled:command!=='off',files:[{path:'SKILL.md',content:'Instructions '+command}]})})
 const result=await resolve('u','/one do this',['one','two']);assert.equal(result.plugins.length,2);assert.equal(result.assets.length,2);assert.match(result.instruction,/Instructions two/);await assert.rejects(resolve('u','Task',['off']),{status:409})
})
