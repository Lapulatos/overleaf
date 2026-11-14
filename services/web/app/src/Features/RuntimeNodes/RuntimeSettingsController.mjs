import Settings from '@overleaf/settings'
import {expressify} from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import {User} from '../../models/User.mjs'
import {RuntimeNode} from '../../models/RuntimeNode.mjs'
import {sshNodeBridge} from './SshNodeBridge.mjs'
import {executionSettings,settingsFor,validateCapacity} from './RuntimeExecutionSettings.mjs'
import {withNodeLock,reconcileNode} from './RunnerLifecycle.mjs'
export default expressify(async(req,res)=>{
 res.set('Cache-Control','no-store')
 try{
  const userId=String(SessionManager.getLoggedInUserId(req.session)),user=await User.findById(userId).select('isAdmin').lean()
  if(!user?.isAdmin&&Settings.runtimeNodes?.ownerUserId!==userId)return res.status(403).json({error:'Only the host administrator can change node settings.'})
  const node=await RuntimeNode.findOne({_id:req.params.nodeId,revokedAt:{$exists:false}}).lean();if(!node)return res.status(404).json({error:'Node unavailable.'})
  const caps=node.sshConfigured?await sshNodeBridge({action:'node-capabilities',nodeId:node._id}):{runnerControl:false,docker:false,images:[],gpuRuntime:false,gpuCount:0}
  if(req.method==='GET')return res.json({settings:settingsFor(node),capabilities:caps})
  const parsed=executionSettings.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Check the mode, idle time and resource limits.'})
  try{validateCapacity(parsed.data,node,caps)}catch(e){return res.status(400).json({error:e.message})}
  await withNodeLock(node._id,async()=>RuntimeNode.updateOne({_id:node._id,revokedAt:{$exists:false}},{$set:{executionSettings:parsed.data,runnerIdleSince:new Date()}}))
  void reconcileNode(node._id).catch(()=>{})
  return res.json({settings:parsed.data,capabilities:caps})
 }catch(e){return res.status(e.status===409?409:503).json({error:e.status===409?e.message:'Node settings unavailable. Check SSH and retry.'})}
})
