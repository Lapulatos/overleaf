import {limitScript} from './RuntimeTaskLimits.mjs'
import {randomBytes} from 'node:crypto'
import {RuntimeTask} from '../../models/RuntimeTask.mjs'
import {RuntimeNode} from '../../models/RuntimeNode.mjs'
import {hash} from './NodeProtocol.mjs'
export const kinds=['diagnostic','failure','timeout','cancel-probe']
export function jobDescription(task,token) {
  const script=['echo OVERLEAF_REMOTE_TASK_START','hostname','uname -sm','printf "Working directory: %s\\n" "$PWD"']
  if(task.kind==='diagnostic')script.push('for step in 1 2 3 4 5; do echo "Progress $step/5"; sleep 2; done','echo OVERLEAF_STDERR_OK >&2','echo OVERLEAF_REMOTE_TASK_DONE')
  if(task.kind==='failure')script.push('echo OVERLEAF_EXPECTED_FAILURE >&2','exit 17')
  if(task.kind==='timeout'||task.kind==='cancel-probe')script.push('echo OVERLEAF_WAIT_STARTED','sleep 90','echo OVERLEAF_SHOULD_NOT_APPEAR')
  return {id:task._id,token,allow_git_fetch:false,job_info:{name:`Overleaf ${task.kind}`,stage:'diagnostics',project_id:task._id,project_name:'node-diagnostic'},git_info:{repo_url:'https://invalid.invalid/overleaf/node-diagnostic.git',ref:'diagnostic',sha:'0'.repeat(40),before_sha:'0'.repeat(40),ref_type:'branch',depth:0},runner_info:{timeout:task.kind==='timeout'?8:60},variables:[{key:'GIT_STRATEGY',value:'none',public:true,internal:true}],steps:[{name:'script',script:limitScript(script,task),timeout:60,when:'on_success',allow_failure:false}],features:{trace_sections:true},artifacts:[],cache:[],dependencies:[]}
}
export async function claimTask(node) {
 const token=randomBytes(32).toString('base64url')
 const task=await RuntimeTask.findOneAndUpdate({nodeId:node._id,state:'queued'},{$set:{state:'running',startedAt:new Date(),systemId:node.systemId,tokenHash:hash(token)}},{sort:{createdAt:1},new:true}).lean()
 return task?jobDescription(task,token):null
}
export async function receiveTask(req,res) {
 res.set('Cache-Control','no-store')
 const token=req.get('job-token')||req.body?.token
 if(typeof token!=='string'||token.length>200)return res.sendStatus(403)
 const id=Number(req.params.taskId)
 if(!Number.isSafeInteger(id))return res.sendStatus(403)
 try {
  const task=await RuntimeTask.findOne({_id:id,tokenHash:hash(token)}).lean()
  if(!task)return res.sendStatus(403)
  const node=await RuntimeNode.findOne({_id:task.nodeId,systemId:task.systemId,revokedAt:{$exists:false}}).lean()
  if(node)await RuntimeNode.updateOne({_id:node._id,systemId:task.systemId,revokedAt:{$exists:false}},{$set:{runnerLastSeenAt:new Date()}})
  const canceled=Boolean(task.cancelRequestedAt||!node)
  res.set('Job-Status',canceled?'canceled':'running').set('X-GitLab-Trace-Update-Interval','1')
  if(req.method==='PATCH') {
   const range=/^(\d+)-(\d+)$/.exec(req.get('content-range')||'')
   if(!range||!Buffer.isBuffer(req.body))return res.sendStatus(400)
   const start=Number(range[1]),end=Number(range[2])
   if(start!==task.offset)return res.set('Range',`0-${task.offset}`).sendStatus(416)
   if(end-start+1!==req.body.length)return res.sendStatus(400)
   if(task.offset+req.body.length>1024*1024)return res.sendStatus(413)
   const previous=task.trace?Buffer.from(task.trace.buffer||task.trace):Buffer.alloc(0)
   const updated=await RuntimeTask.updateOne({_id:id,offset:start},{$set:{trace:Buffer.concat([previous,req.body]),offset:start+req.body.length}})
   if(!updated.modifiedCount)return res.set('Range',`0-${task.offset}`).sendStatus(416)
   return res.set('Range',`0-${start+req.body.length}`).sendStatus(202)
  }
  const state=req.body?.state
  if(!['running','success','failed'].includes(state))return res.sendStatus(400)
  // Once terminal, never let late running updates undo the result.
  if(state!=='running')await RuntimeTask.updateOne({_id:id,state:{$in:['running','canceling']}},{$set:{state:canceled?'canceled':state,finishedAt:new Date(),failureReason:String(req.body.failure_reason||'').slice(0,100),exitCode:Number.isInteger(req.body.exit_code)?req.body.exit_code:null}})
  return res.sendStatus(200)
 }catch{return res.status(503).json({message:'Task coordinator unavailable.'})}
}
export function publicTask(task,includeTrace=false) {
 const result={id:task._id,nodeId:task.nodeId,kind:task.kind,state:task.state,createdAt:task.createdAt,startedAt:task.startedAt,finishedAt:task.finishedAt,exitCode:task.exitCode,failureReason:task.failureReason,offset:task.offset}
 if(includeTrace)result.output=task.trace?Buffer.from(task.trace.buffer||task.trace).toString('utf8'):''
 return result
}
