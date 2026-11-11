import settings from '@overleaf/settings'
import {expressify} from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import {z,parseReq} from '../../infrastructure/Validation.mjs'
const body=z.object({action:z.enum(['permission','prepare','diagnose','repair','build','activate','rollback']),enabled:z.boolean().optional(),issue:z.string().max(4000).optional(),planId:z.string().uuid().optional(),confirmation:z.string().uuid().optional()}).strict()
export default expressify(async(req,res)=>{
 const payload=req.method==='POST'?parseReq(req,z.object({body})).body:undefined
 const {agentEndpoint,agentToken}=settings.writingAssist||{}
 if(!agentEndpoint||!agentToken)return res.status(503).json({error:'Local Agent is not configured'})
 try{const response=await fetch(`${agentEndpoint.replace(/\/$/,'')}/agent/environment`,{method:req.method,headers:{'Content-Type':'application/json','X-Agent-Token':agentToken,'X-Overleaf-User-Id':SessionManager.getLoggedInUserId(req.session).toString()},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(15000)});res.status(response.status).json(await response.json())}catch{res.status(502).json({error:'Local environment service is unavailable'})}
})
