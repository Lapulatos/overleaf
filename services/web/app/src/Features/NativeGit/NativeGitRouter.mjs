import Settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import { createNativeGitHandlers } from './NativeGitHandlers.mjs'
import { nativeGitRuntime } from './NativeGitRuntime.mjs'

export default {
  apply(router) {
    const handlers = createNativeGitHandlers({ enabled: () => Settings.nativeGit?.enabled === true,
      userId: req => SessionManager.getLoggedInUserId(req.session),
      canWrite: (user, project) => AuthorizationManager.promises.canUserWriteProjectContent(user, project),
      runtime: nativeGitRuntime })
    const login = AuthenticationController.requireLogin()
    const base = '/project/:projectId/native-git'
    router.get(base, login, expressify(handlers.status))
    router.post(`${base}/initialize`, login, expressify(handlers.initialize))
    router.post(`${base}/commands`, login, expressify(handlers.command))
  },
}
