import settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import { AgentError } from './WritingAssistAgentService.mjs'
import { withResponseCancellation } from './WritingAssistCancellation.mjs'
import { createSpeechProxy } from './WritingAssistSpeechService.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'

const speech = createSpeechProxy({
  canWrite: (user, project) =>
    AuthorizationManager.promises.canUserWriteProjectContent(user, project),
  configuration: () => settings.writingAssist || {},
})
const schema = z.object({
  params: z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i) }),
})
function handler(transcribe) {
  return expressify(async (req, res) => {
    const {
      params: { projectId },
    } = parseReq(req, schema)
    const userId = SessionManager.getLoggedInUserId(req.session).toString()
    try {
      const result = await withResponseCancellation(res, (signal) =>
        transcribe
          ? speech.transcribe(userId, projectId, req.body, signal)
          : speech.capabilities(userId, projectId, signal)
      )
      if (!res.destroyed) res.json(result)
    } catch (error) {
      if (res.destroyed) return
      if (!(error instanceof AgentError)) throw error
      res.status(error.status).json({ error: error.message })
    }
  })
}
export default { capabilities: handler(false), transcribe: handler(true) }
