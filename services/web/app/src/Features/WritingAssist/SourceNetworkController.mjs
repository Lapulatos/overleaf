import settings from '@overleaf/settings'
import {expressify} from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import {z,parseReq} from '../../infrastructure/Validation.mjs'
const body=z.object({action:z.enum(['save','test']),mode:z.enum(['environment','direct','custom']).optional(),url:z.string().max(2000).optional(),username:z.string().max(256).optional(),password:z.string().max(1024).optional(),clearPassword:z.boolean().optional()}).strict()
export default expressify(async(req,res)=>{
 const payload=req.method==='POST'?parseReq(req,z.object({body})).body:undefined
 const {agentEndpoint,agentToken}=settings.writingAssist||{}
 if(!agentEndpoint||!agentToken)return res.status(503).json({error:'Local Agent is not configured'})
 try{const response=await fetch(`${agentEndpoint.replace(/\/$/,'')}/agent/source-network`,{method:req.method,headers:{'Content-Type':'application/json','X-Agent-Token':agentToken,'X-Overleaf-User-Id':SessionManager.getLoggedInUserId(req.session).toString()},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(payload?.action==='test'?30000:10000)});res.status(response.status).json(await response.json())}catch{res.status(502).json({error:'Source proxy service is unavailable'})}
})
