import settings from '@overleaf/settings'
import { NativeCommentDeletion } from '../../models/NativeCommentDeletion.mjs'
import { fetchNothing } from '@overleaf/fetch-utils'
import { expressify } from '@overleaf/promise-utils'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.mjs'
import PermissionsController from '../Authorization/PermissionsController.mjs'
import TokenAccessHandler from '../TokenAccess/TokenAccessHandler.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import ChatApiHandler from './ChatApiHandler.mjs'
import ChatManager from './ChatManager.mjs'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import { loadNativeCommentRanges } from './NativeCommentRanges.mjs'
import {
  CommentError,
  createNativeCommentsService,
} from './NativeCommentsService.mjs'

const service = createNativeCommentsService({
  roleFor: (ctx) =>
    AuthorizationManager.promises.getPrivilegeLevelForProject(
      ctx.userId,
      ctx.projectId,
      ctx.token,
      { ignorePublicAccess: true }
    ),
  chat: ChatApiHandler.promises,
  decorate: (threads) =>
    ChatManager.promises.injectUserInfoIntoThreads(threads),
  emit: (...args) => EditorRealTimeController.emitToRoom(...args),
  deletions: {
    get: (ctx) =>
      NativeCommentDeletion.findById(`${ctx.projectId}:${ctx.threadId}`)
        .lean()
        .exec(),
    begin: (ctx, authorId) =>
      NativeCommentDeletion.findOneAndUpdate(
        { _id: `${ctx.projectId}:${ctx.threadId}` },
        {
          $setOnInsert: {
            projectId: ctx.projectId,
            threadId: ctx.threadId,
            docId: ctx.docId,
            authorId,
            completed: false,
          },
        },
        { upsert: true, new: true }
      )
        .lean()
        .exec(),
    complete: (ctx) =>
      NativeCommentDeletion.updateOne(
        { _id: `${ctx.projectId}:${ctx.threadId}` },
        { $set: { completed: true } }
      ).exec(),
  },
  range: {
    list: projectId =>
      loadNativeCommentRanges(projectId, {
        stored: DocstoreManager.promises.getAllRanges,
        live: DocumentUpdaterHandler.promises.getProjectRanges,
        docIds: async id => {
          const { docs } = await ProjectEntityHandler.promises.getAllEntities(id)
          return docs.map(({ doc }) => String(doc._id))
        },
      }),
    assertDocument: (ctx) =>
      ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
        ctx.projectId,
        ctx.docId
      ),
    async assertAnchor(ctx) {
      await ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
        ctx.projectId,
        ctx.docId
      )
      await DocumentUpdaterHandler.promises.getComment(
        ctx.projectId,
        ctx.docId,
        ctx.threadId
      )
    },
    async change(ctx, action) {
      const suffix = action === 'delete' ? '' : `/${action}`
      await fetchNothing(
        `${settings.apis.documentupdater.url}/project/${ctx.projectId}/doc/${ctx.docId}/comment/${ctx.threadId}${suffix}`,
        {
          method: action === 'delete' ? 'DELETE' : 'POST',
          json: { user_id: ctx.userId },
          signal: AbortSignal.timeout(30000),
        }
      )
    },
  },
})

function handle(action) {
  return expressify(async (req, res) => {
    const ctx = {
      projectId: req.params.project_id,
      threadId: req.params.thread_id,
      docId: req.params.doc_id,
      messageId: req.params.message_id,
      userId: SessionManager.getLoggedInUserId(req.session),
      token: TokenAccessHandler.getRequestToken(req, req.params.project_id),
    }
    try {
      if (action === 'ranges') return res.json(await service.listRanges(ctx))
      if (action === 'list') return res.json(await service.list(ctx))
      if (action === 'add') await service.add(ctx, req.body.content)
      else if (action === 'edit') await service.edit(ctx, req.body.content)
      else if (action === 'remove' || action === 'removeOwn')
        await service.removeMessage(ctx, action === 'removeOwn')
      else await service.changeThread(ctx, action)
      res.sendStatus(204)
    } catch (error) {
      if (error instanceof CommentError)
        return res.status(error.status).json({ error: error.message })
      throw error
    }
  })
}

export function applyNativeCommentRoutes(router, rateLimit) {
  const guards = [
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    PermissionsController.requirePermission('chat'),
  ]
  const thread = '/project/:project_id/thread/:thread_id'
  const anchored = '/project/:project_id/doc/:doc_id/thread/:thread_id'
  router.get('/project/:project_id/threads', ...guards, handle('list'))
  router.get('/project/:project_id/ranges', ...guards, handle('ranges'))
  router.post(`${thread}/messages`, ...guards, rateLimit, handle('add'))
  router.post(
    `${thread}/messages/:message_id/edit`,
    ...guards,
    rateLimit,
    handle('edit')
  )
  router.delete(
    `${thread}/messages/:message_id`,
    ...guards,
    rateLimit,
    handle('remove')
  )
  router.delete(
    `${thread}/own-messages/:message_id`,
    ...guards,
    rateLimit,
    handle('removeOwn')
  )
  router.post(`${anchored}/resolve`, ...guards, rateLimit, handle('resolve'))
  router.post(`${anchored}/reopen`, ...guards, rateLimit, handle('reopen'))
  router.delete(anchored, ...guards, rateLimit, handle('delete'))
}
