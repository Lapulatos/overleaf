// @ts-check

import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import WritingAssistController from './WritingAssistController.mjs'
import RateLimiter from '../../infrastructure/RateLimiter.mjs'

function apply(webRouter, privateApiRouter) {
  const requireLogin = AuthenticationController.requireLogin()

  privateApiRouter.post(
    '/writing-assist/check',
    requireLogin,
    RateLimiter.rateLimit('writing-assist-check', { maxRequests: 30, timeInterval: 60 }),
    WritingAssistController.check
  )

  privateApiRouter.get(
    '/writing-assist/config',
    requireLogin,
    WritingAssistController.getConfig
  )

  privateApiRouter.put(
    '/writing-assist/config',
    requireLogin,
    WritingAssistController.putConfig
  )
}

export default { apply }
