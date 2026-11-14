import Settings from '@overleaf/settings'
import {readFileSync} from 'node:fs'
import {RuntimeTerminal} from '../../models/RuntimeTerminal.mjs'
import {RuntimeNode} from '../../models/RuntimeNode.mjs'
import {User} from '../../models/User.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import {nativeGitRuntime} from '../NativeGit/NativeGitRuntime.mjs'
export const uuidPattern='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'
export function parseSessionReference(value){const m=new RegExp(`^terminal/(ssh|paper)/(${uuidPattern})$`).exec(value);if(!m)throw Object.assign(Error('Use the complete Terminal Session ID.'),{status:400});return {kind:m[1],id:m[2]}}
export function referencedSessions(text){return [...new Set([...text.matchAll(new RegExp(`(?<![\\w@/])@(terminal/(?:ssh|paper)/${uuidPattern})(?=$|[^\\w/-])`,'g'))].map(m=>m[1]))]}
export async function authorizeProject(userId,projectId){if(!await AuthorizationManager.promises.canUserWriteProjectContent(userId,projectId))throw Object.assign(Error('Project access required.'),{status:403})}
export async function sshAllowed(userId){const u=await User.findById(userId).select('isAdmin').lean();return !!u?.isAdmin||Settings.runtimeNodes?.ownerUserId===userId}
export async function sshBridge(body){const c=JSON.parse(readFileSync('/etc/overleaf/remote-terminal.json','utf8'));if(!c.nodeIds.includes(body.nodeId)&&!await RuntimeNode.exists({_id:body.nodeId,sshConfigured:true,revokedAt:{$exists:false}}))throw Object.assign(Error('Node SSH is not configured.'),{status:403});const r=await fetch(c.endpoint+'/command',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${c.token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'Node terminal unavailable.'),{status:r.status});return data}
export async function listSessions(userId,projectId){
 await authorizeProject(userId,projectId)
 const sessions=[]
 try{const {result}=await nativeGitRuntime.execute(projectId,userId,{command:'shellDraftList'});for(const t of result)sessions.push({reference:`terminal/paper/${t.id}`,id:t.id,kind:'paper',name:t.name||'Terminal '+t.id.slice(0,8),location:t.sourcePosition?.branch||'Paper terminal',state:t.sessionStatus||t.state,createdAt:t.createdAt})}catch(e){if(e.status===403)throw e}
 if(await sshAllowed(userId)){const rows=await RuntimeTerminal.find({createdBy:userId}).sort({createdAt:-1}).limit(100).lean();const nodes=await RuntimeNode.find({_id:{$in:rows.map(t=>t.nodeId)}}).select('name revokedAt').lean();for(const t of rows){const n=nodes.find(n=>n._id===t.nodeId);if(n&&!n.revokedAt)sessions.push({reference:`terminal/ssh/${t._id}`,id:t._id,kind:'ssh',name:t.name,location:n.name,state:t.state,createdAt:t.createdAt})}}
 return sessions
}
export async function resolveSession(userId,projectId,reference){
 await authorizeProject(userId,projectId);const {kind,id}=parseSessionReference(reference)
 if(kind==='ssh'){if(!await sshAllowed(userId))throw Object.assign(Error('Node terminal access denied.'),{status:403});const t=await RuntimeTerminal.findOne({_id:id,createdBy:userId}).lean();const n=t&&await RuntimeNode.findOne({_id:t.nodeId,revokedAt:{$exists:false}}).lean();if(!n)throw Object.assign(Error('Session unavailable or not owned by this account.'),{status:404});return {...t,id,kind,reference,location:n.name}}
 const {result}=await nativeGitRuntime.execute(projectId,userId,{command:'shellDraftGet',id});return {...result,kind,reference,location:result.sourcePosition?.branch||'Paper terminal'}
}
export async function readSession(userId,projectId,reference){const t=await resolveSession(userId,projectId,reference);let data;if(t.kind==='ssh')data=await sshBridge({action:'history',nodeId:t.nodeId,id:t.id});else data=(await nativeGitRuntime.execute(projectId,userId,{command:t.state==='running'?'shellDraftPoll':'shellDraftHistory',id:t.id,cursor:0})).result;const output=String(data.output||'');return {reference,name:t.name||'Terminal '+t.id.slice(0,8),location:t.location,state:t.state,output:output.slice(-24000),truncated:!!data.truncated||output.length>24000,capturedAt:new Date().toISOString()}}
