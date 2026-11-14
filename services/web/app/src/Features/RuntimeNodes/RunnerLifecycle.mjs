import {randomUUID} from 'node:crypto'
import {RuntimeNode} from '../../models/RuntimeNode.mjs'
import {RuntimeTask} from '../../models/RuntimeTask.mjs'
import {sshNodeBridge} from './SshNodeBridge.mjs'
import {settingsFor,idleExpired} from './RuntimeExecutionSettings.mjs'
export const activeStates=['queued','running','canceling']
export async function withNodeLock(id,fn){
 const owner=randomUUID(),now=Date.now()
 const node=await RuntimeNode.findOneAndUpdate({_id:id,revokedAt:{$exists:false},$or:[{runtimeLeaseUntil:{$exists:false}},{runtimeLeaseUntil:{$lt:new Date(now)}}]},{$set:{runtimeLeaseOwner:owner,runtimeLeaseUntil:new Date(now+120000)}},{new:true}).lean()
 if(!node)throw Object.assign(Error('Node is updating. Retry shortly.'),{status:409})
 const renew=setInterval(()=>{void RuntimeNode.updateOne({_id:id,runtimeLeaseOwner:owner},{$set:{runtimeLeaseUntil:new Date(Date.now()+120000)}}).catch(()=>{})},30000);renew.unref()
 try{return await fn(node)}finally{clearInterval(renew);await RuntimeNode.updateOne({_id:id,runtimeLeaseOwner:owner},{$unset:{runtimeLeaseOwner:'',runtimeLeaseUntil:''}})}
}
export async function reconcileNode(id){
 return withNodeLock(id,async node=>{
  if(!node.sshConfigured||node.protocol!=='gitlab-runner'||!node.executionSettings)return
  const settings=settingsFor(node),count=await RuntimeTask.countDocuments({nodeId:id,state:{$in:activeStates}})
  const set=async values=>RuntimeNode.updateOne({_id:id,revokedAt:{$exists:false}},{$set:values})
  if(count){await set({runnerIdleSince:null});if(node.runnerPowerState==='awake'&&node.runnerLastSeenAt&&Date.now()-new Date(node.runnerLastSeenAt).getTime()<45000)return}
  const waking=settings.mode==='always'||count>0
  if(waking){
   if(node.runnerPowerState==='awake'&&node.runnerLastSeenAt&&Date.now()-new Date(node.runnerLastSeenAt).getTime()<45000)return
   await set({runnerPowerState:'waking',runnerPowerError:''})
   try{await sshNodeBridge({action:'node-wake',nodeId:id});await set({runnerPowerState:'awake',runnerPowerError:'',runnerIdleSince:count?null:new Date()})}
   catch{await set({runnerPowerState:'error',runnerPowerError:'Runner could not start. Check SSH and retry.'})}
   return
  }
  if(node.runnerPowerState==='standby')return
  if(!node.runnerIdleSince){await set({runnerIdleSince:new Date()});return}
  if(!idleExpired(node,count))return
  await set({runnerPowerState:'stopping',runnerPowerError:''})
  try{await sshNodeBridge({action:'node-sleep',nodeId:id});await set({runnerPowerState:'standby',runnerPowerError:''})}
  catch{await set({runnerPowerState:'error',runnerPowerError:'Runner could not stop safely. It will retry.'})}
 })
}
let timer,busy=false
export function startRunnerLifecycle(){
 if(timer)return
 const tick=async()=>{if(busy)return;busy=true;try{const nodes=await RuntimeNode.find({sshConfigured:true,protocol:'gitlab-runner',executionSettings:{$exists:true},revokedAt:{$exists:false}}).select('_id').lean();for(const n of nodes)await reconcileNode(n._id).catch(()=>{})}finally{busy=false}}
 timer=setInterval(()=>void tick().catch(()=>{}),10000);timer.unref()
}
