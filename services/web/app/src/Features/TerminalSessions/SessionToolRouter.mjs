import express from 'express'
import {WritingAssistTask} from '../../models/WritingAssistTask.mjs'
import {authenticateGrant,terminalTool,executeOperation} from './SessionTools.mjs'
import {TerminalAgentGrant,TerminalAgentOperation} from '../../models/TerminalAgentAccess.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import {authorizeProject} from './SessionRegistry.mjs'
const sendError=(res,e)=>res.status([400,403,404,409,413,503].includes(e.status)?e.status:503).json({error:e.status?e.message:'Terminal tools temporarily unavailable.'})
export function applySessionToolRoutes(app){app.post('/terminal-agent/tools',express.json({limit:'8mb'}),async(req,res)=>{res.set('Cache-Control','no-store');try{const token=(req.get('authorization')||'').replace(/^Bearer /,'');const grant=await authenticateGrant(req.body.grantId,token);return res.json(await terminalTool(grant,req.body))}catch(e){return sendError(res,e)}})}
export async function sessionApprovalController(req,res){
 res.set('Cache-Control','no-store')
 try{
  const userId=String(SessionManager.getLoggedInUserId(req.session)),projectId=req.params.projectId;await authorizeProject(userId,projectId)
  if(req.method==='GET'){const ops=await TerminalAgentOperation.find({userId,projectId,state:'pending',expiresAt:{$gt:new Date()}}).sort({createdAt:1}).limit(20).lean();const grants=await TerminalAgentGrant.find({_id:{$in:ops.map(o=>o.grantId)},userId,projectId,expiresAt:{$gt:new Date()}}).lean();const active=await WritingAssistTask.find({_id:{$in:grants.map(g=>g.taskId)},userId,status:{$in:['preparing','submitting','running']}}).select('_id').lean();const ids=new Set(grants.filter(g=>active.some(t=>t._id===g.taskId)).map(g=>g._id));return res.json(ops.filter(o=>ids.has(o.grantId)).map(o=>({id:o._id,kind:o.kind,command:o.args.command,reference:o.args.reference,source:o.args.source,destination:o.args.destination,destinationPath:o.args.destinationPath,paths:o.args.paths||o.args.files?.map(f=>f.path),createdAt:o.createdAt})))}
  const op=await TerminalAgentOperation.findOne({_id:req.params.operationId,userId,projectId,state:'pending'}).lean();if(!op)return res.status(404).json({error:'Operation unavailable.'})
  if(req.body.accept!==true){await TerminalAgentOperation.updateOne({_id:op._id,state:'pending'},{$set:{state:'rejected'},$unset:{args:''}});return res.json({state:'rejected'})}
  const grant=await TerminalAgentGrant.findById(op.grantId).lean();return res.json(await executeOperation(op._id,grant))
 }catch(e){return sendError(res,e)}
}
