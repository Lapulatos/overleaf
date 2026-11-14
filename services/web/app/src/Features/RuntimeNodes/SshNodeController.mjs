import {randomUUID,randomInt} from 'node:crypto'
import Settings from '@overleaf/settings'
import {expressify} from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import {User} from '../../models/User.mjs'
import {RuntimeNode} from '../../models/RuntimeNode.mjs'
import {z} from '../../infrastructure/Validation.mjs'
import {registration,publicNode,secret,hash} from './NodeProtocol.mjs'
import {sshNodeBridge} from './SshNodeBridge.mjs'
const ssh=z.object({host:z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.:-]+$/),port:z.number().int().min(1).max(65535),username:z.string().trim().regex(/^[a-zA-Z0-9_.-]{1,64}$/),fingerprint:z.string().max(100).optional(),auth:z.enum(['server-key','private-key','password']).optional(),privateKey:z.string().max(32768).optional(),password:z.string().max(1024).optional(),passphrase:z.string().max(1024).optional()}).strict()
export default expressify(async(req,res)=>{
 res.set('Cache-Control','no-store');const userId=String(SessionManager.getLoggedInUserId(req.session))
 try{
  const u=await User.findById(userId).select('isAdmin').lean();if(!u?.isAdmin&&Settings.runtimeNodes?.ownerUserId!==userId)return res.status(403).json({error:'Only the host administrator can add SSH nodes.'})
  if(req.params.nodeId){
   const node=await RuntimeNode.findOne({_id:req.params.nodeId,sshConfigured:true,revokedAt:{$exists:false}}).lean();if(!node)return res.status(404).json({error:'SSH node unavailable.'})
   if(node.protocol==='gitlab-runner'){if(node.registeredAt&&node.systemId)return res.json(publicNode(node));return res.status(409).json({error:'Runner registration is in progress. Refresh shortly.'})}
   const port=Number(new URL(Settings.siteUrl).port);if(!port)return res.status(409).json({error:'Configure the adapter coordinator port for this deployment.'})
   const token=`glrt-${node._id}.${secret()}`
   const claimed=await RuntimeNode.updateOne({_id:node._id,protocol:'ssh',revokedAt:{$exists:false}},{$set:{protocol:'gitlab-runner',runnerId:randomInt(1,2**47),credentialHash:hash(token),enrollmentExpiresAt:new Date(Date.now()+600000)},$unset:{registeredAt:'',systemId:''}})
   if(!claimed.modifiedCount)return res.status(409).json({error:'Node registration changed. Refresh and retry.'})
   try{const result=await sshNodeBridge({action:'node-runner',nodeId:node._id,token,coordinatorPort:port});await RuntimeNode.updateOne({_id:node._id},{$set:{sshTunnel:'connected',sshTunnelPort:result.tunnelPort}});return res.json(publicNode(await RuntimeNode.findById(node._id).lean()))}
   catch(e){await RuntimeNode.updateOne({_id:node._id},{$set:{protocol:'ssh',registeredAt:node.registeredAt||new Date()},$unset:{credentialHash:'',systemId:'',runnerId:''}});throw e}
  }
  if(!['probe','add'].includes(req.params.sshAction))return res.status(404).json({error:'Unknown SSH operation.'})
  const parsed=ssh.safeParse(req.body.ssh);if(!parsed.success)return res.status(400).json({error:'Check the SSH host, port, username and authentication fields.'})
  if(req.params.sshAction==='probe')return res.json(await sshNodeBridge({action:'node-probe',ssh:parsed.data}))
  if(typeof req.body.name!=='string'||!req.body.name.trim()||req.body.name.length>100)return res.status(400).json({error:'Enter a node name (1–100 characters).'})
  if(req.body.verified!==true)return res.status(400).json({error:'Verify the host fingerprint before adding this node.'})
  if(await RuntimeNode.countDocuments({revokedAt:{$exists:false}})>=100)return res.status(409).json({error:'Revoke unused nodes before adding more.'})
  const id=randomUUID();const result=await sshNodeBridge({action:'node-add',nodeId:id,name:req.body.name.trim(),ssh:parsed.data});const sample=registration.safeParse({identity:result.identity,resources:result.resources})
  if(!sample.success){await sshNodeBridge({action:'node-revoke',nodeId:id});return res.status(409).json({error:'Node returned unsupported resource information.'})}
  try{const node=await RuntimeNode.create({_id:id,name:req.body.name.trim(),createdBy:userId,protocol:'ssh',sshConfigured:true,sshEndpoint:result.ssh,registeredAt:new Date(),lastSeenAt:new Date(),...sample.data});return res.status(201).json({node:publicNode(node.toObject()),runnerInstalled:result.runnerInstalled})}
  catch(e){await sshNodeBridge({action:'node-revoke',nodeId:id}).catch(()=>{});throw e}
 }catch(e){return res.status([400,403,404,409,503].includes(e.status)?e.status:503).json({error:e.status?e.message:'SSH connection unavailable. Check the address, credentials and host fingerprint.'})}
})
const pending=new Map()
export async function refreshSshNode(node){
 if(!node.sshConfigured||node.revokedAt)return node
 if(pending.has(node._id))return pending.get(node._id)
 const p=(async()=>{try{const r=await sshNodeBridge({action:'node-status',nodeId:node._id});const v=registration.safeParse({identity:r.identity,resources:r.resources});if(v.success){const values={...v.data,lastSeenAt:new Date(),sshTunnel:r.tunnel,sshReachable:true,sshLastCheckedAt:new Date()};await RuntimeNode.updateOne({_id:node._id,revokedAt:{$exists:false}},{$set:values});return {...node,...values}}}catch{try{const h=await sshNodeBridge({action:'node-health',nodeId:node._id});const values={sshReachable:h.reachable,sshLastCheckedAt:new Date(h.checkedAt)};await RuntimeNode.updateOne({_id:node._id,revokedAt:{$exists:false}},{$set:values});return {...node,...values}}catch{}}return node})().finally(()=>pending.delete(node._id));pending.set(node._id,p);return p
}
