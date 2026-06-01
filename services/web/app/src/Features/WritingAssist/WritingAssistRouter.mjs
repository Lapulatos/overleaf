// @ts-check

import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import WritingAssistController from './WritingAssistController.mjs'

/** @param {any} webRouter */
function apply(webRouter) {
  const requireLogin = AuthenticationController.requireLogin()

  webRouter.post(
    '/writing-assist/check',
    requireLogin,
    WritingAssistController.check
  )

  webRouter.get(
    '/writing-assist/config',
    requireLogin,
    WritingAssistController.getConfig
  )

  webRouter.put(
    '/writing-assist/config',
    requireLogin,
    WritingAssistController.putConfig
  )

  // Dismiss notebook CRUD.
  webRouter.get(
    '/writing-assist/dismissals',
    requireLogin,
    WritingAssistController.listDismissals
  )

  webRouter.post(
    '/writing-assist/dismissals',
    requireLogin,
    WritingAssistController.addDismissal
  )

  webRouter.put(
    '/writing-assist/dismissals/:id',
    requireLogin,
    WritingAssistController.updateDismissal
  )

  webRouter.delete(
    '/writing-assist/dismissals/:id',
    requireLogin,
    WritingAssistController.deleteDismissal
  )
}

export default { apply }
