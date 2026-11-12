import Settings from '@overleaf/settings'
import RedisWrapper from '@overleaf/redis-wrapper'
import GitPresenceStore from '@overleaf/redis-wrapper/GitPresenceStore.js'
import { createGitPresenceSession } from './GitPresenceSession.js'
import WebApiManager from './WebApiManager.js'
import RoomManager from './RoomManager.js'
import WebsocketLoadBalancer from './WebsocketLoadBalancer.js'

let store
export function gitPresenceForClient(client) {
  const context = client.ol_context
  if (process.env.OVERLEAF_NATIVE_GIT_ENABLED !== 'true' || client.disconnected ||
      !context?.user_id || !context.project_id || !Number.isSafeInteger(context.workspace_epoch) ||
      context.is_token_member || context.is_restricted_user) {
    throw Object.assign(new Error('Named workspace membership is required for Git presence'), { status: 403 })
  }
  store ||= GitPresenceStore.createGitPresenceStore(RedisWrapper.createClient(Settings.redis.documentupdater))
  return createGitPresenceSession({ sessionId: client.id, userId: String(context.user_id), workspaceId: String(context.project_id),
    resolvePosition: async request => {
      const position = await WebApiManager.promises.gitPresencePosition(request)
      if (client.disconnected || client.ol_context !== context || position.epoch !== context.workspace_epoch) {
        throw Object.assign(new Error('Workspace session changed; reload before publishing position'), { status: 403 })
      }
      return position
    }, store,
    subscribe: project => new Promise((resolve, reject) => RoomManager.joinProject(client, `git-presence:${project}`, error => error ? reject(error) : resolve())),
    unsubscribe: project => RoomManager.leaveEntity(client, 'project', `git-presence:${project}`),
    publish: (project, snapshot) => WebsocketLoadBalancer.emitToRoom(`git-presence:${project}`, 'nativeGitPresenceChanged', snapshot),
  })
}
