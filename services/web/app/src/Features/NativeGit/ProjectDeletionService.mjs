import ProjectWriteGate from '@overleaf/redis-wrapper/ProjectWriteGate.js'
import WorkspacePrepareGate from '@overleaf/redis-wrapper/WorkspacePrepareGate.js'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'
import { readFile, mkdir, rename, rm, open } from 'node:fs/promises'
import { Project } from '../../models/Project.mjs'
import { WritingAssistTask } from '../../models/WritingAssistTask.mjs'
import { WritingAssistConversation } from '../../models/WritingAssistConversation.mjs'
import { DocumentDeletionReservation } from '../../models/DocumentDeletionReservation.mjs'
import { NativeCommentDeletion } from '../../models/NativeCommentDeletion.mjs'
import { ProjectAuditLogEntry } from '../../models/ProjectAuditLogEntry.mjs'
import Docstore from '../Docstore/DocstoreManager.mjs'
import History from '../History/HistoryManager.mjs'
import Chat from '../Chat/ChatApiHandler.mjs'
import Documents from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import Events from '../Editor/EditorRealTimeController.mjs'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import LockManager from '../../infrastructure/LockManager.mjs'
import WorkspaceEpochGate from '@overleaf/redis-wrapper/WorkspaceEpochGate.js'
import { ProjectDeletion } from './ProjectDeletion.mjs'
import { CollaborationTaskStore, taskId } from './CollaborationTaskStore.mjs'
import { ProjectBackupService } from './ProjectBackupService.mjs'
import { verifyBackup } from './BackupDownload.mjs'
import { withProjectOperationLock } from './ProjectOperationLock.mjs'
import { withPreparedProjectWrite, withExclusiveProjectWrite } from './ProjectWriteAccess.mjs'
const locks=LockManager.withTimeout(6*60)
const refuse=message=>Object.assign(Error(message),{status:409})
const missing=error=>error.status===404||error.statusCode===404||error.code==='ENOENT'
async function idempotent(action){try{return await action()}catch(e){if(!missing(e))throw e}}
async function durableJson(path,value){
 await mkdir(Path.dirname(path),{recursive:true,mode:0o700})
 const temporary=path+'.'+randomUUID()+'.tmp',handle=await open(temporary,'wx',0o600)
 try{await handle.writeFile(JSON.stringify(value));await handle.sync()}finally{await handle.close()}
 await rename(temporary,path)
 const folder=await open(Path.dirname(path),'r');try{await folder.sync()}finally{await folder.close()}
}
export class ProjectDeletionService {
 constructor(vault){
  this.vault=vault;this.store=new CollaborationTaskStore(Path.join(vault.root,'project-deletions'))
  this.gate=WorkspaceEpochGate.createWorkspaceEpochGate(RedisWrapper.client('documentupdater'))
 }
 async owner(projectId){
  const project=await Project.findById(projectId).lean().exec()
  if(!project||String(project.owner_ref)!==this.vault.actorId)throw Object.assign(Error('Only the current project owner can delete this project'),{status:403})
  return project
 }
 backupReader(projectId){return new ProjectBackupService({root:Path.join(this.vault.storageRoot,projectId),logicalProjectId:projectId},this.vault.actorId)}
 async inventory(projectId){return this.backupReader(projectId).projects()}
 async busy(task){
  const ids=task.workspaceIds
  if(await WritingAssistTask.exists({projectId:{$in:ids},$or:[{status:{$nin:['completed','failed','cancelled','canceled']}},{'proposals.status':{$in:['applying','uncertain']}}]}))throw refuse('Finish active Assistant tasks before deleting the project.')
  if(await DocumentDeletionReservation.exists({projectId:{$in:ids},state:{$ne:'committed'}}))throw refuse('Resolve pending document deletions before deleting the project.')
  const root=Path.join(this.vault.storageRoot,task.projectId)
  for(const folder of ['collaboration-tasks','shell-draft-tasks']){
   const tasks=await new CollaborationTaskStore(Path.join(root,folder)).list()
   if(tasks.some(t=>!['resolved','applied','discarded','complete','completed','cancelled'].includes(t.state)))throw refuse('Finish merge and Shell recovery tasks before deleting the project.')
  }
 }
 async preview(backupId){
  const backup=await this.vault.resolve(taskId(backupId));await verifyBackup(backup)
  const projectId=backup.manifest.projectId
  return withProjectOperationLock(locks,'nativeGitProject',projectId,async()=>{
   const parent=await this.owner(projectId)
   const existing=(await this.store.list()).find(t=>t.projectId===projectId&&!['completed','cancelled'].includes(t.state))
   if(existing)return existing
   const projects=await this.inventory(projectId)
   if(projects.some(p=>!p.gitWorkspacePrepareEnabled||!p.gitWorkspaceFenceEnabled))throw refuse('All workspaces must support prepared writes before project deletion.')
   const task={id:randomUUID(),revision:1,actorId:this.vault.actorId,projectId,backupId,name:parent.name,state:'planned',completedSteps:[],
    workspaceIds:projects.map(p=>String(p._id)).sort((a,b)=>(a===projectId?1:0)-(b===projectId?1:0)),
    epochs:Object.fromEntries(projects.map(p=>[String(p._id),p.gitWorkspaceEpoch])),
    historyIds:Object.fromEntries(projects.map(p=>[String(p._id),p.overleaf?.history?.id])),createdAt:new Date().toISOString()}
   await this.busy(task);await this.verifySnapshot(task);await this.store.write(task);return task
  })
 }
 async verifySnapshot(task){
  const {manifest}=await this.vault.resolve(task.backupId),projects=await this.inventory(task.projectId)
  if(JSON.stringify(projects.map(p=>String(p._id)).sort())!==JSON.stringify([...task.workspaceIds].sort()))throw refuse('Branch inventory changed; cancel deletion and create a fresh backup.')
  for(const p of projects){
   const expected=manifest.workspaces.find(w=>w.workspaceId===String(p._id))
   if(!expected||(await this.backupReader(task.projectId).state(p)).fingerprint!==expected.fingerprint)throw refuse('Project contents changed since this backup. Cancel deletion and create a fresh verified backup.')
  }
 }
 async list(){return this.store.list()}
 async read(id){try{return await this.store.read(taskId(id))}catch(e){if(missing(e))throw Object.assign(Error('Deletion operation not found'),{status:404});throw e}}
 coordinator(){
  const self=this
  return new ProjectDeletion({
   lock:async(id,fn)=>{const t=await self.read(id);return withProjectOperationLock(locks,'nativeGitProject',t.projectId,fn)},
   read:id=>self.read(id),save:t=>self.store.write(t),
   authorize:async(t,actor)=>{if(actor!==self.vault.actorId||t.actorId!==actor)throw Object.assign(Error('Deletion ownership mismatch'),{status:403});if(!['deleting','completed'].includes(t.state))await self.owner(t.projectId)},
   verifyRetainedBackup:async t=>{await verifyBackup(await self.vault.resolve(t.backupId))},
   verifyInventory:async t=>{await self.busy(t);const ids=(await self.inventory(t.projectId)).map(p=>String(p._id)).sort();if(JSON.stringify(ids)!==JSON.stringify([...t.workspaceIds].sort()))throw refuse('Branch inventory changed')},
   freeze:async(t,id)=>{
    const p=await Project.findById(id).lean().exec()
    if(p?.gitProjectDeletion===t.id){
     await withExclusiveProjectWrite(id,async()=>{
      await Documents.promises.flushProjectToMongo(id);await History.promises.flushProject(id)
      await self.gate.fence(id,p.gitWorkspaceEpoch)
     },{deletionId:t.id})
     await Events.emitToRoom(id,'nativeGitProjectDeleting',{projectId:id,logicalProjectId:t.projectId});return
    }
    if(!p||p.gitProjectDeletion)throw refuse('Workspace deletion ownership changed')
    let sealed=false
    try { await withPreparedProjectWrite(id,p.gitWorkspaceEpoch,async assertActive=>{
     await Documents.promises.flushProjectToMongo(id);await History.promises.flushProject(id);await assertActive()
     // Record ownership before fencing. A crash after this CAS can be resumed
     // or cancelled using the durable marker; never leave an anonymous fence.
     const changed=await Project.updateOne({_id:id,gitProjectDeletion:{$exists:false},gitWorkspaceEpoch:p.gitWorkspaceEpoch},{$set:{gitProjectDeletion:t.id}})
     if(changed.modifiedCount!==1)throw refuse('Workspace changed before deletion')
     await self.gate.fence(id,p.gitWorkspaceEpoch);sealed=true
    }) } catch(error) {
      // A sealed deletion deliberately leaves the epoch blocked, unlike an
      // ordinary prepared edit. Accept only that exact post-action check after
      // proving our durable marker and blocked epoch; all cleanup errors escape.
      if(!sealed||error.message!=='WORKSPACE_PREPARE_STALE')throw error
      if(!await Project.exists({_id:id,gitProjectDeletion:t.id,gitWorkspaceEpoch:p.gitWorkspaceEpoch}))throw error
      await self.gate.fence(id,p.gitWorkspaceEpoch)
    }
    await Events.emitToRoom(id,'nativeGitProjectDeleting',{projectId:id,logicalProjectId:t.projectId})
   },
   assertAllFrozen:async t=>{
    for(const id of t.workspaceIds){const p=await Project.findById(id).select('gitProjectDeletion gitWorkspaceEpoch').lean().exec()
     if(p&&p.gitProjectDeletion!==t.id)throw refuse('Workspace is not frozen by this deletion')
     if(p)await self.gate.fence(id,p.gitWorkspaceEpoch)
     else if(t.state!=='deleting')throw refuse('Workspace disappeared before deletion')
    }
   },
   verifySnapshot:t=>self.verifySnapshot(t),
   retainPrivateRecords:async t=>{
    const ids=t.workspaceIds
    // Preserve per-user records independently; never expose private Assistant
    // transcripts through the owner's shared paper backup.
    const conversations=await WritingAssistConversation.find({projectId:{$in:ids}}).lean().exec()
    const tasks=await WritingAssistTask.find({projectId:{$in:ids}}).lean().exec()
    const parent=await Project.findById(t.projectId).select('owner_ref collaberator_refs reviewer_refs readOnly_refs').lean().exec()
    const participants=[parent.owner_ref,...(parent.collaberator_refs||[]),...(parent.reviewer_refs||[]),...(parent.readOnly_refs||[])].map(String)
    for(const userId of new Set([...participants,...[...conversations,...tasks].map(r=>r.userId)])){
     if(!/^[a-f0-9]{24}$/.test(userId))throw refuse('Invalid private record owner')
     await durableJson(Path.join(self.vault.storageRoot,'recovery-vault',userId,'private-records',t.id+'.json'),{id:t.id,projectId:t.projectId,workspaceIds:ids,name:t.name,conversations:conversations.filter(r=>r.userId===userId),tasks:tasks.filter(r=>r.userId===userId)})
    }
    const records={audit:await ProjectAuditLogEntry.find({projectId:{$in:ids}}).lean().exec(),comments:await NativeCommentDeletion.find({projectId:{$in:ids}}).lean().exec(),deletions:await DocumentDeletionReservation.find({projectId:{$in:ids}}).lean().exec()}
    await durableJson(Path.join(self.vault.root,'deletion-evidence',t.id+'.json'),records)
   },
   resources:['cache','documents','history','chat','records','project'],
   remove:async(t,id,resource)=>{
    if(resource==='cache')return withExclusiveProjectWrite(id,()=>Documents.promises.flushProjectToMongoAndDelete(id),{deletionId:t.id})
    if(resource==='documents')return idempotent(()=>Docstore.promises.destroyProject(id))
    if(resource==='history')return idempotent(()=>History.promises.deleteProject(id,t.historyIds[id]))
    if(resource==='chat')return idempotent(()=>Chat.promises.destroyProject(id))
    if(resource==='records'){
     // Keep original private rows as well, so an already-running provider's
     // late final transcript is not discarded after the recovery copy was made.
     await WritingAssistTask.updateMany({projectId:id},{$set:{deletionRetention:true},$unset:{expiresAt:1}})
     await NativeCommentDeletion.deleteMany({projectId:id});await DocumentDeletionReservation.deleteMany({projectId:id});await ProjectAuditLogEntry.deleteMany({projectId:id});return
    }
    if(resource==='project')await Project.deleteOne({_id:id,gitProjectDeletion:t.id})
   },
   removeRepository:async t=>{
    const original=Path.join(self.vault.storageRoot,t.projectId),retained=Path.join(self.vault.root,'deletion-evidence',t.id+'-repository')
    await mkdir(Path.dirname(retained),{recursive:true,mode:0o700})
    try{await rename(original,retained)}catch(e){if(e.code!=='ENOENT')throw e}
    // Keep task/backup evidence; remove credentials and executable worktrees.
    for(const name of ['repository','worktrees','credentials','webhook','access-policy','auto-sync','auto-commit','remote-discovery'])await rm(Path.join(retained,name),{recursive:true,force:true})
   },
   unfreeze:async(t,id)=>{
    const p=await Project.findById(id).lean().exec();if(!p||!p.gitProjectDeletion)return
    if(p.gitProjectDeletion!==t.id)throw refuse('Workspace deletion ownership changed')
    await withExclusiveProjectWrite(id,async()=>{
     const previous=t.epochs[id],next=previous+1
     if(p.gitWorkspaceEpoch===previous){
       await Documents.promises.flushProjectToMongo(id)
       await History.promises.flushProject(id)
       await self.gate.fence(id,previous)
       const changed=await Project.updateOne({_id:id,gitProjectDeletion:t.id,gitWorkspaceEpoch:previous},{$set:{gitWorkspaceEpoch:next}})
       if(changed.modifiedCount!==1)throw refuse('Workspace generation changed')
     } else if(p.gitWorkspaceEpoch!==next) throw refuse('Workspace generation changed')
     await self.gate.publish(id,next)
     await WorkspacePrepareGate.createWorkspacePrepareGate(RedisWrapper.client('documentupdater')).recoverMembership(id,{epoch:previous,nextEpoch:next,writeToken:ProjectWriteGate.current(id).token})
     await Project.updateOne({_id:id,gitProjectDeletion:t.id,gitWorkspaceEpoch:next},{$unset:{gitProjectDeletion:1}})
     await Events.emitToRoom(id,'nativeGitWorkspaceEpochChanged',{projectId:id,epoch:next})
    },{deletionId:t.id})
   },
  })
 }
}
