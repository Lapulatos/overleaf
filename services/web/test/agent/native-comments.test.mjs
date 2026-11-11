/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import { loadNativeCommentRanges } from '../../app/src/Features/Chat/NativeCommentRanges.mjs'
import assert from 'node:assert/strict'
import { createNativeCommentsService } from '../../app/src/Features/Chat/NativeCommentsService.mjs'
const ctx = {
  projectId: 'a'.repeat(24),
  userId: 'b'.repeat(24),
  threadId: 'c'.repeat(24),
  docId: 'd'.repeat(24),
  messageId: 'e'.repeat(24),
}
function fixture(role = 'owner', author = ctx.userId) {
  const calls = []
  const chat = new Proxy(
    {},
    {
      get: (target, name) =>
        target[name] ||
        (async (...args) => {
          calls.push([name, ...args])
          if (name === 'getThread') return { messages: [{ user_id: author }] }
          if (name === 'getThreadMessage' || name === 'sendComment')
            return { user_id: author, content: 'text' }
          if (name === 'getThreads') return {}
        }),
    }
  )
  const receipts = new Map()
  const deletions = {
    get: async (ctx) => receipts.get(ctx.threadId),
    begin: async (ctx, authorId) => {
      const receipt = { docId: ctx.docId, authorId, completed: false }
      receipts.set(ctx.threadId, receipt)
      return receipt
    },
    complete: async (ctx) => {
      receipts.get(ctx.threadId).completed = true
    },
  }
  const range = {
    assertDocument: async () => calls.push(['document']),
    assertAnchor: async () => calls.push(['anchor']),
    change: async () => calls.push(['range']),
  }
  const service = createNativeCommentsService({
    roleFor: async () => role,
    chat,
    range,
    deletions,
    decorate: async () => {},
    emit: (...args) => calls.push(['emit', ...args]),
  })
  return { service, calls, range, chat, receipts }
}
test('unauthorized readers cannot discover or mutate comments', async () => {
  const { service, calls } = fixture(false)
  for (const action of [
    () => service.list(ctx),
    () => service.add(ctx, 'x'),
    () => service.edit(ctx, 'x'),
    () => service.removeMessage(ctx, false),
    () => service.changeThread(ctx, 'resolve'),
  ])
    await assert.rejects(action, { status: 403 })
  assert.deepEqual(calls, [])
})
test('signed-in read-only members can comment but cannot manage a thread', async () => {
  const { service, calls } = fixture('readOnly')
  await service.add(ctx, 'Review this paragraph')
  assert.equal(calls[0][0], 'sendComment')
  assert.equal(calls[1][2], 'new-comment')
  await assert.rejects(() => service.changeThread(ctx, 'resolve'), {
    status: 403,
  })
})
test('content and identifiers are bounded before persistence', async () => {
  const { service, calls } = fixture()
  for (const value of ['', ' ', 'x'.repeat(10001), {}])
    await assert.rejects(() => service.add(ctx, value), { status: 400 })
  await assert.rejects(
    () => service.add({ ...ctx, threadId: '../global' }, 'x'),
    { status: 400 }
  )
  assert.deepEqual(calls, [])
})
test('even owner cannot edit another author message', async () => {
  const { service, calls } = fixture('owner', 'f'.repeat(24))
  await assert.rejects(() => service.edit(ctx, 'rewrite'), { status: 403 })
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['getThreadMessage']
  )
})
test('reviewer manages only own threads and own-message deletion honors ownership', async () => {
  const denied = fixture('review', 'f'.repeat(24))
  await assert.rejects(() => denied.service.changeThread(ctx, 'delete'), {
    status: 403,
  })
  await assert.rejects(() => denied.service.removeMessage(ctx, true), {
    status: 403,
  })
  const own = fixture('review')
  await own.service.changeThread(ctx, 'reopen')
  assert.deepEqual(
    own.calls.map((c) => c[0]),
    ['getThread', 'anchor', 'range', 'reopenThread', 'emit']
  )
})
test('invalid document/thread anchor prevents both stores from changing', async () => {
  const { service, calls, range } = fixture()
  range.assertAnchor = async () => {
    throw Object.assign(new Error('not found'), { status: 404 })
  }
  await assert.rejects(() => service.changeThread(ctx, 'resolve'), {
    status: 404,
  })
  assert.deepEqual(calls, [])
})

