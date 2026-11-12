import { applyRecoveryVaultRoutes } from './RecoveryVaultRouter.mjs'
import { startAutoCommitWorker } from './AutoCommitWorker.mjs'
import { startRemoteDiscoveryWorker } from './RemoteDiscoveryWorker.mjs'
import Settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import { createNativeGitHandlers } from './NativeGitHandlers.mjs'
import { nativeGitRuntime } from './NativeGitRuntime.mjs'
import { publishRepositoryChange } from './RepositoryEvents.mjs'
import logger from '@overleaf/logger'

let stopDiscoveryWorker, stopAutoCommitWorker, stopAutoSyncWorker

export default {
  apply(router) {
    applyRecoveryVaultRoutes(router)
    if (Settings.nativeGit?.enabled && Settings.nativeGit?.autoSyncScheduler && !stopAutoSyncWorker) {
      stopAutoSyncWorker = startAutoCommitWorker({
        root: Settings.nativeGit.storagePath || '/var/lib/overleaf/native-git', runtime: nativeGitRuntime,
        folder: 'auto-sync', command: 'autoSync', run: (workspace, project) => nativeGitRuntime.runScheduledAutoSync(workspace, project),
        notify: publishRepositoryChange,
        onError: (error, projectId) => logger.error({ err: error, projectId }, 'Automatic sync scheduling failed'),
      })
    }

    if (Settings.nativeGit?.enabled && Settings.nativeGit?.autoCommitScheduler && !stopAutoCommitWorker) {
      stopAutoCommitWorker = startAutoCommitWorker({
        root: Settings.nativeGit.storagePath || '/var/lib/overleaf/native-git', runtime: nativeGitRuntime,
        notify: publishRepositoryChange,
        onError: (error, projectId) => logger.error({ err: error, projectId }, 'Automatic commit scheduling failed'),
      })
    }
    if (Settings.nativeGit?.enabled && Settings.nativeGit?.discoveryScheduler && !stopDiscoveryWorker) {
      stopDiscoveryWorker = startRemoteDiscoveryWorker({
        root: Settings.nativeGit.storagePath || '/var/lib/overleaf/native-git', runtime: nativeGitRuntime,
        notify: publishRepositoryChange,
        onError: (error, projectId) => logger.error({ err: error, projectId }, 'Remote discovery scheduling failed'),
      })
    }
    const handlers = createNativeGitHandlers({ enabled: () => Settings.nativeGit?.enabled === true,
      userId: req => SessionManager.getLoggedInUserId(req.session),
      canRead: (user, project) => AuthorizationManager.promises.canUserReadProject(user, project),
      canWrite: (user, project) => AuthorizationManager.promises.canUserWriteProjectContent(user, project),
      runtime: nativeGitRuntime,
      notify: (project, command) => publishRepositoryChange(project, command).catch(error => {
        logger.error({ err: error, projectId: project }, 'Git graph invalidation failed')
      }) })
    const login = AuthenticationController.requireLogin()
    const base = '/project/:projectId/native-git'
    router.get(`${base}/backups/:backupId/download`, login, expressify(handlers.backup))
    router.get(base, login, expressify(handlers.status))
    router.post(`${base}/initialize`, login, expressify(handlers.initialize))
    router.post(`${base}/commands`, login, expressify(handlers.command))
  },
}
