import { randomUUID } from 'node:crypto'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import { agentService } from './WritingAssistAgentController.mjs'
import { AgentError } from './WritingAssistAgentService.mjs'
import { conversations } from './WritingAssistConversationController.mjs'
import { goalStore } from './WritingAssistGoalStore.mjs'
import { createGoalService, goalTiming } from './WritingAssistGoalService.mjs'
export const goalService=createGoalService({store:goalStore,tasks:agentService,conversations})
const params=z.object({projectId:z.string().regex(/^[a-f\d]{24}$/i),conversationId:z.string().uuid()})
const schemas={get:z.object({params}),start:z.object({params,body:z.object({replaceExisting:z.boolean().optional(),objective:z.string().trim().min(1).max(12000),timeLimitMinutes:z.number().int().min(1).max(1440).optional(),reviewMode:z.enum(['human','ai']).default('human'),scope:z.array(z.object({kind:z.enum(['file','folder']),path:z.string().min(1).max(240)})).max(30).optional(),skills:z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)).max(5).optional(),model:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/).optional(),effort:z.enum(['none','minimal','low','medium','high','xhigh','max','ultra']).optional(),images:z.array(z.object({name:z.string().max(200),mime:z.enum(['image/png','image/jpeg']),data:z.string().max(2796204)})).max(1).optional()})}),action:z.object({params,body:z.object({action:z.enum(['pause','resume','reset','stop'])})})}
export default Object.fromEntries(Object.keys(schemas).map(action=>[action,expressify(async(req,res)=>{const {params,body}=parseReq(req,schemas[action]);const user=SessionManager.getLoggedInUserId(req.session).toString();try{res.status(action==='start'?201:200).json(await goalService[action](user,params.projectId,params.conversationId,action==='action'?body.action:body))}catch(e){if(e instanceof AgentError)return res.status(e.status).json({error:e.message});throw e}})]))
let timer=null; let busy=false
export function startGoalWorker(){
 if(timer)return
 timer=setInterval(async()=>{
  if(busy)return;busy=true;let g,heartbeat
  try{
   g=await goalStore.claim(randomUUID());if(!g)return
   heartbeat=setInterval(()=>goalStore.renew(g._id,g.leaseToken).catch(()=>{}),20000);heartbeat.unref()
   await goalService.tick(g)
  }catch(e){if(g)await goalStore.save(g,{...goalTiming(g,'blocked'),status:'blocked',reason:(e instanceof AgentError?e.message:'Goal processing failed. Check the agent connection and resume.').slice(0,2000)}).catch(()=>{})}
  finally{clearInterval(heartbeat);if(g)await goalStore.release(g._id,g.leaseToken).catch(()=>{});busy=false}
 },3000);timer.unref()
}