test('reviewer can retry deletion after the anchor is removed and chat fails', async () => {
  const { service, range, chat, receipts, calls } = fixture('review')
  let removed = false
  let attempts = 0
  range.assertAnchor = async () => {
    if (removed) throw new Error('anchor already gone')
  }
  range.change = async () => {
    removed = true
  }
  chat.deleteThread = async () => {
    if (++attempts === 1) throw new Error('chat unavailable')
  }
  await assert.rejects(
    () => service.changeThread(ctx, 'delete'),
    /chat unavailable/
  )
  assert.equal(receipts.get(ctx.threadId).completed, false)
  assert.equal(
    calls.some((c) => c[0] === 'emit'),
    false
  )
  await assert.rejects(() => service.add(ctx, 'late reply'), { status: 409 })
  await service.changeThread(ctx, 'delete')
  assert.equal(receipts.get(ctx.threadId).completed, true)
  await service.changeThread(ctx, 'delete')
  assert.equal(attempts, 2)
})
test('deletion receipt cannot be replayed against a different document or reviewer', async () => {
  const { service, receipts } = fixture('review')
  receipts.set(ctx.threadId, {
    docId: ctx.docId,
    authorId: 'f'.repeat(24),
    completed: false,
  })
  await assert.rejects(() => service.changeThread(ctx, 'delete'), {
    status: 403,
  })
  await assert.rejects(
    () => service.changeThread({ ...ctx, docId: 'f'.repeat(24) }, 'delete'),
    { status: 409 }
  )
})
test('retry accepts a chat 404 only after a durable deletion receipt exists', async () => {
  const { service, chat, receipts } = fixture()
  receipts.set(ctx.threadId, {
    docId: ctx.docId,
    authorId: ctx.userId,
    completed: false,
  })
  chat.deleteThread = async () => {
    throw Object.assign(new Error('already deleted'), {
      response: { status: 404 },
    })
  }
  await service.changeThread(ctx, 'delete')
  assert.equal(receipts.get(ctx.threadId).completed, true)
})


test('project ranges are inaccessible before membership authorization', async () => {
  const { service, range } = fixture(false)
  range.list = async () => assert.fail('Unauthorized range lookup')
  await assert.rejects(service.listRanges(ctx), { status: 403 })
})

test('authorized readers receive ranges only for their requested project', async () => {
  const { service, range } = fixture('readOnly')
  const rows = [{ id: ctx.docId, ranges: { comments: [{ op: { t: ctx.threadId } }] } }]
  range.list = async projectId => {
    assert.equal(projectId, ctx.projectId)
    return rows
  }
  assert.deepEqual(await service.listRanges(ctx), rows)
})


test('ranges include unloaded documents, prefer live edits and exclude removed files', async () => {
  const old = { comments: ['stored'] }
  const updated = { comments: ['live'] }
  const rows = await loadNativeCommentRanges(ctx.projectId, {
    stored: async id => {
      assert.equal(id, ctx.projectId)
      return [{ _id: 'closed', ranges: old }, { _id: 'open', ranges: old }, { _id: 'removed', ranges: old }]
    },
    live: async id => {
      assert.equal(id, ctx.projectId)
      return [{ id: 'open', ranges: updated }, { id: 'removed', ranges: updated }]
    },
    docIds: async () => ['closed', 'open', 'new'],
  })
  assert.deepEqual(rows, [
    { id: 'closed', ranges: old },
    { id: 'open', ranges: updated },
    { id: 'new', ranges: { comments: [], changes: [] } },
  ])
})
