import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import { AgentError } from '../WritingAssist/WritingAssistAgentService.mjs'
import { agentService } from '../WritingAssist/WritingAssistAgentController.mjs'
import { pluginLibrary } from './SkillPluginLibrary.mjs'
const command=z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
const source=z.object({url:z.string().min(1).max(1000)})
const schemas={batch:z.object({body:source.extend({paths:z.array(z.string().min(1).max(200)).min(1).max(50).refine(paths=>new Set(paths).size===paths.length),commit:z.string().regex(/^[a-f0-9]{40}$/)})}),list:z.object({}),discover:z.object({body:source}),install:z.object({body:source.extend({path:z.string().max(200).optional(),commit:z.string().regex(/^[a-f0-9]{40}$/).optional(),command:command.optional()})}),enable:z.object({params:z.object({pluginId:z.string().uuid()}),body:z.object({enabled:z.boolean().optional(),name:z.string().trim().min(1).max(100).optional(),command:command.optional()}).refine(body=>Object.keys(body).length>0)}),remove:z.object({params:z.object({pluginId:z.string().uuid()})}),invoke:z.object({params:z.object({projectId:z.string().regex(/^[a-f0-9]{24}$/i)}),body:z.object({command,input:z.string().max(12000).default(''),model:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/).optional(),effort:z.enum(['none','minimal','low','medium','high','xhigh','max','ultra']).optional()})})}
function handler(action){return expressify(async(req,res)=>{
 const {body,params}=parseReq(req,schemas[action]);const user=SessionManager.getLoggedInUserId(req.session).toString()
 try{
  let value
  if(action==='list')value={plugins:await pluginLibrary.list(user)}
  if(action==='discover')value=await pluginLibrary.discover(body.url)
  if(action==='install')value=await pluginLibrary.install(user,body)
  if(action==='batch')value=await pluginLibrary.installMany(user,body)
  if(action==='enable')value=await pluginLibrary.update(user,params.pluginId,body)
  if(action==='remove')value=await pluginLibrary.remove(user,params.pluginId)
  if(action==='invoke')value=await agentService.create(user,params.projectId,`/${body.command} ${body.input}`,{model:body.model,effort:body.effort})
  res.status(['install','invoke'].includes(action)?201:200).json(value)
 }catch(error){if(error instanceof AgentError)return res.status(error.status).json({error:error.message});throw error}
})}
export default Object.fromEntries(Object.keys(schemas).map(action=>[action,handler(action)]))
