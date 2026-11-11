import { executeRemoteCommand } from './RemoteOperations.mjs'
import { cloneRepository } from './CloneRepository.mjs'
import ProjectRootDocManager from '../Project/ProjectRootDocManager.mjs'
import ProjectCreationHandler from '../Project/ProjectCreationHandler.mjs'
import { Project } from '../../models/Project.mjs'
import { readAccessPolicy, saveAccessPolicy, requireRepositoryWrite } from './AccessPolicy.mjs'
import { terminalRequest } from './TerminalAccess.mjs'
import { readGraphSettings, saveGraphSettings } from './GraphSettings.mjs'
import Path from 'node:path'
import { mkdir } from 'node:fs/promises'
import Settings from '@overleaf/settings'
import LockManager from '../../infrastructure/LockManager.mjs'
import { User } from '../../models/User.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import EditorController from '../Editor/EditorController.mjs'
import FileTypeManager from '../Uploads/FileTypeManager.mjs'
import { GitRepository } from './GitRepository.mjs'
import { WorkspaceStore } from './WorkspaceStore.mjs'
import { ProjectWorkspace } from './ProjectWorkspace.mjs'
import { createOverleafProject } from './OverleafProject.mjs'
import { executeGitCommand } from './GitCommands.mjs'
import { generateCommitMessage } from './CommitMessage.mjs'
import WritingAssistLLMProvider from '../WritingAssist/WritingAssistLLMProvider.mjs'
import { withExclusiveProjectWrite, projectWriteIntegrationEnabled, checkProjectWriteIntegration } from './ProjectWriteAccess.mjs'
import { RemoteCredentials, createCredentialEncryptor } from './RemoteCredentials.mjs'
import { withProjectOperationLock } from './ProjectOperationLock.mjs'
import { connectRepository } from './ConnectRepository.mjs'

const locks = LockManager.withTimeout(6 * 60)
const identity = id => {
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) throw new Error('Invalid project identity')
  return id.toLowerCase()
}

