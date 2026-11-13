import { skillUsage } from './SkillUsage.mjs'
import { publicGitSkillSource } from './PublicGitSkillSource.mjs'
import { deadlineSkill } from '../SubmissionDeadlines/DeadlineSkill.mjs'
import { skillDescription } from './SkillMetadata.mjs'
import { randomUUID } from 'node:crypto'
import { SkillPlugin } from '../../models/SkillPlugin.mjs'
import { AgentError } from '../WritingAssist/WritingAssistAgentService.mjs'
import { createGitHubSkills } from './GitHubSkills.mjs'
const github=createGitHubSkills(fetch,{fallback:publicGitSkillSource,token:process.env.OVERLEAF_SKILLS_GITHUB_TOKEN || ''})
export const publicPlugin=({files,userId,...plugin})=>({...plugin,id:plugin._id,description:skillDescription(files?.find(f=>f.path==='SKILL.md')?.content,plugin.description),usage:skillUsage(files?.find(f=>f.path==='SKILL.md')?.content,skillDescription(files?.find(f=>f.path==='SKILL.md')?.content,plugin.description),plugin.name),resourceCount:files?.length || 0,resourcePaths:(files || []).map(f=>f.path)})
export const pluginLibrary={
 async list(userId){return [publicPlugin(deadlineSkill),...(await SkillPlugin.find({userId}).sort({installedAt:-1}).lean()).map(publicPlugin)]},
 async discover(url){const found=await github.discover(url);try{const {source,commit,skills}=found;return {source,commit,skills}}finally{await found.dispose?.()}},
 async install(userId,input){
  if(await SkillPlugin.countDocuments({userId})>=50)throw new AgentError(422,'Your library supports up to 50 Skills.')
  if(input.command===deadlineSkill.command)throw new AgentError(409,'This command belongs to a built-in plugin.')
  const skill=await github.install(input.url,input.path,input.commit)
  if((input.command||skill.name)===deadlineSkill.command)throw new AgentError(409,'This command belongs to a built-in plugin.')
  try{return publicPlugin((await SkillPlugin.create({_id:randomUUID(),userId,...skill,command:input.command || skill.name})).toObject())}catch(e){if(e.code===11000)throw new AgentError(409,'This command is already installed. Choose a different command name.');throw e}
 },
 async installMany(userId,input){
  const used=new Set([deadlineSkill.command,...(await SkillPlugin.find({userId}).select('command').lean()).map(p=>p.command)])
  const results=await github.installMany(input.url,input.paths,input.commit,async skill=>{
   const existing=await SkillPlugin.findOne({userId,sourceUrl:skill.sourceUrl,skillPath:skill.skillPath}).lean()
   if(existing)return publicPlugin(existing)
   if(await SkillPlugin.countDocuments({userId})>=50)throw new AgentError(422,'Your library supports up to 50 Skills.')
   for(let suffix=1;suffix<=100;suffix++){
    const command=suffix===1?skill.name:`${skill.name}-${suffix}`
    if(used.has(command))continue
    used.add(command)
    try{return publicPlugin((await SkillPlugin.create({_id:randomUUID(),userId,...skill,command})).toObject())}
    catch(error){if(error.code!==11000)throw error}
   }
   throw new AgentError(409,'Could not generate an unused command name.')
  })
  return {results}
 },
 async update(userId,id,input){
  if(input.command===deadlineSkill.command)throw new AgentError(409,'This command belongs to a built-in plugin.')
  try{
   const value=await SkillPlugin.findOneAndUpdate({_id:id,userId},{$set:input},{new:true}).lean()
   if(!value)throw new AgentError(404,'Plugin not found')
   return publicPlugin(value)
  }catch(error){if(error.code===11000)throw new AgentError(409,'This command is already in use. Choose another command.');throw error}
 },
 async setEnabled(userId,id,enabled){const value=await SkillPlugin.findOneAndUpdate({_id:id,userId},{$set:{enabled}},{new:true}).lean();if(!value)throw new AgentError(404,'Plugin not found');return publicPlugin(value)},
 async remove(userId,id){if(!(await SkillPlugin.deleteOne({_id:id,userId})).deletedCount)throw new AgentError(404,'Plugin not found');return {removed:true}},
 findCommand:(userId,command)=>command===deadlineSkill.command?Promise.resolve(deadlineSkill):SkillPlugin.findOne({userId,command}).lean(),
}
