import settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import { WritingAssistLibrary } from '../../models/WritingAssistLibrary.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import { AgentError } from './WritingAssistAgentService.mjs'
import { createZoteroClient } from './WritingAssistZoteroClient.mjs'
import { createZoteroService } from './WritingAssistZoteroService.mjs'
import { createCitationService } from './WritingAssistCitationService.mjs'
import {
  agentService,
  agentStore,
  readWorkspaceIdentity,
  snapshot,
} from './WritingAssistAgentController.mjs'

const canWrite = (userId, projectId) =>
  AuthorizationManager.promises.canUserWriteProjectContent(userId, projectId)
const zotero = createZoteroService({
  canWrite,
  client: createZoteroClient(),
  encryptionKey: () => settings.writingAssist?.zoteroEncryptionKey,
  store: {
    get: (userId) => WritingAssistLibrary.findById(userId).lean().exec(),
    set: (userId, value) =>
      WritingAssistLibrary.updateOne(
        { _id: userId },
        { $set: value },
        { upsert: true }
      ).exec(),
    remove: (userId) => WritingAssistLibrary.deleteOne({ _id: userId }).exec(),
  },
})
const citations = createCitationService({
  readWorkspaceIdentity,
  canWrite,
  literature: zotero,
  snapshot,
  store: agentStore,
  tasks: agentService,
})
const params = z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i) })
const schemas = {
  status: z.object({ params }),
  connect: z.object({ params }),
  disconnect: z.object({ params }),
  search: z.object({
    params,
    query: z.object({
      q: z.string().max(300).default(''),
      start: z.coerce.number().int().min(0).max(100000).default(0),
    }),
  }),
  preview: z.object({
    params,
    body: z.object({
      itemKey: z.string().regex(/^[A-Z0-9]{8}$/).optional(),
      itemKeys: z.array(z.string().regex(/^[A-Z0-9]{8}$/)).min(1).max(50).optional(),
      destination: z.object({
        docId: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
        newName: z.string().max(124).optional(),
      }),
    }).refine(body => Boolean(body.itemKey) !== Boolean(body.itemKeys), 'Choose a single reference or a batch'),
  }),
}
function handler(action) {
  return expressify(async (req, res) => {
    const parsed = parseReq(req, schemas[action])
    const { projectId } = parsed.params
    const userId = SessionManager.getLoggedInUserId(req.session).toString()
    try {
      let result
      if (action === 'connect')
        result = await zotero.connect(userId, projectId, req.body)
      else if (action === 'disconnect')
        result = await zotero.disconnect(userId, projectId)
      else if (action === 'search')
        result = await zotero.search(
          userId,
          projectId,
          parsed.query.q,
          parsed.query.start
        )
      else if (action === 'preview')
        result = await citations.preview(
          userId,
          projectId,
          parsed.body.itemKeys || parsed.body.itemKey,
          parsed.body.destination
        )
      else result = await zotero.status(userId, projectId)
      res.status(action === 'preview' ? 201 : 200).json(result)
    } catch (error) {
      if (!(error instanceof AgentError)) throw error
      res.status(error.status).json({ error: error.message })
    }
  })
}
export default {
  status: handler('status'),
  connect: handler('connect'),
  disconnect: handler('disconnect'),
  search: handler('search'),
  preview: handler('preview'),
}
