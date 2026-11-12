import Path from 'node:path'
import { readFile, mkdir, writeFile, copyFile, readdir, open } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Project } from '../../models/Project.mjs'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import Chat from '../Chat/ChatApiHandler.mjs'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import WorkspaceEpochGate from '@overleaf/redis-wrapper/WorkspaceEpochGate.js'
import WorkspacePrepareGate from '@overleaf/redis-wrapper/WorkspacePrepareGate.js'
import { CollaborationTaskStore } from './CollaborationTaskStore.mjs'
import { ProjectBackupService } from './ProjectBackupService.mjs'
import { verifyBackup } from './BackupDownload.mjs'
import { planBackupRestore } from './BackupRestorePlan.mjs'
import { restoreWorkspaceHistory } from './BackupHistoryRestore.mjs'
import { restoreConversations } from './BackupConversationRestore.mjs'
import { restoreGit } from './BackupGitRestore.mjs'
const digest = value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const refusal = message=>Object.assign(Error(message),{status:409})

export class BackupRestoreService {
  constructor(c,actorId,backups=new ProjectBackupService(c,actorId)){this.c=c;this.actorId=actorId;this.backups=backups;this.store=new CollaborationTaskStore(Path.join(c.root,'backup-restores'))}
  public(plan){
    if (plan.state === 'restoring' && Date.now() >= plan.deadline) plan={...plan,state:'interrupted',failure:'Restore did not finish within its execution window. Start a new isolated restore; the original project is unchanged.'}
    return {id:plan.id,revision:plan.revision,state:plan.state,backupId:plan.backupId,name:plan.workspaces.find(w=>w.sourceId===plan.sourceProjectId).project.name,
    workspaces:plan.workspaces.length,completedSteps:plan.completedSteps,failure:plan.failure,
    url:plan.state==='completed'?`/project/${plan.targetProjectId}`:undefined}}
  async save(plan,patch){Object.assign(plan,patch,{revision:plan.revision+1});await this.store.write(plan);return plan}
  async list(){
    await this.backups.authorize()
    return Promise.all((await this.store.list()).map(async p=>{
      if (p.state !== 'completed' && await Project.exists({_id:p.targetProjectId,'gitBackupRestore.operationId':p.id})) p={...p,state:'completed',failure:undefined}
      return this.public(p)
    }))
  }
  async preview(backupId){
    await this.backups.authorize()
    return this.c.recoveryLock(async()=>{
      const backup=await this.backups.resolve(backupId);await verifyBackup(backup)
      const metadata=await Promise.all(backup.manifest.workspaces.map(w=>readFile(Path.join(backup.directory,`workspaces/${w.workspaceId}/metadata.json`)).then(JSON.parse)))
      const plan=planBackupRestore(backup.manifest,metadata,this.actorId)
      await this.store.write(plan);return this.public(plan)
    })
  }
  async apply(id,revision){
    await this.backups.authorize()
    return this.c.recoveryLock(async()=>{
      await this.backups.authorize()
      const plan=await this.store.read(id).catch(error=>{if(error.code==='ENOENT')throw Object.assign(Error('Restore attempt not found in this project'),{status:404});throw error})
      if(plan.actorId!==this.actorId||plan.sourceProjectId!==this.c.logicalProjectId) throw refusal('Restore ownership changed')
      if(plan.state==='completed') return this.public(plan)
      if(plan.revision!==revision) throw refusal('Restore progress changed. Refresh before retrying.')
      const published=await Project.findById(plan.targetProjectId).select('gitBackupRestore').lean().exec()
      if(published){
        if(published.gitBackupRestore?.operationId!==plan.id) throw refusal('Restore destination identity is already in use')
        await this.save(plan,{state:'completed',failure:undefined});return this.public(plan)
      }
      if (plan.state !== 'planned') throw refusal('This restore attempt cannot be restarted in place. Create a new isolated restore from the same backup.')
      const deadline = Date.now() + 5 * 60 * 1000
      const assertDeadline = () => { if (Date.now() >= deadline) throw refusal('Restore exceeded the safe execution window; original project is unchanged. Start a new isolated restore.') }
      const backup=await this.backups.resolve(plan.backupId);await verifyBackup(backup)
      if(digest(backup.manifest)!==plan.manifestHash) throw refusal('Backup changed after restore preview')
      assertDeadline()
      const root=Path.join(this.c.storageRoot || Path.dirname(this.c.root),plan.targetProjectId)
      await mkdir(root,{recursive:true,mode:0o700})
      const marker=Path.join(root,'restore-owner.json')
      try{await writeFile(marker,JSON.stringify({operationId:plan.id}),{flag:'wx',mode:0o600})}
      catch(error){if(error.code!=='EEXIST')throw error;if(JSON.parse(await readFile(marker)).operationId!==plan.id)throw refusal('Restore directory is already in use')}
      await this.save(plan,{state:'restoring',deadline,failure:undefined})
      const step=async(name,fn)=>{
        if(plan.completedSteps.includes(name)) return
        assertDeadline();await fn();assertDeadline();await this.save(plan,{completedSteps:[...plan.completedSteps,name]})
      }
      try{
        await step('retained backup evidence',async()=>{
          for(const entry of [...backup.manifest.entries,{path:'manifest.json'}]){
            assertDeadline()
            const target=Path.join(root,'restored-evidence',entry.path)
            await mkdir(Path.dirname(target),{recursive:true,mode:0o700})
            await copyFile(Path.join(backup.directory,entry.path),target)
          }
        })
        for(const workspace of plan.workspaces){
          const target=workspace.project._id
          await step(`history ${target}`,()=>restoreWorkspaceHistory(backup.directory,backup.manifest,workspace.sourceId,target))
          await step(`documents ${target}`,async()=>{
            for(const doc of Object.values(workspace.documents)) await DocstoreManager.promises.updateDoc(target,doc.id,doc.lines,doc.version,doc.ranges)
            for(const doc of workspace.deletedDocuments||[]){
              await DocstoreManager.promises.updateDoc(target,doc._id,doc.lines,doc.version,doc.ranges)
              await DocstoreManager.promises.deleteDoc(target,doc._id,doc.name,doc.deletedAt)
            }
          })
          await step(`comments and labels ${target}`,()=>restoreConversations(plan.id,workspace))
        }
        await step('Git workspaces',async()=>{plan.gitStates=await restoreGit(backup.directory,backup.manifest,plan,root)})
        await step('verify restored documents',async()=>{
          for(const workspace of plan.workspaces){
            for(const doc of Object.values(workspace.documents)){
              const actual=await DocstoreManager.promises.getDoc(workspace.project._id,doc.id)
              if(JSON.stringify(actual.lines)!==JSON.stringify(doc.lines)||actual.version!==doc.version||digest(actual.ranges)!==digest(doc.ranges)) throw refusal('Restored document verification failed')
            }
            const threads=await Chat.promises.getThreads(workspace.project._id)
            for(const [threadId,thread] of Object.entries(workspace.threads)){
              const normalized=list=>list.map(m=>[m.content,m.user_id,m.timestamp]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
              if(digest(normalized(threads[threadId]?.messages||[]))!==digest(normalized(thread.messages))) throw refusal('Restored comment verification failed')
            }
          }
        })
        await step('persist restored files', async () => {
          await verifyBackup({directory:Path.join(root,'restored-evidence'),manifest:backup.manifest})
          const sync = async directory => {
            for (const entry of await readdir(directory, { withFileTypes: true })) {
              assertDeadline()
              const path = Path.join(directory, entry.name)
              if (entry.isDirectory()) await sync(path)
              else if (entry.isFile()) { const handle = await open(path, 'r'); try { await handle.sync() } finally { await handle.close() } }
              else throw refusal('Unexpected file type in restored project')
            }
            const handle = await open(directory, 'r'); try { await handle.sync() } finally { await handle.close() }
          }
          await sync(root)
        })
        // Publish the logical parent last. Until then, inherited workspace access
        // rejects all children; no open editor can see a partially restored tree.
        for(const workspace of [...plan.workspaces].sort((a,b)=>(a.sourceId===plan.sourceProjectId?1:0)-(b.sourceId===plan.sourceProjectId?1:0))){
          assertDeadline();await this.backups.authorize()
          await step(`publish ${workspace.project._id}`,async()=>{
            const redis=RedisWrapper.client('documentupdater'), epoch=workspace.project.gitWorkspaceEpoch
            await WorkspaceEpochGate.createWorkspaceEpochGate(redis).publish(workspace.project._id,epoch)
            await WorkspacePrepareGate.createWorkspacePrepareGate(redis).initialize(workspace.project._id,epoch)
            const previous=await Project.findById(workspace.project._id).select('gitBackupRestore').lean().exec()
            if(previous){if(previous.gitBackupRestore?.operationId!==plan.id)throw refusal('Restore project identity is already in use');return}
            const record=new Project({...workspace.project,gitBackupRestore:{operationId:plan.id,sourceProjectId:plan.sourceProjectId,backupId:plan.backupId}})
            await record.save()
          })
        }
        await this.save(plan,{state:'completed',failure:undefined})
      }catch(error){
        if(await Project.exists({_id:plan.targetProjectId,'gitBackupRestore.operationId':plan.id})) await this.save(plan,{state:'completed',failure:undefined})
        else {await this.save(plan,{state:'failed',failure:'Restore stopped before completion. Original project and captured data remain unchanged. Start a new isolated restore from the backup; this incomplete destination remains retained.'});throw error}
      }
      return this.public(plan)
    })
  }
}
