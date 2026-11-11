import { deadlineSkill } from '../SubmissionDeadlines/DeadlineSkill.mjs'
import { skillDescription } from './SkillMetadata.mjs'
import { randomUUID } from 'node:crypto'
import { SkillPlugin } from '../../models/SkillPlugin.mjs'
import { AgentError } from '../WritingAssist/WritingAssistAgentService.mjs'
import { createGitHubSkills } from './GitHubSkills.mjs'
const github=createGitHubSkills()
export const publicPlugin=({files,userId,...plugin})=>({...plugin,id:plugin._id,description:skillDescription(files?.find(f=>f.path==='SKILL.md')?.content,plugin.description),resourceCount:files?.length || 0,resourcePaths:(files || []).map(f=>f.path)})
export const pluginLibrary={
 async list(userId){return [publicPlugin(deadlineSkill),...(await SkillPlugin.find({userId}).sort({installedAt:-1}).lean()).map(publicPlugin)]},
 async discover(url){const {source,commit,skills}=await github.discover(url);return {source,commit,skills}},
 async install(userId,input){
  if(await SkillPlugin.countDocuments({userId})>=50)throw new AgentError(422,'Your library supports up to 50 Skills.')
  if(input.command===deadlineSkill.command)throw new AgentError(409,'This command belongs to a built-in plugin.')
  const skill=await github.install(input.url,input.path,input.commit)
  if((input.command||skill.name)===deadlineSkill.command)throw new AgentError(409,'This command belongs to a built-in plugin.')
  try{return publicPlugin((await SkillPlugin.create({_id:randomUUID(),userId,...skill,command:input.command || skill.name})).toObject())}catch(e){if(e.code===11000)throw new AgentError(409,'This command is already installed. Choose a different command name.');throw e}
 },
 async setEnabled(userId,id,enabled){const value=await SkillPlugin.findOneAndUpdate({_id:id,userId},{$set:{enabled}},{new:true}).lean();if(!value)throw new AgentError(404,'Plugin not found');return publicPlugin(value)},
 async remove(userId,id){if(!(await SkillPlugin.deleteOne({_id:id,userId})).deletedCount)throw new AgentError(404,'Plugin not found');return {removed:true}},
 findCommand:(userId,command)=>command===deadlineSkill.command?Promise.resolve(deadlineSkill):SkillPlugin.findOne({userId,command}).lean(),
}
