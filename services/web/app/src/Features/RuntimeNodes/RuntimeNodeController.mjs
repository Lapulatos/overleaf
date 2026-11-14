import {refreshSshNode} from './SshNodeController.mjs'
import {sshNodeBridge} from './SshNodeBridge.mjs'
import { randomUUID, randomInt } from 'node:crypto'
import Settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import { User } from '../../models/User.mjs'
import { RuntimeNode } from '../../models/RuntimeNode.mjs'
import { enrollment, hash, secret, publicNode } from './NodeProtocol.mjs'
export default expressify(async (req, res) => {
  res.set('Cache-Control','no-store')
  const userId = SessionManager.getLoggedInUserId(req.session).toString()
  try {
    const user = await User.findById(userId).select('isAdmin').lean()
    const canManage = Boolean(user?.isAdmin || Settings.runtimeNodes?.ownerUserId === userId)
    if (req.method === 'GET') return res.json({ canManage, nodes: (await Promise.all((await RuntimeNode.find().sort({createdAt:-1}).limit(200).lean()).map(refreshSshNode))).map(n=>publicNode(n)) })
    if (!canManage) return res.status(403).json({error:'Only the configured host administrator can manage nodes.'})
    if (req.method === 'POST' && req.params.nodeId) {
      const result=await RuntimeNode.deleteOne({_id:req.params.nodeId,revokedAt:{$exists:true}})
      if(!result.deletedCount)return res.status(409).json({error:'Revoke the node before deleting its record.'})
      return res.json({removed:true})
    }
    if (req.method === 'POST') {
      const parsed = enrollment.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({error:'Enter a node name (1–100 characters).'})
      if (await RuntimeNode.countDocuments({revokedAt:{$exists:false}}) >= 100) return res.status(409).json({error:'Revoke unused nodes before adding more.'})
      const id = randomUUID(), token = `glrt-${id}.${secret()}`
      const node = await RuntimeNode.create({_id:id,name:parsed.data.name,createdBy:userId,protocol:'gitlab-runner',runnerId:randomInt(1,2**47),credentialHash:hash(token),enrollmentExpiresAt:new Date(Date.now()+600000)})
      return res.status(201).json({node:publicNode(node.toObject()), enrollmentToken:token})
    }
    if (req.method === 'DELETE') {
      const existing=await RuntimeNode.findById(req.params.nodeId).lean();if(existing?.sshConfigured)await sshNodeBridge({action:'node-revoke',nodeId:existing._id})
      const node = await RuntimeNode.findOneAndUpdate({_id:req.params.nodeId},{$set:{revokedAt:new Date()},$unset:{credentialHash:'',enrollmentHash:''}},{new:true}).lean()
      if (!node) return res.status(404).json({error:'Node not found.'})
      return res.json(publicNode(node))
    }
    return res.sendStatus(405)
  } catch { return res.status(503).json({error:'Node settings are unavailable. Please retry.'}) }
})
