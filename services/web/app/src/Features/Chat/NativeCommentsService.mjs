// Project authorization precedes every storage read and mutation.
export class CommentError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function createNativeCommentsService({
  roleFor,
  chat,
  decorate,
  range,
  emit,
  deletions,
}) {
  function id(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
      throw new CommentError(400, 'Invalid comment identifier')
    }
    return value
  }
  function content(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 10000) {
      throw new CommentError(400, 'Comment must contain 1 to 10000 characters')
    }
    return value
  }
  async function access(ctx) {
    id(ctx.projectId)
    if (!ctx.userId) throw new CommentError(401, 'Login required')
    const role = await roleFor(ctx)
    if (!['owner', 'readAndWrite', 'review', 'readOnly'].includes(role)) {
      throw new CommentError(403, 'Project access denied')
    }
    return role
  }
  async function manager(ctx, role) {
    if (role === 'owner' || role === 'readAndWrite') return
    if (role === 'review') {
      const thread = await chat.getThread(ctx.projectId, ctx.threadId)
      if (String(thread.messages?.[0]?.user_id) === String(ctx.userId)) return
    }
    throw new CommentError(403, 'Comment management denied')
  }
  async function notDeleting(ctx) {
    if (await deletions.get(ctx))
      throw new CommentError(409, 'Comment thread is being deleted')
  }
  async function removeThread(ctx, role) {
    let receipt = await deletions.get(ctx)
    if (!receipt) {
      await manager(ctx, role)
      await range.assertAnchor(ctx)
      const thread = await chat.getThread(ctx.projectId, ctx.threadId)
      receipt = await deletions.begin(
        ctx,
        String(thread.messages?.[0]?.user_id || ctx.userId)
      )
    }
    if (receipt.docId !== ctx.docId)
      throw new CommentError(409, 'Comment belongs to another document')
    if (
      !['owner', 'readAndWrite'].includes(role) &&
      !(role === 'review' && receipt.authorId === String(ctx.userId))
    ) {
      throw new CommentError(403, 'Comment deletion denied')
    }
    if (!receipt.completed) {
      // Membership is checked again on retries; only a previously verified
      // receipt permits an already-removed anchor to be absent.
      await range.assertDocument(ctx)
      await range.change(ctx, 'delete')
      try {
        await chat.deleteThread(ctx.projectId, ctx.threadId)
      } catch (error) {
        if (error.response?.status !== 404) throw error
      }
      await deletions.complete(ctx)
    }
    emit(ctx.projectId, 'delete-thread', ctx.threadId)
  }
  return {
    async listRanges(ctx) {
      await access(ctx)
      return range.list(ctx.projectId)
    },
    async list(ctx) {
      await access(ctx)
      const threads = await chat.getThreads(ctx.projectId)
      await decorate(threads)
      return threads
    },
    async add(ctx, value) {
      await access(ctx)
      id(ctx.threadId)
      const text = content(value)
      await notDeleting(ctx)
      const message = await chat.sendComment(
        ctx.projectId,
        ctx.threadId,
        ctx.userId,
        text
      )
      await decorate({ thread: { messages: [message] } })
      emit(ctx.projectId, 'new-comment', ctx.threadId, message)
    },
    async edit(ctx, value) {
      await access(ctx)
      id(ctx.threadId)
      id(ctx.messageId)
      const text = content(value)
      await notDeleting(ctx)
      const message = await chat.getThreadMessage(
        ctx.projectId,
        ctx.threadId,
        ctx.messageId
      )
      if (String(message.user_id) !== String(ctx.userId))
        throw new CommentError(403, 'Only the author can edit a comment')
      await chat.editMessage(
        ctx.projectId,
        ctx.threadId,
        ctx.messageId,
        ctx.userId,
        text
      )
      emit(ctx.projectId, 'edit-message', ctx.threadId, ctx.messageId, text)
    },
    async removeMessage(ctx, ownOnly) {
      const role = await access(ctx)
      id(ctx.threadId)
      id(ctx.messageId)
      const message = await chat.getThreadMessage(
        ctx.projectId,
        ctx.threadId,
        ctx.messageId
      )
      const own = String(message.user_id) === String(ctx.userId)
      if ((ownOnly || !['owner', 'readAndWrite'].includes(role)) && !own)
        throw new CommentError(403, 'Comment deletion denied')
      if (!['owner', 'readAndWrite', 'review'].includes(role))
        throw new CommentError(403, 'Comment deletion denied')
      await chat.deleteMessage(ctx.projectId, ctx.threadId, ctx.messageId)
      emit(ctx.projectId, 'delete-message', ctx.threadId, ctx.messageId)
    },
    async changeThread(ctx, action) {
      const role = await access(ctx)
      id(ctx.threadId)
      id(ctx.docId)
      if (!['resolve', 'reopen', 'delete'].includes(action))
        throw new CommentError(400, 'Invalid comment action')
      if (action === 'delete') return removeThread(ctx, role)
      await notDeleting(ctx)
      await manager(ctx, role)
      // Verify document membership and the thread anchor before changing either store.
      await range.assertAnchor(ctx)
      await range.change(ctx, action)
      if (action === 'resolve')
        await chat.resolveThread(ctx.projectId, ctx.threadId, ctx.userId)
      if (action === 'reopen')
        await chat.reopenThread(ctx.projectId, ctx.threadId)
      if (action === 'resolve') {
        const decorated = {
          thread: {
            resolved: true,
            resolved_by_user_id: String(ctx.userId),
            messages: [],
          },
        }
        await decorate(decorated)
        emit(
          ctx.projectId,
          'resolve-thread',
          ctx.threadId,
          decorated.thread.resolved_by_user
        )
      } else
        emit(
          ctx.projectId,
          action === 'reopen' ? 'reopen-thread' : 'delete-thread',
          ctx.threadId
        )
    },
  }
}
