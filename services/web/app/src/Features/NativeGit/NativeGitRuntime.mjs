import { autoSyncScheduleId } from './AutoSyncSchedule.mjs'
import { annotateTerminalLocations } from './TerminalIndicators.mjs'
import { shellSessionWorkspace } from './ShellSessionWorkspace.mjs'
import { annotateAutoCommitBranches, annotateAutoSyncBranches } from './AutoCommitIndicators.mjs'
import { readAutoCommitSchedule } from './AutoCommitSchedule.mjs'
import { isHistoryReadCommand } from './HistoryReadCommands.mjs'
import { readWebhook, publicWebhook, configureWebhook, receiveWebhook } from './GitHubWebhook.mjs'
import { RecoveryVault } from './RecoveryVault.mjs'
import { BackupRetention } from './BackupRetention.mjs'
import { BackupRestoreService } from './BackupRestoreService.mjs'
import { ProjectBackupService } from './ProjectBackupService.mjs'
import { mergeValidationRuntime } from './MergeValidationRuntime.mjs'
import workspaceEvents from '../Editor/EditorRealTimeController.mjs'
import ProjectEntityUpdateHandler from '../Project/ProjectEntityUpdateHandler.mjs'
import { changeWorkspaceLifecycle } from './WorkspaceLifecycle.mjs'
import { createAutoSync, pendingMerge } from './AutoSyncRuntime.mjs'
import { prepareReviewedPull } from './ReviewedPull.mjs'
import { AutoCommitService } from './AutoCommitService.mjs'
import { AutoCommitController } from './AutoCommitController.mjs'
import { ShellApplicationService } from './ShellApplicationService.mjs'
import { ShellRecoveryService } from './ShellRecoveryService.mjs'
import { publicShellDraft, ShellDraftService, manualTerminalMode } from './ShellDraftService.mjs'
import { executeShellDraftCommand, shellDraftTerminal } from './ShellDraftCommands.mjs'
import { authorizedOperationLock, authorizedWriteLease } from './AuthorizedOperationLock.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import { configureDiscoverySchedule, runDueDiscovery, readDiscoverySchedule, publicDiscoverySchedule } from './RemoteDiscoverySchedule.mjs'
import { listRemoteDiscoveries, publicDiscoveryTask } from './RemoteDiscoveryStatus.mjs'
import { discoverRemote } from './RemoteDiscovery.mjs'
import WorkspacePrepareGate from '@overleaf/redis-wrapper/WorkspacePrepareGate.js'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import { readGitPresencePosition } from './GitPresencePosition.mjs'
import { runSessionRecoveryCommand } from './SessionRecoveryRuntime.mjs'
import { workspaceEpochAdapter } from './WorkspaceEpochRuntime.mjs'
import { MergeApplicationService } from './MergeApplicationService.mjs'
import { MergeRecoveryService } from './MergeRecoveryService.mjs'
import { MergeDraftService, publicMergeTask } from './MergeDraftService.mjs'
import { CollaborationTaskStore } from './CollaborationTaskStore.mjs'
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
import { withExclusiveProjectWrite, withPreparedProjectWrite, projectWriteIntegrationEnabled, checkProjectWriteIntegration } from './ProjectWriteAccess.mjs'
import { RemoteCredentials, createCredentialEncryptor } from './RemoteCredentials.mjs'
import { withProjectOperationLock } from './ProjectOperationLock.mjs'
import { connectRepository } from './ConnectRepository.mjs'
import { resolveWorkspaceScope } from './WorkspaceScope.mjs'
import { enterBranchWorkspace } from './BranchWorkspaces.mjs'
import CollaboratorsGetter from '../Collaborators/CollaboratorsGetter.mjs'
import { requireCommandCapability } from './CommandCapabilities.mjs'

const locks = LockManager.withTimeout(6 * 60)
const identity = id => {
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) throw new Error('Invalid project identity')
  return id.toLowerCase()
}

