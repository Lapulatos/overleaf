import { WritingAssistTask } from '../../models/WritingAssistTask.mjs'
import { WritingAssistConversation } from '../../models/WritingAssistConversation.mjs'
import { ProjectDeletionService } from './ProjectDeletionService.mjs'
import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { buildDefaultPolicy } from '../../infrastructure/CSP.mjs'
import Path from 'node:path'
import Settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import LockManager from '../../infrastructure/LockManager.mjs'
import { RecoveryVault } from './RecoveryVault.mjs'
import { BackupRestoreService } from './BackupRestoreService.mjs'
import { downloadBackup } from './BackupDownload.mjs'
import { withProjectOperationLock } from './ProjectOperationLock.mjs'
import { taskId } from './CollaborationTaskStore.mjs'
const locks = LockManager.withTimeout(6 * 60)
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c])
const date = value => new Date(value).toISOString().replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2}).*$/, '$3-$2-$1 $4 UTC')
const styles = '\n:root{color-scheme:light dark}body{font:16px/1.6 system-ui,sans-serif;max-width:850px;margin:3rem auto;padding:0 1.5rem}section{border:1px solid #888;border-radius:8px;padding:1rem;margin:1rem 0}button,a{font:inherit}button{padding:.4rem .8rem;cursor:pointer}a{color:light-dark(#075e36,#81d4aa)}.error{color:light-dark(#a11,#ff9999)}'
const page = body => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paper recovery vault</title><style>${styles}</style><body><a href="/project">Projects</a> · <a href="/git-recovery">Recovery vault</a><h1>Paper recovery vault</h1><p>These private copies belong to your account and remain accessible after the source project is deleted. Restoration creates a new project; members, credentials and automatic sync are not restored.</p>${body}</body></html>`
const form = (action, csrf, text, extra = '') => `<form method="post" action="${escape(action)}"><input type="hidden" name="_csrf" value="${escape(csrf)}">${extra}<button type="submit">${escape(text)}</button></form>`

export function applyRecoveryVaultRoutes(router) {
  const login = AuthenticationController.requireLogin()
  const handle = operation => expressify(async (req,res) => {
    if (!Settings.nativeGit?.enabled) return res.sendStatus(404)
    res.set('Cache-Control','no-store')
    const styleHash = createHash('sha256').update(styles).digest('base64')
    res.set('Content-Security-Policy', buildDefaultPolicy(undefined, `'sha256-${styleHash}'`).replace("form-action 'none'", "form-action 'self'"))
    const actor = String(SessionManager.getLoggedInUserId(req.session))
    const storageRoot = Settings.nativeGit.storagePath || '/var/lib/overleaf/native-git'
    const vault = new RecoveryVault(storageRoot,actor)
    try { await operation(req,res,vault) }
    catch (error) {
      if ([400,403,404,409,413,503,507].includes(error.status)) return res.status(error.status).type('html').send(page(`<p class="error">${escape(error.message)}</p>`))
      throw error
    }
  })
  const service = async (vault,id) => {
    const { manifest } = await vault.resolve(taskId(id))
    const authorize = async () => { await vault.resolve(id) }
    const c = { root:Path.join(vault.root,id,'operations'), storageRoot:vault.storageRoot,
      logicalProjectId:manifest.projectId,
      recoveryLock:fn=>withProjectOperationLock(locks,'nativeGitVault',`${vault.actorId}-${id}`,fn) }
    return new BackupRestoreService(c,vault.actorId,{ authorize, resolve:backupId=>vault.resolve(backupId) })
  }
  router.get('/git-recovery/deletion/:operationId',login,handle(async(req,res,vault)=>{
    const task=await new ProjectDeletionService(vault).read(req.params.operationId),base=`/git-recovery/deletion/${task.id}`,csrf=res.locals.csrfToken
    const active=!['completed','cancelled'].includes(task.state)
    res.type('html').send(page(`<h2>Delete ${escape(task.name)}</h2><p>State: ${escape(task.state)} · ${task.workspaceIds.length} workspaces</p><p>Retained backup: <a href="/git-recovery/${escape(task.backupId)}">Download or restore</a></p><p>All branches, live files, history and shared chat will be removed from the project. Each user's private Assistant records remain available only to that user. Retained recovery copies and deletion receipts are kept.</p>${task.failure?`<p class="error">${escape(task.failure)}</p>`:''}${active?form(`${base}/apply`,csrf,task.state==='planned'?'Confirm permanent project deletion':'Resume approved deletion'):''}${active&&task.state!=='deleting'?form(`${base}/cancel`,csrf,'Cancel deletion and reopen workspaces'):''}${task.state==='cancelled'?`<p><a href="/project/${escape(task.projectId)}">Open preserved project</a></p>`:''}<p>Completed steps: ${task.completedSteps.length}</p>`))
  }))
  for(const action of ['apply','cancel']) router.post(`/git-recovery/deletion/:operationId/${action}`,login,handle(async(req,res,vault)=>{
    const service=new ProjectDeletionService(vault),id=taskId(req.params.operationId)
    try { await service.coordinator()[action==='apply'?'run':'cancel'](id,vault.actorId) }
    catch(error){if(![409,503,504].includes(error.status))throw error}
    res.redirect(303,`/git-recovery/deletion/${id}`)
  }))
  router.get('/git-recovery/private/:operationId',login,handle(async(req,res,vault)=>{
    const id=taskId(req.params.operationId)
    let data;try{data=await readFile(Path.join(vault.root,'private-records',id+'.json'))}catch(e){if(e.code==='ENOENT')return res.sendStatus(404);throw e}
    const retained=JSON.parse(data),query={projectId:{$in:retained.workspaceIds||[retained.projectId]},userId:vault.actorId}
    const merge=(before,after)=>[...new Map([...before,...after].map(r=>[r._id,r])).values()]
    retained.conversations=merge(retained.conversations,await WritingAssistConversation.find(query).lean().exec())
    retained.tasks=merge(retained.tasks,await WritingAssistTask.find(query).lean().exec())
    res.attachment(`private-assistant-records-${id}.json`).type('application/json').send(JSON.stringify(retained))
  }))
  router.get('/git-recovery',login,handle(async(req,res,vault)=>{
    const entries=await vault.list()
    const deletions=await new ProjectDeletionService(vault).list()
    const privateRecords=await readdir(Path.join(vault.root,'private-records')).catch(e=>{if(e.code==='ENOENT')return [];throw e})
    const retained=deletions.map(t=>`<section><a href="/git-recovery/deletion/${escape(t.id)}">Deletion: ${escape(t.name)}</a> · ${escape(t.state)}</section>`).join('')+privateRecords.filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(n=>`<p><a href="/git-recovery/private/${escape(n.slice(0,-5))}">Download your retained Assistant records · ${escape(n.slice(0,-5))}</a></p>`).join('')
    res.type('html').send(page(retained+(entries.length?entries.map(item=>`<section><a href="${escape(item.url)}">Backup ${escape(item.id)}</a><p>${escape(date(item.capturedAt))} · ${item.workspaces} workspaces · ${(item.bytes/1024/1024).toFixed(2)} MB</p></section>`).join(''):'<p>No retained copies. Open Project backups in a paper project and choose Keep in recovery vault.</p>')))
  }))
  router.get('/git-recovery/:backupId/download',login,handle(async(req,res,vault)=>{
    await downloadBackup(res,await vault.resolve(taskId(req.params.backupId)))
  }))
  router.get('/git-recovery/:backupId',login,handle(async(req,res,vault)=>{
    const id=taskId(req.params.backupId),backup=await vault.resolve(id),restores=await (await service(vault,id)).list()
    const base=`/git-recovery/${id}`,csrf=res.locals.csrfToken
    const jobs=restores.map(r=>`<section><strong>${escape(r.name)}</strong>: ${escape(r.state)}${r.failure?`<p class="error">${escape(r.failure)}</p>`:''}${r.url?`<p><a href="${escape(r.url)}">Open restored project</a></p>`:''}${r.state==='planned'?`<p>Create a new private project with ${r.workspaces} workspaces?</p>${form(`${base}/restore/${r.id}`,csrf,'Create restored project',`<input type="hidden" name="revision" value="${r.revision}">`)}`:''}</section>`).join('')
    res.type('html').send(page(`<h2>Retained backup</h2><p>${escape(id)} · ${escape(date(backup.manifest.sourceCapturedAt))}</p><p><a href="${base}/download">Download verified ZIP</a></p>${form(`${base}/preview`,csrf,'Preview restoration')}<hr>${form(`${base}/delete-preview`,csrf,'Review deletion of source project')}${jobs}`))
  }))
  router.post('/git-recovery/:backupId/delete-preview',login,handle(async(req,res,vault)=>{
    const task=await new ProjectDeletionService(vault).preview(taskId(req.params.backupId))
    res.redirect(303,`/git-recovery/deletion/${task.id}`)
  }))
  router.post('/git-recovery/:backupId/preview',login,handle(async(req,res,vault)=>{
    const id=taskId(req.params.backupId);await (await service(vault,id)).preview(id)
    res.redirect(303,`/git-recovery/${id}`)
  }))
  router.post('/git-recovery/:backupId/restore/:taskId',login,handle(async(req,res,vault)=>{
    const id=taskId(req.params.backupId),revision=Number(req.body.revision)
    if(!Number.isSafeInteger(revision)||revision<1) return res.sendStatus(400)
    await (await service(vault,id)).apply(taskId(req.params.taskId),revision)
    res.redirect(303,`/git-recovery/${id}`)
  }))
}
