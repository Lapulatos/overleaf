// @ts-check

import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import WritingAssistController from './WritingAssistController.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'

const writingAssistCheckLimiter = new RateLimiter('writing-assist-check', {
  points: 30,
  duration: 60,
})

function apply(webRouter, privateApiRouter) {
  const requireLogin = AuthenticationController.requireLogin()

  privateApiRouter.post(
    '/writing-assist/check',
    requireLogin,
    RateLimiterMiddleware.rateLimit(writingAssistCheckLimiter),
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