// No routes are enabled until deployment opts in. Editor-changing commands also
// require the platform's exclusive write scope; it cannot be supplied by HTTP.
const terminalPolicies = new Map()
export function createNativeGitRuntime({ storagePath, withExclusiveWrite, withPreparedWrite, checkWriteIntegration, credentialEncryptor } = {}) {
  async function context(projectId, userId, command) {
    projectId = identity(projectId)
    userId = identity(userId)
    const scope = await resolveWorkspaceScope(projectId)
    const logicalProjectId = scope.logicalProjectId
    const isolated = scope.internal || scope.enabled || (Settings.nativeGit?.workspaceProjects || []).includes(logicalProjectId)
    if (isolated) {
      const access = await CollaboratorsGetter.promises.getProjectAccess(logicalProjectId)
      if (!access.invitedMemberIds().some(id => String(id) === userId) && String(access.getOwnerId()) !== userId) {
        throw Object.assign(new Error('Branch workspaces require named project membership'), { status: 403 })
      }
    }
    const root = Path.join(storagePath || Settings.nativeGit?.storagePath || '/var/lib/overleaf/native-git', logicalProjectId)
    const options = { worktreeRoot: Path.join(root, 'worktrees') }
    await mkdir(Path.join(root, 'repository'), { recursive: true, mode: 0o700 })
    const repository = new GitRepository(Path.join(root, 'repository'), options)
    const defaultStore = new WorkspaceStore(Path.join(root, 'binding'))
    const store = scope.internal ? new WorkspaceStore(Path.join(root, 'workspace-bindings', projectId)) : defaultStore
    const transferRoot = scope.internal ? Path.join(root, 'transfers', projectId) : Path.join(root, 'transfers')
    const recoveryTasks = new CollaborationTaskStore(Path.join(root, 'session-recovery', projectId, 'tasks'))
    const assertAccess = async () => {
      // Repeat after lock waits and at document write checkpoints. Permission
      // modes and /git both use this same server-owned capability check.
      await requireCommandCapability(command, userId, () =>
        CollaboratorsGetter.promises.getProjectAccess(logicalProjectId))
      const currentScope = await resolveWorkspaceScope(projectId)
      if (currentScope.internal && currentScope.state !== 'ready' && currentScope.state !== 'preparing') throw Object.assign(Error('Workspace is archived; restore it from another workspace'), { status: 409 })
      const historyRead = command === 'historyStatus' || isHistoryReadCommand(command)
      const permitted = historyRead ? await AuthorizationManager.promises.canUserReadProject(userId, logicalProjectId)
        : await AuthorizationManager.promises.canUserWriteProjectContent(userId, logicalProjectId)
      if (!permitted) throw Object.assign(new Error(historyRead ? 'Project read access was revoked' : 'Project write access was revoked'), { status: 403 })
      if (isolated) {
        const access = await CollaboratorsGetter.promises.getProjectAccess(logicalProjectId)
        if (String(access.getOwnerId()) !== userId && !access.invitedMemberIds().some(id => String(id) === userId)) {
          throw Object.assign(new Error('Project membership was revoked'), { status: 403 })
        }
      }
    }
    const recoveryLock = authorizedOperationLock(
      fn => withProjectOperationLock(locks, 'nativeGitProject', logicalProjectId, fn), assertAccess)
    const withLock = fn => recoveryLock(async () => {
      const historyTasks = await new CollaborationTaskStore(Path.join(root, 'history-restores', projectId)).list()
      if (historyTasks.some(task => task.state !== 'resolved')) throw Object.assign(Error('History restore interrupted. Open History recovery before continuing repository operations.'), { status: 409 })
      if ((await recoveryTasks.list()).some(task => task.state !== 'resolved')) {
        throw Object.assign(new Error('Session recovery must finish before repository operations can continue'), { status: 409 })
      }
      return fn()
    })
    const project = createOverleafProject({ projectId, userId,
      entities: id => ProjectEntityHandler.promises.getAllEntities(id),
      documents: DocumentUpdaterHandler.promises,
      blobs: (id, hash, signal) => HistoryManager.promises.requestBlobWithProjectId(id, hash, 'GET', '', signal),
      editor: EditorController.promises,
      isEditable: FileTypeManager.isEditable,
      withExclusiveWrite: withExclusiveWrite && (fn => withExclusiveWrite(projectId, (assertLease, preparation) => fn(authorizedWriteLease(assertLease, assertAccess), preparation))),
      withPreparedWrite: withPreparedWrite && ((epoch, fn) => withPreparedWrite(projectId, epoch, (assertLease, preparation) => fn(authorizedWriteLease(assertLease, assertAccess), preparation))),
    })
    const workspace = new ProjectWorkspace({ repository, project, store, withLock, transferRoot })
    const key = Settings.nativeGit?.credentialKey
    const encryptor = credentialEncryptor || createCredentialEncryptor(key)
    const credentials = new RemoteCredentials(Path.join(root, 'credentials', userId), encryptor)
    return { assertAccess, recoveryTasks, recoveryLock, collaboration: { drafts: isolated, apply: isolated && scope.fenceEnabled && scope.prepareEnabled && !!withPreparedWrite }, epoch: scope.fenceEnabled ? workspaceEpochAdapter(projectId) : null, root, options, repository, store, defaultStore, withLock, workspace, project, credentials, logicalProjectId, isolated, transferRoot }
  }

  async function author(userId) {
    const user = await User.findById(userId).select('first_name last_name email').lean().exec()
    if (!user?.email) throw Object.assign(new Error('Set an account email before committing'), { status: 409 })
    return { name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email, email: user.email }
  }

  async function withAutoCommitIndicators(c, projectId, snapshot) {
    if (!snapshot.branches || !c.isolated) return snapshot
    const projects = await Project.find({ 'gitWorkspace.logicalProjectId': c.logicalProjectId }, { _id: 1, 'gitWorkspace.branch': 1, 'gitWorkspace.state': 1 }).lean().exec()
    const workspaces = projects.map(project => ({ id: String(project._id), branch: project.gitWorkspace?.branch, archived: project.gitWorkspace?.state === 'archived' }))
    if (!workspaces.some(item => item.id === String(projectId))) {
      const binding = await c.store.read()
      workspaces.push({ id: String(projectId), branch: binding.branch, archived: false })
    }
    let branches = await annotateAutoCommitBranches(snapshot.branches, workspaces, id => readAutoCommitSchedule(new CollaborationTaskStore(Path.join(c.root, 'auto-commit', identity(id), 'schedule'))))
    branches = await annotateAutoSyncBranches(branches, workspaces, async id => {
      try { return await new CollaborationTaskStore(Path.join(c.root, 'auto-sync', identity(id), 'schedule')).read(autoSyncScheduleId) }
      catch (error) { if (error.code !== 'ENOENT') throw error; return null }
    })
    await c.assertAccess()
    return withTerminalIndicators(c, { ...snapshot, branches })
  }
  async function withTerminalIndicators(c, snapshot) {
    if (!c.isolated) return snapshot
    const tasks = await new CollaborationTaskStore(Path.join(c.root, 'shell-draft-tasks')).list()
    const visible = tasks.filter(task => task.kind === 'shell-draft' && task.logicalProjectId === c.logicalProjectId && !task.deletedAt)
    const owners = [...new Set(visible.map(task => task.createdBy))]
    const people = owners.length ? await User.find({ _id: { $in: owners } }).select('first_name last_name').lean().exec() : []
    const users = new Map(people.map(user => [String(user._id), [user.first_name, user.last_name].filter(Boolean).join(' ').slice(0, 200) || 'Collaborator']))
    const result = await annotateTerminalLocations(snapshot, visible, {
      logicalProjectId: c.logicalProjectId, users,
      health: async task => {
        if (!task.sessionId) return 'unavailable'
        try {
          // The runner response stays server-side; only liveness is shared.
          const status = await terminalRequest({ action: 'poll', project: c.logicalProjectId, user: task.createdBy, id: task.sessionId, cursor: 0 })
          return status.exited ? 'stopped' : 'running'
        } catch (error) {
          return /session expired|shell exited/i.test(error.message) ? 'stopped' : 'unavailable'
        }
      },
    })
    await c.assertAccess()
    return result
  }
  function autoCommitController(c, projectId, userId) {
    if (!c.epoch || !c.collaboration.apply || !withPreparedWrite) throw Object.assign(Error('Automatic commits require prepared branch workspaces'), { status: 409 })
    const authorize = async actor => {
      await c.assertAccess()
      const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
      if (String(access.getOwnerId()) !== String(actor)) throw Object.assign(Error('Only the project owner can manage automatic commits'), { status: 403 })
      requireRepositoryWrite(await readAccessPolicy(c.root, actor))
    }
    const root = Path.join(c.root, 'auto-commit', identity(projectId))
    const store = new CollaborationTaskStore(Path.join(root, 'schedule'))
    const service = new AutoCommitService({ workspace: c.workspace, project: c.project, workspaceStore: c.store,
      taskStore: new CollaborationTaskStore(Path.join(root, 'tasks')), withLock: c.withLock,
      hasPendingMerge: async () => pendingMerge(await new CollaborationTaskStore(Path.join(c.root, 'collaboration-tasks')).list(), identity(projectId)),
      authorize: () => authorize(userId), readEpoch: () => c.epoch.read(), workspaceId: identity(projectId), ownerId: identity(userId) })
    return new AutoCommitController({ service, store, withLock: c.withLock, authorize,
      authorizeRead: async () => {
        await c.assertAccess()
        const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
        return String(access.getOwnerId()) === String(userId)
      },
      workspaceId: identity(projectId), ownerId: identity(userId), enabled: Settings.nativeGit?.autoCommitScheduler === true })
  }

  function autoSync(c, projectId, userId) {
    if (!c.epoch || !c.collaboration.apply) throw Object.assign(Error('Automatic sync requires prepared branch workspaces'), { status: 409 })
    const authorize = async () => {
      await c.assertAccess()
      const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
      if (String(access.getOwnerId()) !== userId) throw Object.assign(Error('Only the project owner can manage automatic sync'), { status: 403 })
      requireRepositoryWrite(await readAccessPolicy(c.root, userId))
    }
    return createAutoSync({ c, workspaceId: identity(projectId), ownerId: identity(userId), authorize,
      author: () => author(userId), withLock: action => withProjectOperationLock(locks, 'nativeGitAutoSync', projectId, action) })
  }

  return {
    async backupFile(projectId, userId, id) {
      return new ProjectBackupService(await context(projectId, userId), userId).resolve(id)
    },
    async runScheduledAutoSync(projectId, logicalProjectId) {
      if (Settings.nativeGit?.autoSyncScheduler !== true) return null
      const scope = await resolveWorkspaceScope(identity(projectId))
      if (scope.internal && scope.state !== 'ready') return null
      if (scope.logicalProjectId !== logicalProjectId) throw Object.assign(Error('Scheduled workspace changed'), { status: 409 })
      const parent = await Project.findById(scope.logicalProjectId).select('owner_ref deletedByExternalDataSource').lean().exec()
      if (!parent || parent.deletedByExternalDataSource) return null
      const ownerId = String(parent.owner_ref), c = await context(projectId, ownerId)
      return autoSync(c, projectId, ownerId).runDue()
    },
    async runScheduledAutoCommit(projectId, logicalProjectId) {
      if (Settings.nativeGit?.autoCommitScheduler !== true) return null
      const scope = await resolveWorkspaceScope(identity(projectId))
      if (scope.internal && scope.state !== 'ready') return null
      if (logicalProjectId && scope.logicalProjectId !== logicalProjectId) throw Object.assign(Error('Scheduled workspace project changed'), { status: 409 })
      const parent = await Project.findById(scope.logicalProjectId).select('owner_ref deletedByExternalDataSource').lean().exec()
      if (!parent || parent.deletedByExternalDataSource) return null
      const ownerId = String(parent.owner_ref), c = await context(projectId, ownerId)
      return autoCommitController(c, projectId, ownerId).runDue()
    },
    async receiveGitHubWebhook(projectId, request) {
      const parent = await Project.findById(identity(projectId)).select('owner_ref gitWorkspace').lean().exec()
      if (!parent || parent.gitWorkspace?.logicalProjectId) throw Object.assign(Error('Webhook not found.'), { status: 404 })
      const userId = String(parent.owner_ref), c = await context(projectId, userId)
      return c.workspace.readHistory(async repo => {
        await c.assertAccess()
        const current = await Project.findById(projectId).select('owner_ref').lean().exec()
        if (String(current?.owner_ref) !== userId) throw Object.assign(Error('Webhook owner changed.'), { status: 403 })
        requireRepositoryWrite(await readAccessPolicy(c.root, userId))
        return receiveWebhook({ ...request, ownerId: userId,
          store: new CollaborationTaskStore(Path.join(c.root, 'webhook')),
          schedules: new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'schedule')),
          encryptor: credentialEncryptor || createCredentialEncryptor(Settings.nativeGit?.credentialKey),
          remoteUrl: remote => repo.remoteUrl(remote) })
      })
    },
    async runScheduledDiscovery(projectId) {
      const project = await Project.findById(identity(projectId)).select('owner_ref deletedByExternalDataSource gitWorkspace').lean().exec()
      if (!project || project.deletedByExternalDataSource || project.gitWorkspace?.logicalProjectId) return null
      const c = await context(projectId, String(project.owner_ref))
      const store = new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'schedule'))
      return runDueDiscovery({ store, withLock: fn => c.workspace.readHistory(fn),
        authorize: async actor => {
          const current = await Project.findById(identity(projectId)).select('owner_ref deletedByExternalDataSource').lean().exec()
          if (!current || current.deletedByExternalDataSource || String(current.owner_ref) !== actor) throw Object.assign(Error('Discovery owner changed'), { status: 403 })
          requireRepositoryWrite(await readAccessPolicy(c.root, actor))
        }, remoteUrl: (repo, remote) => repo.remoteUrl(remote),
        discover: (repo, policy, authorize) => discoverRemote({ repo,
          store: new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'tasks')),
          credentials: c.credentials, remote: policy.remote, operationId: policy.operationId, userId: policy.ownerId, authorize }),
      })
    },
    async presencePosition(projectId, userId, viewedCommit = null) {
      const c = await context(projectId, userId, 'historyStatus')
      if (!c.isolated || !c.epoch) throw Object.assign(new Error('Branch presence is unavailable'), { status: 409 })
      return c.withLock(async () => {
        const assertMember = async () => {
          const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
          if (String(access.getOwnerId()) !== userId && !access.invitedMemberIds().some(id => String(id) === userId)) {
            throw Object.assign(new Error('Project membership was revoked'), { status: 403 })
          }
        }
        await assertMember()
        const user = await User.findById(userId).select('first_name last_name').lean().exec()
        if (!user) throw Object.assign(new Error('User no longer exists'), { status: 403 })
        const position = await readGitPresencePosition({ workspace: c.workspace, epoch: c.epoch,
          logicalProjectId: c.logicalProjectId, workspaceId: identity(projectId), userId: identity(userId),
          displayName: [user.first_name, user.last_name].filter(Boolean).join(' ').slice(0, 200) || 'Collaborator', viewedCommit })
        await assertMember()
        return { ...position, readOnly: !await AuthorizationManager.promises.canUserWriteProjectContent(userId, c.logicalProjectId) }
      })
    },
    async initialize(projectId, userId, branch) {
      const c = await context(projectId, userId)
      requireRepositoryWrite(await readAccessPolicy(c.root, userId))
      await c.withLock(async () => {
        try { await c.store.read(); return } catch (error) { if (error.code !== 'ENOENT') throw error }
        await GitRepository.init(c.repository.directory, c.options, branch)
        await c.store.initialize({ directory: c.repository.directory, branch })
      })
      const snapshot = await c.workspace.inspect()
      if (snapshot.mutationTaskId) {
        try {
          const task = await new CollaborationTaskStore(Path.join(c.root, 'shell-draft-tasks')).read(snapshot.mutationTaskId)
          if (task.kind === 'shell-draft' && task.logicalProjectId === c.logicalProjectId && task.workspaceId === identity(projectId)) {
            snapshot.mutationKind = 'shell'
            snapshot.canRecoverMutation = task.createdBy === identity(userId)
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      if (snapshot.mutationTaskId && !snapshot.mutationKind) {
        try {
          const task = await new CollaborationTaskStore(Path.join(c.root, 'auto-commit', identity(projectId), 'tasks')).read(snapshot.mutationTaskId)
          if (task.kind === 'automatic-commit' && task.workspaceId === identity(projectId)) {
            snapshot.mutationKind = 'auto-commit'
            snapshot.canRecoverMutation = task.ownerId === identity(userId)
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      return { connected: true, collaboration: c.collaboration, ...await withAutoCommitIndicators(c, projectId, snapshot) }
    },
    async status(projectId, userId) {
      const scope = await resolveWorkspaceScope(projectId)
      const readOnly = !await AuthorizationManager.promises.canUserWriteProjectContent(userId, scope.logicalProjectId)
      const c = await context(projectId, userId, readOnly ? 'historyStatus' : undefined)
      await c.assertAccess()
      if (readOnly) {
        try { await c.store.read() } catch (error) { if (error.code === 'ENOENT') return { connected: false, readOnly: true }; throw error }
        // Never export live editor contents just to show a viewer the graph.
        const snapshot = await c.workspace.readHistory(async repo => ({ connected: true, readOnly: true,
          graph: await repo.graph(), branches: await repo.branches(), tags: await repo.tagRefs() }))
        return withAutoCommitIndicators(c, projectId, snapshot)
      }
      try { await c.store.read() } catch (error) { if (error.code === 'ENOENT') return { connected: false }; throw error }
      const snapshot = await c.workspace.inspect()
      if (snapshot.mutationTaskId) {
        try {
          const task = await new CollaborationTaskStore(Path.join(c.root, 'shell-draft-tasks')).read(snapshot.mutationTaskId)
          if (task.kind === 'shell-draft' && task.logicalProjectId === c.logicalProjectId && task.workspaceId === identity(projectId)) {
            snapshot.mutationKind = 'shell'
            snapshot.canRecoverMutation = task.createdBy === identity(userId)
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      if (snapshot.mutationTaskId && !snapshot.mutationKind) {
        try {
          const task = await new CollaborationTaskStore(Path.join(c.root, 'auto-commit', identity(projectId), 'tasks')).read(snapshot.mutationTaskId)
          if (task.kind === 'automatic-commit' && task.workspaceId === identity(projectId)) {
            snapshot.mutationKind = 'auto-commit'
            snapshot.canRecoverMutation = task.ownerId === identity(userId)
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      return { connected: true, collaboration: c.collaboration, ...await withAutoCommitIndicators(c, projectId, snapshot) }
    },
    async execute(projectId, userId, command) {
      let c = await context(projectId, userId, command.command)
      if(command.command.startsWith('shellDraft')) {
        await c.assertAccess()
        const workspaceId=await shellSessionWorkspace({command,store:new CollaborationTaskStore(Path.join(c.root,'shell-draft-tasks')),logicalProjectId:c.logicalProjectId,actorId:identity(userId),currentWorkspaceId:identity(projectId)})
        if(workspaceId!==identity(projectId)) {
          const source=await context(workspaceId,userId,command.command)
          if(source.logicalProjectId!==c.logicalProjectId)throw Object.assign(new Error('Terminal workspace belongs to another project'),{status:403})
          await source.assertAccess()
          c=source;projectId=workspaceId
        }
      }
      if (command.command === 'backupRestoreList') return { result: await new BackupRestoreService(c, userId).list() }
      if (command.command === 'backupRestorePreview') return { result: await new BackupRestoreService(c, userId).preview(command.id) }
      if (command.command === 'backupRestoreApply') return { result: await new BackupRestoreService(c, userId).apply(command.id, command.revision) }
      if (command.command === 'backupCleanupPreview') return { result: await new BackupRetention(c, () => new ProjectBackupService(c, userId).authorize()).preview() }
      if (command.command === 'backupCleanupApply') return { result: await new BackupRetention(c, () => new ProjectBackupService(c, userId).authorize()).apply(command.id, command.fingerprint) }
      if (command.command === 'backupRetain') return { result: await c.recoveryLock(async () => {
        const backups = new ProjectBackupService(c, userId)
        return new RecoveryVault(Path.dirname(c.root), userId).retain(await backups.resolve(command.id), () => backups.authorize())
      }) }
      if (command.command === 'backupCreate') return { result: await new ProjectBackupService(c, userId).create() }
      if (command.command === 'backupList') return { result: await new ProjectBackupService(c, userId).list() }
      await c.assertAccess()
      if (isHistoryReadCommand(command.command)) {
        const result = await executeGitCommand(c.workspace, command)
        return { result: command.command === 'graph' ? (await withTerminalIndicators(c, { graph: result })).graph : result }
      }
      const policy = await readAccessPolicy(c.root, userId)
      if (['workspaceList', 'workspaceLifecycle'].includes(command.command)) {
        const children = () => Project.find({ 'gitWorkspace.logicalProjectId': c.logicalProjectId }).select('gitWorkspace').lean().exec()
        if (command.command === 'workspaceList') return { result: (await children()).map(p => ({ workspaceId: String(p._id), ...p.gitWorkspace })) }
        requireRepositoryWrite(policy)
        const authorize = async () => {
          const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
          if (String(access.getOwnerId()) !== String(userId)) throw Object.assign(Error('Only the project owner can archive or restore branch workspaces'), { status: 403 })
        }
        if (!withExclusiveWrite || !withPreparedWrite) throw Object.assign(Error('Workspace write fencing is required'), { status: 503 })
        const result = await changeWorkspaceLifecycle({ ...command,
          authorize, lock: c.withLock,
          exclusive: async (id, action) => withPreparedWrite(id, await workspaceEpochAdapter(id).read(), action),
          epoch: workspaceEpochAdapter, flush: id => DocumentUpdaterHandler.promises.flushProjectToMongo(id),
          read: async id => { const p = (await children()).find(p => String(p._id) === id); return p && { workspaceId: id, ...p.gitWorkspace } },
          save: async (id, before, after) => {
            const changed = (await Project.updateOne({ _id: id, 'gitWorkspace.logicalProjectId': c.logicalProjectId, 'gitWorkspace.state': before }, { $set: { 'gitWorkspace.state': after } })).modifiedCount === 1
            if (changed && after === 'archived') await workspaceEvents.emitToRoom(id, 'nativeGitWorkspaceArchived', { projectId: id, logicalProjectId: c.logicalProjectId })
            return changed
          },
          blocked: async id => {
            const binding = await new WorkspaceStore(Path.join(c.root, 'workspace-bindings', id)).read()
            if (binding.pending || binding.mutationTaskId) return true
            for (const folder of ['collaboration-tasks', 'shell-draft-tasks', `session-recovery/${id}/tasks`]) {
              const tasks = await new CollaborationTaskStore(Path.join(c.root, folder)).list()
              if (tasks.some(t => (!t.workspaceId || t.workspaceId === id) && !['resolved', 'cancelled', 'superseded', 'applied', 'discarded', 'complete'].includes(t.state))) return true
            }
            return false
          },
        })
        return { result }
      }
      if (['autoSyncSchedule', 'configureAutoSyncSchedule', 'reconcileAutoSync'].includes(command.command)) {
        const service = autoSync(c, projectId, userId)
        if (command.command === 'autoSyncSchedule') return { result: { ...await service.status(), schedulerAvailable: Settings.nativeGit?.autoSyncScheduler === true } }
        if (command.command === 'reconcileAutoSync') return { result: await service.reconcile(command.revision, command.retryPush) }
        if (command.enabled && Settings.nativeGit?.autoSyncScheduler !== true) throw Object.assign(Error('Automatic sync is not enabled on this server'), { status: 503 })
        return { result: await service.configure(command) }
      }
      if (['autoCommitSchedule', 'configureAutoCommitSchedule', 'autoCommitRecoveryPreview', 'autoCommitRecover'].includes(command.command)) {
        return { result: await autoCommitController(c, projectId, userId).execute(command) }
      }
      if (['webhookStatus', 'configureWebhook'].includes(command.command)) {
        return { result: await c.workspace.readHistory(async repo => {
          const current = await Project.findById(c.logicalProjectId).select('owner_ref').lean().exec()
          if (String(current?.owner_ref) !== userId) throw Object.assign(Error('Only the project owner can configure webhook notifications.'), { status: 403 })
          const store = new CollaborationTaskStore(Path.join(c.root, 'webhook'))
          if (command.command === 'webhookStatus') return publicWebhook(await readWebhook(store))
          requireRepositoryWrite(await readAccessPolicy(c.root, userId))
          if (command.enabled && Settings.nativeGit?.discoveryScheduler !== true) throw Object.assign(Error('Background checks are unavailable.'), { status: 503 })
          return configureWebhook({ store, schedules: new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'schedule')),
            ownerId: userId, projectId: c.logicalProjectId, command, remoteUrl: remote => repo.remoteUrl(remote),
            encryptor: credentialEncryptor || createCredentialEncryptor(Settings.nativeGit?.credentialKey) })
        }) }
      }
      if (['discoverySchedule', 'configureDiscoverySchedule'].includes(command.command)) {
        const authorize = async actor => {
          const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
          if (String(access.getOwnerId()) !== String(actor)) throw Object.assign(Error('Only the project owner can configure remote discovery'), { status: 403 })
        }
        const store = new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'schedule'))
        if (command.command === 'discoverySchedule') {
          await authorize(userId)
          return { result: await c.withLock(async () => {
            const value = await readDiscoverySchedule(store)
            await authorize(userId)
            return { ...publicDiscoverySchedule(value), schedulerAvailable: Settings.nativeGit?.discoveryScheduler === true }
          }) }
        }
        requireRepositoryWrite(policy)
        if (command.enabled && Settings.nativeGit?.discoveryScheduler !== true) throw Object.assign(Error('Background discovery is not enabled on this server'), { status: 503 })
        return { result: await configureDiscoverySchedule({ store, withLock: fn => c.workspace.readHistory(fn),
          authorize, remoteUrl: (repo, remote) => repo.remoteUrl(remote), ownerId: userId, command }) }
      }
      if (command.command === 'remoteDiscoveryList') {
        const authorize = async () => {
          const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
          if (String(access.getOwnerId()) !== String(userId) &&
              !access.invitedMemberIds().some(id => String(id) === String(userId))) {
            throw Object.assign(new Error('Project membership was revoked'), { status: 403 })
          }
        }
        return { result: await listRemoteDiscoveries({
          store: new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'tasks')),
          withLock: c.withLock, authorize,
        }) }
      }
      if (['sessionRecover', 'sessionRecoveryList'].includes(command.command)) {
        const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
        return runSessionRecoveryCommand({ c, projectId: identity(projectId), userId: identity(userId),
          ownerId: String(access.getOwnerId()), command, policy, withExclusiveWrite })
      }
      if (c.isolated && command.command === 'checkout') {
        const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
        if (!access.invitedMemberIds().some(id => String(id) === String(userId)) && String(access.getOwnerId()) !== String(userId)) {
          throw Object.assign(new Error('Branch workspaces require named project membership'), { status: 403 })
        }
        requireRepositoryWrite(policy)
        if (!withExclusiveWrite) throw Object.assign(new Error('Workspace import requires exclusive document writes'), { status: 503 })
        await checkWriteIntegration?.()
        // Mongoose autoIndex is disabled in this installation. Establish the
        // allocation constraint before the first internal record is written.
        await Project.collection.createIndex(
          { 'gitWorkspace.logicalProjectId': 1, 'gitWorkspace.branch': 1 },
          { unique: true, partialFilterExpression: { 'gitWorkspace.logicalProjectId': { $exists: true } } }
        )
        const destination = await enterBranchWorkspace(c, command.name, {
          find: (parent, branch) => Project.findOne({ 'gitWorkspace.logicalProjectId': parent, 'gitWorkspace.branch': branch }).lean().exec(),
          create: async (parent, id, branch, origin) => {
            await Project.updateOne({ _id: parent }, { $set: { gitWorkspaceEnabled: true } })
            const parentProject = await Project.findById(parent).select('name owner_ref').lean().exec()
            const source = await Project.findById(projectId).select('compiler imageName spellCheckLanguage rootDoc_id').lean().exec()
            const entities = await ProjectEntityHandler.promises.getAllEntities(projectId)
            const sourceRootPath = entities.docs.find(item => String(item.doc._id) === String(source.rootDoc_id))?.path
            const sourceCommit = origin.commit
            return ProjectCreationHandler.promises.createBlankProject(String(parentProject.owner_ref), parentProject.name, {
              _id: id, compiler: source.compiler, imageName: source.imageName, spellCheckLanguage: source.spellCheckLanguage,
              gitWorkspace: { logicalProjectId: parent, branch, state: 'preparing', epoch: 1, sourceWorkspaceId: projectId, sourceRootPath, sourceCommit },
            }, { skipCreatingInTPDS: true })
          },
          ready: async id => {
            const created = await Project.findById(id).select('gitWorkspace').lean().exec()
            if (created.gitWorkspace.sourceRootPath) {
              const entities = await ProjectEntityHandler.promises.getAllEntities(id)
              const root = entities.docs.find(item => item.path === created.gitWorkspace.sourceRootPath)
              if (root) await ProjectEntityUpdateHandler.promises.setRootDoc(id, root.doc._id)
            }
            await ProjectRootDocManager.promises.ensureRootDocumentIsSet(id)
            // A preparing workspace is not joinable. Bootstrap admission before
            // publishing ready, so its first user never opens a legacy session.
            const parent = await Project.findById(c.logicalProjectId)
              .select('gitWorkspaceFenceEnabled gitWorkspacePrepareEnabled').lean().exec()
            if (parent?.gitWorkspaceFenceEnabled && parent.gitWorkspacePrepareEnabled) {
              await withExclusiveWrite(id, async assertActive => {
                await assertActive()
                const updated = await Project.updateOne({ _id: id, 'gitWorkspace.state': 'preparing' },
                  { $set: { gitWorkspaceFenceEnabled: true, gitWorkspacePrepareEnabled: true } })
                if (updated.matchedCount !== 1) throw Object.assign(new Error('Workspace activation state changed'), { status: 409 })
                const epoch = await workspaceEpochAdapter(id).hydrate()
                await WorkspacePrepareGate.createWorkspacePrepareGate(RedisWrapper.client('documentupdater')).initialize(id, epoch)
                await assertActive()
              })
            }
            await Project.updateOne({ _id: id, 'gitWorkspace.state': 'preparing' }, { $set: { 'gitWorkspace.state': 'ready' } })
          },
          context: id => context(id, userId),
        })
        return { workspaceNavigation: destination }
      }
      if (command.command.startsWith('shellDraft')) {
        if (!c.isolated || !c.epoch) throw Object.assign(new Error('Shell drafts require a fenced branch workspace'), { status: 409 })
        const drafts = new ShellDraftService({ root: Path.join(c.root, 'drafts'),
          store: new CollaborationTaskStore(Path.join(c.root, 'shell-draft-tasks')),
          project: c.project, withLock: c.withLock, authorize: c.assertAccess,
          readEpoch: () => c.epoch.read(), logicalProjectId: c.logicalProjectId,
          workspaceId: identity(projectId), actorId: identity(userId), readPosition: async () => { const position = await readGitPresencePosition({workspace:c.workspace,epoch:c.epoch,logicalProjectId:c.logicalProjectId,workspaceId:identity(projectId),userId:identity(userId)});return {branch:position.branch,head:position.head,dirty:position.dirty} }, readPermissionMode: async () => (await readAccessPolicy(c.root, userId)).mode, terminal: shellDraftTerminal(terminalRequest) })
        if (['shellDraftApply', 'shellDraftRecover', 'shellDraftRecoveryPreview'].includes(command.command)) {
          if (!withPreparedWrite || !c.collaboration.apply) throw Object.assign(new Error('Prepared workspace transactions are required for shell application and recovery'), { status: 409 })
          const options = { drafts, workspaceStore: c.store }
          if (command.command === 'shellDraftRecoveryPreview') return { result: await new ShellRecoveryService(options).preview(command.id) }
          requireRepositoryWrite(policy)
          const result = command.command === 'shellDraftApply'
            ? await new ShellApplicationService(options).apply(command.id, command)
            : await new ShellRecoveryService(options).recover(command.id, command)
          return { result: publicShellDraft(result) }
        }
        // Startup is opt-in after this deployment passes terminal/application acceptance.
        const result = await executeShellDraftCommand({ drafts, command, policy,
          startEnabled: Settings.nativeGit?.shellDrafts === true && !!withPreparedWrite && c.collaboration.apply === true })
        if (Array.isArray(result) || result?.kind === 'shell-draft') {
          const owner = await User.findById(userId).select('first_name last_name').lean().exec()
          const ownerDisplayName = [owner?.first_name, owner?.last_name].filter(Boolean).join(' ').slice(0, 200) || 'Collaborator'
          return { result: Array.isArray(result) ? result.map(task => ({ ...task, ownerDisplayName })) : { ...result, ownerDisplayName } }
        }
        return { result }
      }
      if (c.isolated && command.command === 'pull') {
        const authorize = async () => {
          await c.assertAccess()
          const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
          if (String(access.getOwnerId()) !== String(userId)) throw Object.assign(Error('Only the project owner can fetch remote updates'), { status: 403 })
          requireRepositoryWrite(await readAccessPolicy(c.root, userId))
        }
        const drafts = new MergeDraftService({ workspace: c.workspace, repository: c.repository,
          store: new CollaborationTaskStore(Path.join(c.root, 'collaboration-tasks')),
          logicalProjectId: c.logicalProjectId, workspaceId: identity(projectId), actorId: identity(userId),
          authorize, readEpoch: c.epoch ? () => c.epoch.read() : undefined, author: await author(userId) })
        const result = await prepareReviewedPull({ command, authorize,
          discover: request => c.workspace.readHistory(repo => discoverRemote({ repo,
            store: new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'tasks')),
            credentials: c.credentials, userId, authorize, ...request })),
          prepare: request => drafts.prepare(request) })
        return { result: publicMergeTask(result), reviewRequired: true, collaboration: c.collaboration }
      }
      if (command.command.startsWith('mergeDraft')) {
        if (!c.isolated) throw Object.assign(new Error('Merge drafts require a branch workspace'), { status: 409 })
        const readOnly = ['mergeDraftList', 'mergeDraftGet', 'mergeDraftReview', 'mergeDraftConflict', 'mergeDraftRecoveryPreview'].includes(command.command)
        if (!readOnly) requireRepositoryWrite(policy)
        const drafts = new MergeDraftService({ workspace: c.workspace, repository: c.repository,
          store: new CollaborationTaskStore(Path.join(c.root, 'collaboration-tasks')),
          logicalProjectId: c.logicalProjectId, workspaceId: identity(projectId), actorId: identity(userId), authorize: c.assertAccess, readEpoch: c.epoch ? () => c.epoch.read() : undefined,
          author: command.command === 'mergeDraftPrepare' ? await author(userId) : undefined })
        if (['mergeDraftApply', 'mergeDraftRecover', 'mergeDraftRecoveryPreview'].includes(command.command)) {
          if (!c.epoch || !withPreparedWrite) throw Object.assign(new Error('Prepared workspace transactions must be enabled before merge application or recovery'), { status: 409 })
          const epoch = { readEpoch: () => c.epoch.read(), advanceEpoch: expected => c.epoch.advance(expected) }
          if (command.command === 'mergeDraftApply') {
            const application = new MergeApplicationService({ drafts, ...epoch, author: await author(userId) })
            return { result: publicMergeTask(await application.apply(command.id, command)) }
          }
          const recovery = new MergeRecoveryService({ drafts, ...epoch })
          if (command.command === 'mergeDraftRecoveryPreview') return { result: await recovery.preview(command.id) }
          return { result: publicMergeTask(await recovery.recover(command.id, command)) }
        }
        switch (command.command) {
          case 'mergeDraftList': return { result: c.epoch ? await mergeValidationRuntime(c, drafts, projectId).list() : await drafts.list() }
          case 'mergeDraftCompile': {
            if (!c.collaboration.apply || !c.epoch) throw Object.assign(Error('Prepared branch workspace required for validation'), { status: 409 })
            return { result: await mergeValidationRuntime(c, drafts, projectId).run(command.id, command.revision) }
          }
          case 'mergeDraftReview': return { result: await drafts.review(command.id, command.path) }
          case 'mergeDraftGet': return { result: publicMergeTask(await drafts.get(command.id)) }
          case 'mergeDraftConflict': return { result: await drafts.conflict(command.id, command.path) }
          case 'mergeDraftPrepare': return { result: publicMergeTask(await drafts.prepare(command)) }
          case 'mergeDraftClaim': return { result: publicMergeTask(await drafts.claim(command.id, command.revision, command.sessionId)) }
          case 'mergeDraftResolve': return { result: publicMergeTask(await drafts.resolve(command.id, command)) }
          case 'mergeDraftValidate': return { result: publicMergeTask(await drafts.validateTarget(command.id)) }
          case 'mergeDraftCancel': return { result: publicMergeTask(await drafts.cancel(command.id, command)) }
          default: throw Object.assign(new Error('Unknown merge draft command'), { status: 400 })
        }
      }
      // Keep live-document mutations closed until the new transaction and
      // offline-reconnect acceptance gates pass. Ordinary OT editing is separate.
      if (c.isolated && new Set(['checkoutDetached','renameBranch','deleteBranch','connect','terminalOpen',
        'cleanWorktree','undoCommit','merge','rebase','cherryPick','revert','reset','continueOperation','resolveConflict','discard','discardAll',
        'stash','applyStash','resumeTransfer','cancelTransfer','pull','sync']).has(command.command)) {
        throw Object.assign(new Error('This operation requires the branch-workspace anti-overwrite acceptance gate.'), { status: 409 })
      }
      if (command.command === 'accessPolicy') return { result: policy }
      if (command.command === 'setAccessPolicy') {
        if (command.mode === 'extended') throw Object.assign(new Error('Approved directories mode has been removed.'), {status:403})
        return c.withLock(async () => {
          // Serialize with draft start/input and revoke every branch session of
          // this owner before recording a policy that promises a closed shell.
          await c.assertAccess()
          const currentPolicy = await readAccessPolicy(c.root, userId)
          if (manualTerminalMode(currentPolicy.mode) !== manualTerminalMode(command.mode)) await terminalRequest({project:c.logicalProjectId,user:String(userId),action:'revoke'})
          if (manualTerminalMode(currentPolicy.mode) !== manualTerminalMode(command.mode) && c.logicalProjectId !== String(projectId)) await terminalRequest({project:String(projectId),user:String(userId),action:'revoke'})
          await c.assertAccess()
          return { result: await saveAccessPolicy(c.root,userId,{ mode:command.mode,directories:[] }) }
        })
      }
      const readCommands = new Set(['graphSettings','saveGraphSettings','terminalApprove','terminalOpen','terminalPoll','terminalInput','terminalRun','terminalResize','terminalClose','terminalInfo','terminalRead','gitOutput','ignoredFiles','generateMessage','commitPreview','amendDetails','diff','graph','show','commitDiff','commitDetails','commitFiles','commitFileDiff','commitFilePreview','fileDiff','filePreview','fileHunks','fileHistory','conflictDetails','blame','branches','worktrees','tags','remotes','stashes','stashDiff','discardDetails','discardAllDetails','undoDetails','resetDetails'])
      if (!readCommands.has(command.command)) requireRepositoryWrite(policy)
      if (command.command === 'discoverRemote') {
        const authorize = async () => {
          const access = await CollaboratorsGetter.promises.getProjectAccess(c.logicalProjectId)
          if (String(access.getOwnerId()) !== userId) throw Object.assign(new Error('Only the project owner can manage remote discovery'), { status: 403 })
        }
        const store = new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'tasks'))
        const result = await c.workspace.readHistory(repo => discoverRemote({ repo, store, credentials: c.credentials,
          remote: command.remote, operationId: command.operationId, userId, authorize }))
        return { result: publicDiscoveryTask(result) }
      }
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
        const snapshot = await c.workspace.inspect()
      if (snapshot.mutationTaskId) {
        try {
          const task = await new CollaborationTaskStore(Path.join(c.root, 'shell-draft-tasks')).read(snapshot.mutationTaskId)
          if (task.kind === 'shell-draft' && task.logicalProjectId === c.logicalProjectId && task.workspaceId === identity(projectId)) {
            snapshot.mutationKind = 'shell'
            snapshot.canRecoverMutation = task.createdBy === identity(userId)
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      if (snapshot.mutationTaskId && !snapshot.mutationKind) {
        try {
          const task = await new CollaborationTaskStore(Path.join(c.root, 'auto-commit', identity(projectId), 'tasks')).read(snapshot.mutationTaskId)
          if (task.kind === 'automatic-commit' && task.workspaceId === identity(projectId)) {
            snapshot.mutationKind = 'auto-commit'
            snapshot.canRecoverMutation = task.ownerId === identity(userId)
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      return { connected: true, collaboration: c.collaboration, ...await withAutoCommitIndicators(c, projectId, snapshot) }
      }
      if (command.command === 'generateMessage') {
        const result = await generateCommitMessage(c.workspace, ({ systemPrompt, userMessage }) =>
          WritingAssistLLMProvider.check({ provider: 'agent', timeout: 60000 }, '', systemPrompt, [], userMessage))
        return { result, ...(await withAutoCommitIndicators(c, projectId, await c.workspace.inspect())) }
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
        return { result: result ?? null, ...(await withAutoCommitIndicators(c, projectId, await c.workspace.inspect())) }
      }
      if (['commitDetails', 'commitDiff', 'commitFiles', 'commitFileDiff', 'commitFilePreview'].includes(command.command)) {
        return { result: await executeGitCommand(c.workspace, command) }
      }
      const needsAuthor = ['commit', 'merge', 'rebase', 'cherryPick', 'revert', 'continueOperation'].includes(command.command)
      const preferences = needsAuthor ? await readGraphSettings(c.root, userId) : null
      const commitIdentity = preferences?.userName ? { name: preferences.userName, email: preferences.userEmail } : needsAuthor ? await author(userId) : undefined
      const result = await executeGitCommand(c.workspace, command, commitIdentity)
      return { result: result ?? null, ...(await withAutoCommitIndicators(c, projectId, await c.workspace.inspect())) }
    },
  }
}

export const nativeGitRuntime = createNativeGitRuntime({
  withExclusiveWrite: projectWriteIntegrationEnabled() ? withExclusiveProjectWrite : undefined,
  withPreparedWrite: projectWriteIntegrationEnabled() ? withPreparedProjectWrite : undefined,
  checkWriteIntegration: checkProjectWriteIntegration,
})
