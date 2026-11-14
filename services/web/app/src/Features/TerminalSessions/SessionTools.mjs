import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import FileSystemImportManager from '../Uploads/FileSystemImportManager.mjs'
import FileTypeManager from '../Uploads/FileTypeManager.mjs'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import Path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {TerminalAgentGrant,TerminalAgentOperation,TerminalInputLease} from '../../models/TerminalAgentAccess.mjs'
import {WritingAssistTask} from '../../models/WritingAssistTask.mjs'
import {nativeGitRuntime} from '../NativeGit/NativeGitRuntime.mjs'
import {resolveSession,referencedSessions,readSession,sshBridge,authorizeProject} from './SessionRegistry.mjs'
const hash=s=>createHash('sha256').update(s).digest('hex')
const refuse=(s,status=409)=>Object.assign(Error(s),{status})
export async function prepareSessionTools(userId,projectId,taskId,instruction){
 const references=referencedSessions(instruction);if(!references.length)return null;if(references.length>8)throw refuse('Reference at most eight Terminal Sessions.',400)
 for(const ref of references)await resolveSession(userId,projectId,ref)
 const token=randomBytes(32).toString('hex'),id=randomUUID()
 await TerminalAgentGrant.create({_id:id,taskId,userId,projectId,tokenHash:hash(token),references,expiresAt:new Date(Date.now()+30*60*1000)})
 return {url:Settings.siteUrl.replace(/\/$/,'')+'/terminal-agent/tools',id,token,references}
}
async function activeGrant(grant){
 if(!grant||grant.expiresAt<Date.now())throw refuse('Terminal tool access expired.',403)
 await authorizeProject(grant.userId,grant.projectId)
 if(!await WritingAssistTask.exists({_id:grant.taskId,userId:grant.userId,status:{$in:['preparing','submitting','running']}}))throw refuse('The Agent task is no longer active.',403)
}
export async function authenticateGrant(id,token){if(typeof token!=='string'||token.length!==64)throw refuse('Invalid terminal tool access.',403);const g=await TerminalAgentGrant.findOne({_id:id,tokenHash:hash(token)}).lean();await activeGrant(g);return g}
async function target(grant,ref){if(!grant.references.includes(ref))throw refuse('Reference this Terminal Session in your message first.',403);return resolveSession(grant.userId,grant.projectId,ref)}
async function policy(grant){return (await nativeGitRuntime.execute(grant.projectId,grant.userId,{command:'accessPolicy'})).result}
async function localFiles(session,request){
 const root=Path.join(Settings.nativeGit?.storagePath||'/var/lib/overleaf/native-git',session.logicalProjectId,'drafts',session.id,'work')
 return runFiles(root,request)
}
export async function runFiles(root,request){
 const helper=fileURLToPath(new URL('../../../../../runtime-terminal/files.py',import.meta.url))
 return new Promise((resolve,reject)=>{const child=spawn('python3',[helper,root],{stdio:['pipe','pipe','pipe']});let output='';const timer=setTimeout(()=>{child.kill();reject(refuse('File transfer timed out.'))},20000);child.on('error',()=>{clearTimeout(timer);reject(refuse('File adapter unavailable.'))});child.stdout.on('data',b=>{output+=b;if(output.length>8*1024*1024)child.kill()});child.on('close',()=>{clearTimeout(timer);try{const r=JSON.parse(output);if(r.error)throw refuse(r.error);resolve(r)}catch(e){reject(e.status?e:refuse('File transfer unavailable.'))}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(request))})
}
async function files(grant,ref,request){const s=await target(grant,ref);const result=await (s.kind==='ssh'?sshBridge({action:'files',nodeId:s.nodeId,id:s.id,filesRequest:request}):localFiles(s,request));if(result.error)throw refuse(result.error);return result}
async function perform(grant,kind,args){
 await activeGrant(grant)
 if(kind==='command'){
  const s=await target(grant,args.reference);if(typeof args.command!=='string'||!args.command.trim()||args.command.length>16000||/[\x00\r]/.test(args.command))throw refuse('Invalid terminal command.',400)
  const ref=s.reference
  await TerminalInputLease.deleteOne({_id:ref,expiresAt:{$lte:new Date()}})
  try{await TerminalInputLease.create({_id:ref,expiresAt:new Date(Date.now()+30000)})}catch{throw refuse('Another input operation is using this terminal.')}
  try{
   if(s.kind==='ssh')await sshBridge({action:'agent-command',nodeId:s.nodeId,id:s.id,filesRequest:{command:args.command}})
   else{
    const before=await readSession(grant.userId,grant.projectId,ref)
    const plain=before.output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').trimEnd()
    if(!/[$#]$/.test(plain))throw refuse('Terminal appears busy or has unfinished input. Finish it before Agent execution.')
    await nativeGitRuntime.execute(grant.projectId,grant.userId,{command:'shellDraftInput',id:s.id,input:args.command+'\n'})
   }
   await new Promise(r=>setTimeout(r,500))
   return {commandSent:true,...await readSession(grant.userId,grant.projectId,ref),notice:'Input was sent to the existing shell. This is not proof of completion or exit status. Read output to verify; do not resend after an uncertain failure.'}
  }finally{await TerminalInputLease.deleteOne({_id:ref})}
 }
 if(kind==='copy'){
  if(args.source==='project'&&args.destination==='project')throw refuse('Choose at least one Terminal Session.',400)
  const exported=args.source==='project'?{files:args.files}:await files(grant,args.source,{action:'read',paths:args.paths})
  if(args.destination==='project'){
   if(exported.files.some(file=>file.path.split('/').some(part=>FileTypeManager.shouldIgnore(part))))throw refuse('Some paths are excluded by project upload rules. Select other files.',400)
   const temporary=await mkdtemp(Path.join(tmpdir(),'terminal-import-'))
   try{await runFiles(temporary,{action:'write',files:exported.files,destination:''});const folder='terminal-results-'+args.requestId;try{await FileSystemImportManager.promises.addEntity(grant.userId,grant.projectId,null,folder,temporary,false)}catch(error){logger.warn({err:error,operationId:args.requestId},'Terminal project import interrupted');throw refuse('Import interrupted. Check '+folder+' in the file tree before retrying. Source files remain in the Session.')}return {imported:true,folder,files:exported.files.map(f=>folder+'/'+f.path),notice:'Imported as a new folder in the project file tree; no existing files were replaced.'}}finally{await rm(temporary,{recursive:true,force:true})}
  }
  return files(grant,args.destination,{action:'write',files:exported.files,destination:args.destinationPath||''})
 }
 throw refuse('Unsupported terminal action.',400)
}
export async function terminalTool(grant,body){
 if(body.action==='read'){await target(grant,body.reference);return readSession(grant.userId,grant.projectId,body.reference)}
 if(body.action==='files'){return files(grant,body.reference,{action:'read',paths:body.paths})}
 if(body.action==='poll'){
  const op=await TerminalAgentOperation.findOne({_id:body.operationId,grantId:grant._id}).lean();if(!op)throw refuse('Operation not found.',404);return {operationId:op._id,state:op.state,result:op.result,error:op.error}
 }
 if(!['command','copy'].includes(body.action))throw refuse('Unsupported terminal tool.',400)
 if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(body.requestId))throw refuse('A unique operation ID is required.',400)
 const existing=await TerminalAgentOperation.findOne({_id:body.requestId,grantId:grant._id}).lean();if(existing)return {operationId:existing._id,state:existing.state,result:existing.result,error:existing.error}
 const mode=(await policy(grant)).mode;if(mode==='read-only')throw refuse('Read-only mode does not allow terminal commands or file transfers.',403)
 if(body.action==='command')await target(grant,body.reference)
 else for(const ref of [body.source,body.destination])if(ref!=='project')await target(grant,ref)
 const op=await TerminalAgentOperation.create({_id:body.requestId,grantId:grant._id,userId:grant.userId,projectId:grant.projectId,kind:body.action,args:body,state:mode==='full-access'&&body.destination!=='project'?'ready':'pending',createdAt:new Date(),expiresAt:grant.expiresAt})
 if(mode==='full-access'&&body.destination!=='project')return executeOperation(op._id,grant)
 return {operationId:op._id,state:'pending',notice:'Waiting for user approval in Paper Assistant. No operation has executed.'}
}
export async function executeOperation(id,grant){
 await activeGrant(grant);if((await policy(grant)).mode==='read-only')throw refuse('Read-only mode blocks this operation.',403)
 const op=await TerminalAgentOperation.findOneAndUpdate({_id:id,grantId:grant._id,state:{$in:['pending','ready']}},{$set:{state:'running'}},{new:true}).lean();if(!op)throw refuse('Operation already handled.')
 try{const result=await perform(grant,op.kind,op.args);await TerminalAgentOperation.updateOne({_id:id},{$set:{state:'completed',result},$unset:{args:''}});return {operationId:id,state:'completed',result}}
 catch(e){logger.warn({err:e,operationId:id,kind:op.kind},'Terminal Agent operation failed');await TerminalAgentOperation.updateOne({_id:id},{$set:{state:'failed',error:e.status?e.message:'Terminal operation failed; inspect the session before retrying.'},$unset:{args:''}});return {operationId:id,state:'failed',error:e.status?e.message:'Terminal operation failed; inspect the session before retrying.'}}
}
