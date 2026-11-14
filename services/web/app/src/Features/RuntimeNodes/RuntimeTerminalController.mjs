import {assertManualTerminalInput} from '../../models/TerminalAgentAccess.mjs'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import Settings from '@overleaf/settings'
import {expressify} from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import {User} from '../../models/User.mjs'
import {RuntimeNode} from '../../models/RuntimeNode.mjs'
import {RuntimeTerminal} from '../../models/RuntimeTerminal.mjs'
const config=()=>JSON.parse(readFileSync('/etc/overleaf/remote-terminal.json','utf8'))
async function bridge(body){
 const c=config(),response=await fetch(c.endpoint+'/command',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${c.token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)})
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Remote terminal unavailable'),{status:response.status});return data
}
const visible=t=>({id:t._id,nodeId:t.nodeId,name:t.name,ownerName:t.ownerName,state:t.state,directory:t.directory,createdAt:t.createdAt})
export default expressify(async(req,res)=>{
 res.set('Cache-Control','no-store')
 try{
  const userId=SessionManager.getLoggedInUserId(req.session).toString(),user=await User.findById(userId).select('isAdmin first_name last_name email').lean()
  if(!user?.isAdmin&&Settings.runtimeNodes?.ownerUserId!==userId)return res.status(403).json({error:'Only the host administrator can access SSH terminals.'})
  const node=await RuntimeNode.findById(req.params.nodeId).lean()
  if(!node)return res.status(404).json({error:'Node not found.'})
  let enabled=false;try{enabled=!!node.sshConfigured||config().nodeIds.includes(node._id)}catch{}
  if(!enabled)return req.method==='GET'?res.json({available:false,sessions:[]}):res.status(409).json({error:'SSH is not configured for this node.'})
  const match={nodeId:node._id,createdBy:userId}
  if(req.method==='GET'){
   let connected=true
   try{const data=await bridge({action:'list',nodeId:node._id});for(const t of data.sessions)await RuntimeTerminal.updateOne({...match,_id:t.id,...(t.state==='running'?{state:{$nin:['stopped','ended']}}:{})},{$set:{state:t.state,directory:t.directory}})}catch{connected=false}
   const sessions=(await RuntimeTerminal.find(match).sort({createdAt:-1}).limit(100).lean()).map(visible)
   return res.json({available:!node.revokedAt,connected,sessions})
  }
  const action=req.params.action||'create',id=req.params.sessionId
  if(node.revokedAt&&!['stop','remove','detach','history'].includes(action))return res.status(403).json({error:'Node access has been revoked.'})
  if(action==='create'){
   if(await RuntimeTerminal.countDocuments({...match,state:'running'})>=12)return res.status(409).json({error:'Stop an unused session before creating more.'})
   const record=await RuntimeTerminal.create({_id:randomUUID(),...match,ownerName:[user.first_name,user.last_name].filter(Boolean).join(' ')||user.email||'Administrator',name:'Terminal',state:'connecting'})
   try{const remote=await bridge({action:'create',nodeId:node._id,id:record._id});record.state=remote.state;record.directory=remote.directory;record.name='Terminal '+record._id.slice(0,8);await record.save();return res.status(201).json(visible(record))}
   catch(e){record.state='unavailable';await record.save();throw e}
  }
  const terminal=await RuntimeTerminal.findOne({...match,_id:id}).lean()
  if(!terminal)return res.status(404).json({error:'Session not found or not owned by this account.'})
  if(action==='rename'){
   const name=req.body?.name;if(typeof name!=='string'||!name.trim()||name.length>80)return res.status(400).json({error:'Use a name of 1–80 characters.'})
   await RuntimeTerminal.updateOne({...match,_id:id},{$set:{name:name.trim()}});return res.json({renamed:true})
  }
  if(!['attach','detach','poll','input','resize','history','stop','remove'].includes(action))return res.status(400).json({error:'Unsupported terminal operation.'})
  const body={action,nodeId:node._id,id};for(const key of ['client','cursor','input','seq','rows','cols'])if(req.body?.[key]!==undefined)body[key]=req.body[key]
  if(action==='input')await assertManualTerminalInput(`terminal/ssh/${id}`)
  const data=await bridge(body)
  if(action==='stop')await RuntimeTerminal.updateOne({...match,_id:id},{$set:{state:'stopped'}})
  if(action==='remove')await RuntimeTerminal.deleteOne({...match,_id:id})
  return res.json(data)
 }catch(e){return res.status([400,403,404,409,413,503,504].includes(e.status)?e.status:503).json({error:e.status?e.message:'SSH terminal temporarily unavailable. Reconnect to retry.'})}
})
