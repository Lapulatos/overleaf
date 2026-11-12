import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import { AgentError } from './WritingAssistAgentService.mjs'
import {
  agentService,
  agentStore,
  readWorkspaceIdentity,
  snapshot,
} from './WritingAssistAgentController.mjs'
import { createLiteratureService } from './WritingAssistLiteratureService.mjs'
import { createCitationService } from './WritingAssistCitationService.mjs'
const canWrite = (userId, projectId) =>
  AuthorizationManager.promises.canUserWriteProjectContent(userId, projectId)
const literature = createLiteratureService({ canWrite })
const citations = createCitationService({
  readWorkspaceIdentity,
  canWrite,
  literature,
  snapshot,
  store: agentStore,
  tasks: agentService,
})
const params = z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i) })
const schemas = {
  search: z.object({
    params,
    query: z.object({ q: z.string().trim().min(1).max(300) }),
  }),
  destinations: z.object({ params }),
  preview: z.object({
    params,
    body: z.object({
      doi: z.string().min(1).max(256).optional(),
      dois: z.array(z.string().min(1).max(256)).min(1).max(50).optional(),
      destination: z.object({
        docId: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
        newName: z.string().max(124).optional(),
      }),
    }).refine(body => Boolean(body.doi) !== Boolean(body.dois), 'Choose a single reference or a batch'),
  }),
}
function handler(action) {
  return expressify(async (req, res) => {
    const parsed = parseReq(req, schemas[action])
    const userId = SessionManager.getLoggedInUserId(req.session).toString()
    const { projectId } = parsed.params
    try {
      const result =
        action === 'search'
          ? await literature.search(userId, projectId, parsed.query.q)
          : action === 'destinations'
            ? await citations.destinations(userId, projectId)
            : await citations.preview(
                userId,
                projectId,
                parsed.body.dois || parsed.body.doi,
                parsed.body.destination
              )
      res.status(action === 'preview' ? 201 : 200).json(result)
    } catch (error) {
      if (!(error instanceof AgentError)) throw error
      res.status(error.status).json({ error: error.message })
    }
  })
}
export default {
  search: handler('search'),
  destinations: handler('destinations'),
  preview: handler('preview'),
}
