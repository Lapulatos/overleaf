import {withNodeLock,reconcileNode,activeStates} from './RunnerLifecycle.mjs'
import {settingsFor} from './RuntimeExecutionSettings.mjs'
import {randomInt} from 'node:crypto'
import Settings from '@overleaf/settings'
import {expressify} from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import {User} from '../../models/User.mjs'
import {RuntimeNode} from '../../models/RuntimeNode.mjs'
import {RuntimeTask} from '../../models/RuntimeTask.mjs'
import {kinds,publicTask} from './RuntimeTaskProtocol.mjs'
export default expressify(async(req,res)=>{
 res.set('Cache-Control','no-store')
 const userId=SessionManager.getLoggedInUserId(req.session).toString()
 try {
  const user=await User.findById(userId).select('isAdmin').lean()
  if(!user?.isAdmin&&Settings.runtimeNodes?.ownerUserId!==userId)return res.status(403).json({error:'Only the host administrator can inspect or run node diagnostics.'})
  const node=await RuntimeNode.findById(req.params.nodeId).lean()
  if(!node)return res.status(404).json({error:'Node not found.'})
  if(req.method==='GET') {
   if(req.params.taskId){const task=await RuntimeTask.findOne({_id:Number(req.params.taskId),nodeId:node._id}).lean();return task?res.json(publicTask(task,true)):res.status(404).json({error:'Task not found.'})}
   return res.json({tasks:(await RuntimeTask.find({nodeId:node._id}).select('-trace -tokenHash').sort({createdAt:-1}).limit(50).lean()).map(t=>publicTask(t))})
  }
  if(req.params.taskId){
   const task=await RuntimeTask.findOneAndUpdate({_id:Number(req.params.taskId),nodeId:node._id,state:'queued'},{$set:{state:'canceled',cancelRequestedAt:new Date(),finishedAt:new Date()}},{new:true}).lean()||await RuntimeTask.findOneAndUpdate({_id:Number(req.params.taskId),nodeId:node._id,state:'running'},{$set:{state:'canceling',cancelRequestedAt:new Date()}},{new:true}).lean()
   return task?res.json(publicTask(task)):res.status(409).json({error:'Task has already ended or is stopping.'})
  }
  const kind=req.body?.kind||'diagnostic'
  if(!kinds.includes(kind))return res.status(400).json({error:'Unknown diagnostic type.'})
  const task=await withNodeLock(node._id,async current=>{
   const managed=current.sshConfigured&&settingsFor(current).mode==='on-demand'
   if(current.protocol!=='gitlab-runner'||(!managed&&(!current.runnerLastSeenAt||Date.now()-new Date(current.runnerLastSeenAt).getTime()>45000)))throw Object.assign(Error('Connect an active Runner before starting a test.'),{status:409})
   if(await RuntimeTask.countDocuments({nodeId:current._id,state:{$in:activeStates}})>=3)throw Object.assign(Error('Wait for current tests to finish.'),{status:409})
   await RuntimeNode.updateOne({_id:current._id},{$set:{runnerIdleSince:null}})
   return RuntimeTask.create({_id:randomInt(1,2**47),nodeId:current._id,createdBy:userId,kind,executionSettings:settingsFor(current)})
  })
  void reconcileNode(node._id).catch(()=>{})
  return res.status(201).json(publicTask(task.toObject()))
 }catch(e){if(e.status===409)return res.status(409).json({error:e.message});return res.status(503).json({error:'Node tasks are unavailable. Please retry.'})}
})
