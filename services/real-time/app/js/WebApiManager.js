import { callbackifyMultiResult } from '@overleaf/promise-utils'
import OError from '@overleaf/o-error'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import Errors from './Errors.js'
import Path from 'node:path'
import { fetchJson, RequestFailedError } from '@overleaf/fetch-utils'

const {
  CodedError,
  CorruptedJoinProjectResponseError,
  NotAuthorizedError,
  WebApiRequestFailedError,
} = Errors

async function joinProject(projectId, user) {
  const userId = user._id
  logger.debug({ projectId, userId }, 'sending join project request to web')
  const url = new URL(settings.apis.web.url)
  url.pathname = Path.posix.join('project', projectId, 'join')
  let data
  try {
    data = await fetchJson(url, {
      method: 'POST',
      basicAuth: {
        user: settings.apis.web.user,
        password: settings.apis.web.pass,
      },
      json: {
        userId,
        anonymousAccessToken: user.anonymousAccessToken,
      },
    })
  } catch (error) {
    if (error instanceof RequestFailedError) {
      if (error.response.status === 429) {
        throw new CodedError(
          'rate-limit hit when joining project',
          'TooManyRequests'
        )
      } else if (error.response.status === 403) {
        throw new NotAuthorizedError()
      } else if (error.response.status === 404) {
        throw new CodedError('project not found', 'ProjectNotFound')
      }
      throw new WebApiRequestFailedError(error.response.status)
    }
    throw OError.tag(error, 'join project request failed')
  }
  if (!(data && data.project)) {
    throw new CorruptedJoinProjectResponseError()
  }
  const userMetadata = {
    isRestrictedUser: data.isRestrictedUser,
    isTokenMember: data.isTokenMember,
    isInvitedMember: data.isInvitedMember,
  }
  return {
    project: data.project,
    privilegeLevel: data.privilegeLevel,
    userMetadata,
  }
}

async function gitPresencePosition({ workspaceId, userId, viewedCommit }) {
  const url = new URL(settings.apis.web.url)
  url.pathname = Path.posix.join('project', workspaceId, 'native-git', 'presence-position')
  try {
    return await fetchJson(url, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      basicAuth: { user: settings.apis.web.user, password: settings.apis.web.pass },
      json: { userId, viewedCommit },
    })
  } catch (error) {
    if (error instanceof RequestFailedError) {
      throw Object.assign(new Error('Git collaboration position is unavailable'), { status: error.response.status })
    }
    throw error
  }
}

export default {
  joinProject: callbackifyMultiResult(joinProject, [
    'project',
    'privilegeLevel',
    'userMetadata',
  ]),
  promises: {
    joinProject,
    gitPresencePosition,
  },
}