// No routes are enabled until deployment opts in. Editor-changing commands also
// require the platform's exclusive write scope; it cannot be supplied by HTTP.
const terminalPolicies = new Map()
export function createNativeGitRuntime({ storagePath, withExclusiveWrite, checkWriteIntegration, credentialEncryptor } = {}) {
  async function context(projectId, userId) {
    projectId = identity(projectId)
    userId = identity(userId)
    const root = Path.join(storagePath || Settings.nativeGit?.storagePath || '/var/lib/overleaf/native-git', projectId)
    const options = { worktreeRoot: Path.join(root, 'worktrees') }
    await mkdir(Path.join(root, 'repository'), { recursive: true, mode: 0o700 })
    const repository = new GitRepository(Path.join(root, 'repository'), options)
    const store = new WorkspaceStore(Path.join(root, 'binding'))
    const withLock = fn => withProjectOperationLock(locks, 'nativeGitProject', projectId, fn)
    const project = createOverleafProject({ projectId, userId,
      entities: id => ProjectEntityHandler.promises.getAllEntities(id),
      documents: DocumentUpdaterHandler.promises,
      blobs: (id, hash, signal) => HistoryManager.promises.requestBlobWithProjectId(id, hash, 'GET', '', signal),
      editor: EditorController.promises,
      isEditable: FileTypeManager.isEditable,
      withExclusiveWrite: withExclusiveWrite && (fn => withExclusiveWrite(projectId, fn)),
    })
    const workspace = new ProjectWorkspace({ repository, project, store, withLock, transferRoot: Path.join(root, 'transfers') })
    const key = Settings.nativeGit?.credentialKey
    const encryptor = credentialEncryptor || createCredentialEncryptor(key)
    const credentials = new RemoteCredentials(Path.join(root, 'credentials', userId), encryptor)
    return { root, options, repository, store, withLock, workspace, project, credentials }
  }

  async function author(userId) {
    const user = await User.findById(userId).select('first_name last_name email').lean().exec()
    if (!user?.email) throw Object.assign(new Error('Set an account email before committing'), { status: 409 })
    return { name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email, email: user.email }
  }

  return {
    async initialize(projectId, userId, branch) {
      const c = await context(projectId, userId)
      requireRepositoryWrite(await readAccessPolicy(c.root, userId))
      await c.withLock(async () => {
        try { await c.store.read(); return } catch (error) { if (error.code !== 'ENOENT') throw error }
        await GitRepository.init(c.repository.directory, c.options, branch)
        await c.store.initialize({ directory: c.repository.directory, branch })
      })
      return { connected: true, ...(await c.workspace.inspect()) }
    },
    async status(projectId, userId) {
      const c = await context(projectId, userId)
      try { await c.store.read() } catch (error) { if (error.code === 'ENOENT') return { connected: false }; throw error }
      return { connected: true, ...(await c.workspace.inspect()) }
    },
    async execute(projectId, userId, command) {
      const c = await context(projectId, userId)
      const policy = await readAccessPolicy(c.root, userId)
      if (command.command === 'accessPolicy') return { result: policy }
      if (command.command === 'setAccessPolicy') {
        if (command.mode === 'extended') throw Object.assign(new Error('Approved directories mode has been removed.'), {status:403})
        await terminalRequest({project:String(projectId),user:String(userId),action:'revoke'})
        return { result: await saveAccessPolicy(c.root,userId,{ mode:command.mode,directories:[] }) }
      }
      const readCommands = new Set(['graphSettings','saveGraphSettings','terminalApprove','terminalOpen','terminalPoll','terminalInput','terminalRun','terminalResize','terminalClose','terminalInfo','terminalRead','gitOutput','ignoredFiles','generateMessage','amendDetails','diff','graph','show','commitDiff','commitDetails','commitFiles','commitFileDiff','commitFilePreview','fileDiff','filePreview','fileHunks','fileHistory','conflictDetails','blame','branches','worktrees','tags','remotes','stashes','stashDiff','discardDetails','discardAllDetails','undoDetails','resetDetails'])
      if (!readCommands.has(command.command)) requireRepositoryWrite(policy)
      if (['terminalApprove','terminalOpen','terminalPoll','terminalInput','terminalRun','terminalResize','terminalClose'].includes(command.command)) {
        const allowed = (process.env.OVERLEAF_NATIVE_GIT_TERMINAL_USERS || '').split(',')
        if (!allowed.includes(String(userId))) throw Object.assign(new Error('Server shell access is not enabled for this account.'), { status: 403 })
        const key = `${projectId}:${userId}`
        if (command.command === 'terminalApprove') throw Object.assign(new Error('Directory grants are no longer supported.'), {status:403})
        const base = { project: String(projectId), user: String(userId) }
        if (command.command === 'terminalOpen') {
          return { result: await c.workspace.run(async repo => {
            const commonDirectory = Path.resolve(repo.directory, (await repo.git.raw(['rev-parse', '--git-common-dir'])).trim())
            const session = await terminalRequest({ ...base, action: 'open', directory: repo.directory, commonDirectory, mode: policy.mode, directories: policy.directories })
            terminalPolicies.set(session.id, {key, policy}); return session
          }) }
        }
        const session = terminalPolicies.get(command.id)
        if ((!session || session.key !== key) && command.command !== 'terminalClose') {
          await terminalRequest({...base,action:'close',id:command.id})
          throw Object.assign(new Error('Terminal session is no longer authorized. Reopen the terminal.'),{status:409})
        }
        if (session && session.key === key && command.command !== 'terminalClose' && (session.policy.mode !== policy.mode || session.policy.expires && session.policy.expires < Date.now())) {
          await terminalRequest({...base,action:'close',id:command.id});terminalPolicies.delete(command.id)
          throw Object.assign(new Error('Terminal permissions changed or expired. Reopen the terminal.'),{status:409})
        }
        if (command.command === 'terminalClose' && session?.key === key) {
          terminalPolicies.delete(command.id)
          if(session.policy.mode==='extended' && session.policy.expires===policy.expires) await saveAccessPolicy(c.root,userId,{mode:'workspace-write',directories:[]})
        }
        return { result: await terminalRequest({ ...base, action: {terminalPoll:'poll',terminalClose:'close',terminalInput:'input',terminalRun:'run',terminalResize:'resize'}[command.command], id:command.id, input:command.input, text:command.text, approval:command.approval, cols:command.cols, rows:command.rows }) }

      }
      if (command.command === 'graphSettings') return { result: { ...await readGraphSettings(c.root, userId), effectiveUser: await author(userId) } }
      if (command.command === 'saveGraphSettings') return { result: await c.withLock(() => saveGraphSettings(c.root, userId, command.settings)) }
      if (command.command === 'clone') {
        if (!withExclusiveWrite) throw Object.assign(new Error('Git editor write integration is not enabled'),{status:503})
        await checkWriteIntegration?.()
        const result=await cloneRepository(c,String(userId),command,{context,createProject:async(owner,name,id)=>{
          const existing=await Project.findById(id).select('owner_ref').lean().exec()
          if(existing){if(String(existing.owner_ref)!==owner)throw new Error('Clone project ownership mismatch');return}
          await ProjectCreationHandler.promises.createBlankProject(owner,name,{_id:id})
        }})
        await ProjectRootDocManager.promises.ensureRootDocumentIsSet(result.projectId)
        return {result}
      }
      if (command.command === 'connect') {
        await connectRepository(c, command)
        return { connected: true, ...(await c.workspace.inspect()) }
      }
      if (command.command === 'generateMessage') {
        const result = await generateCommitMessage(c.workspace, ({ systemPrompt, userMessage }) =>
          WritingAssistLLMProvider.check({ provider: 'agent', timeout: 60000 }, '', systemPrompt, [], userMessage))
        return { result, ...(await c.workspace.inspect()) }
      }
      const editorCommands = new Set(['checkout', 'checkoutDetached', 'merge', 'rebase', 'cherryPick', 'revert', 'reset',
        'continueOperation', 'resolveConflict', 'discard', 'discardAll', 'stash', 'applyStash', 'resumeTransfer', 'cancelTransfer', 'pull', 'sync'])
      if (editorCommands.has(command.command) && !withExclusiveWrite) {
        throw Object.assign(new Error('Git editor write integration is not enabled'), { status: 503 })
      }
      if (editorCommands.has(command.command)) await checkWriteIntegration?.()
      const remoteCommands = ['fetch', 'pull', 'push', 'sync', 'remoteRef', 'deleteRemoteRef', 'pushTags', 'credentialStatus', 'saveCredential', 'removeCredential']
      if (remoteCommands.includes(command.command)) {
        const execute = async repo => {
          let identity
          if (['pull','sync'].includes(command.command)) {
            const preferences = await readGraphSettings(c.root, userId)
            identity = preferences.userName ? {name:preferences.userName,email:preferences.userEmail} : await author(userId)
          }
          return executeRemoteCommand(repo,command,{credentials:c.credentials,author:identity})
        }
        const result = await (['pull','sync'].includes(command.command) ? c.workspace.mutate(execute) : c.workspace.run(execute))
        return { result: result ?? null, ...(await c.workspace.inspect()) }
      }
      if (['commitDetails', 'commitDiff', 'commitFiles', 'commitFileDiff', 'commitFilePreview'].includes(command.command)) {
        return { result: await executeGitCommand(c.workspace, command) }
      }
      const needsAuthor = ['commit', 'merge', 'rebase', 'cherryPick', 'revert', 'continueOperation'].includes(command.command)
      const preferences = needsAuthor ? await readGraphSettings(c.root, userId) : null
      const identity = preferences?.userName ? { name: preferences.userName, email: preferences.userEmail } : needsAuthor ? await author(userId) : undefined
      const result = await executeGitCommand(c.workspace, command, identity)
      return { result: result ?? null, ...(await c.workspace.inspect()) }
    },
  }
}

export const nativeGitRuntime = createNativeGitRuntime({
  withExclusiveWrite: projectWriteIntegrationEnabled() ? withExclusiveProjectWrite : undefined,
  checkWriteIntegration: checkProjectWriteIntegration,
})
