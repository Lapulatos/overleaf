import {startRunnerLifecycle} from './RunnerLifecycle.mjs'
import express from 'express'
import {claimTask,receiveTask} from './RuntimeTaskProtocol.mjs'
import { fileURLToPath } from 'node:url'
import { RuntimeNode } from '../../models/RuntimeNode.mjs'
import { identity, heartbeat, hash } from './NodeProtocol.mjs'
import { runnerRequest, runnerToken, systemId } from './GitLabRunnerProtocol.mjs'
const telemetry = heartbeat.extend({systemId, identity}).strict()
// Machine endpoints use only bearer credentials, never cookies; mount before CSRF.
export function applyRuntimeNodeRoutes(app) {
  startRunnerLifecycle()
  app.get('/runtime-nodes/agent.py', (req,res)=>res.type('text/plain').sendFile(fileURLToPath(new URL('./agent.py',import.meta.url))))
  app.patch('/api/v4/jobs/:taskId/trace',express.raw({type:()=>true,limit:'1mb'}),receiveTask)
  app.put('/api/v4/jobs/:taskId',express.json({limit:'16kb'}),receiveTask)
  const machine = async (req,res) => {
    res.set('Cache-Control','no-store')
    const parsed = runnerRequest.safeParse(req.body)
    if (!parsed.success) return res.status(403).json({message:'Invalid runner credentials or system ID.'})
    const {token,system_id,info} = parsed.data
    const match = {_id:token.slice(5).split('.')[0], protocol:'gitlab-runner', credentialHash:hash(token),revokedAt:{$exists:false}}
    try {
      if(req.path.endsWith('/runners/verify')) {
        const now=new Date()
        const node=await RuntimeNode.findOneAndUpdate({...match,$or:[{systemId:{$exists:false},registeredAt:{$exists:false},enrollmentExpiresAt:{$gt:now}},{systemId:system_id,registeredAt:{$exists:true}}]},{$set:{systemId:system_id,registeredAt:now,runnerLastSeenAt:now,runnerInfo:info||{}}},{new:true}).lean()
        if(!node)return res.status(403).json({message:'Runner expired, revoked, or registered on another machine.'})
        return res.json({id:node.runnerId,token,token_expires_at:null})
      }
      if(req.method==='DELETE') {
        const node=await RuntimeNode.findOneAndUpdate({...match,systemId:system_id},{$set:{revokedAt:new Date()},$unset:{credentialHash:''}},{new:true}).lean()
        return res.sendStatus(node?204:403)
      }
      const node=await RuntimeNode.findOneAndUpdate({...match,systemId:system_id,registeredAt:{$exists:true}},{$set:{runnerLastSeenAt:new Date(),runnerInfo:info||{}}},{new:true}).lean()
      if(!node)return res.sendStatus(403)
      const job=await claimTask(node)
      return job?res.status(201).json(job):res.sendStatus(204)
    } catch { return res.status(503).json({message:'Runner coordinator unavailable.'}) }
  }
  app.post('/api/v4/runners/verify',express.json({limit:'16kb'}),machine)
  app.post('/api/v4/jobs/request',express.json({limit:'16kb'}),machine)
  app.delete('/api/v4/runners/managers',express.json({limit:'16kb'}),machine)
  app.post('/runtime-nodes/register', (req,res)=>res.status(410).json({error:'Use official gitlab-runner register. Independent node enrollment is no longer supported.'}))
  app.post('/runtime-nodes/heartbeat', express.json({limit:'16kb'}), async (req,res)=>{
    res.set('Cache-Control','no-store')
    const token=(req.get('authorization')||'').replace(/^Bearer /,'')
    if(!runnerToken.safeParse(token).success)return res.status(401).json({error:'Registered Runner credentials required.'})
    const parsed=telemetry.safeParse(req.body)
    if(!parsed.success)return res.status(400).json({error:'Invalid resource report.'})
    const {sequence,resources,identity:nodeIdentity,systemId:manager}=parsed.data
    try {
      const node=await RuntimeNode.findOneAndUpdate({_id:token.slice(5).split('.')[0],protocol:'gitlab-runner',credentialHash:hash(token),systemId:manager,registeredAt:{$exists:true},revokedAt:{$exists:false},sequence:{$lt:sequence}},{$set:{sequence,resources,identity:nodeIdentity,lastSeenAt:new Date()}},{new:true}).lean()
      if(!node)return res.status(401).json({error:'Runner identity revoked, unregistered or report sequence expired.'})
      return res.json({accepted:true})
    } catch {return res.status(503).json({error:'Resource reports temporarily unavailable.'})}
  })
}
