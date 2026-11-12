import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizedOperationLock, authorizedWriteLease } from '../../app/src/Features/NativeGit/AuthorizedOperationLock.mjs'
import { MergeDraftService } from '../../app/src/Features/NativeGit/MergeDraftService.mjs'
const denied = () => Object.assign(Error('Project access revoked'), { status: 403 })
test('revocation while waiting for lock prevents repository action', async () => {
 let permitted = true, release, queued, invoked = false
 const waiting = new Promise(resolve => { queued = resolve })
 const lock = authorizedOperationLock(async fn => { queued(); await new Promise(resolve => { release = resolve }); return fn() },
  async () => { if (!permitted) throw denied() })
 const operation = lock(() => { invoked = true })
 await waiting; permitted = false; release()
 await assert.rejects(operation, { status: 403 }); assert.equal(invoked, false)
})
test('permission failure before lock acquisition avoids queueing entirely', async () => {
 let queued = false
 const lock = authorizedOperationLock(async fn => { queued = true; return fn() }, async () => { throw denied() })
 await assert.rejects(lock(() => {}), { status: 403 }); assert.equal(queued, false)
})
test('authorized action executes once with its result under the lock', async () => {
 const order = []
 const lock = authorizedOperationLock(async fn => { order.push('locked'); const value = await fn(); order.push('released'); return value }, async () => { order.push('authorized') })
 assert.equal(await lock(() => { order.push('action'); return 42 }), 42)
 assert.deepEqual(order, ['authorized', 'locked', 'authorized', 'action', 'released'])
})
for (const operation of ['list', 'get', 'conflict']) {
 test(`revocation during ${operation} suppresses sensitive task response`, async () => {
  let allowed = true
  const task = { id: 'task', logicalProjectId: 'p', workspaceId: 'w', remainingPaths: ['private.tex'], directory: '/draft' }
  const service = new MergeDraftService({ workspace: { withLock: fn => fn() },
   repository: { openWorktree: async () => ({ conflictDetails: async () => { allowed = false; return { text: 'private manuscript' } } }) },
   store: { list: async () => { allowed = false; return [task] }, read: async () => { if(operation==='get')allowed=false; return task } },
   logicalProjectId: 'p', workspaceId: 'w', actorId: 'a', authorize: async () => { if (!allowed) throw denied() },
  })
  await assert.rejects(operation === 'list' ? service.list() : operation === 'get' ? service.get('task') : service.conflict('task', 'private.tex'), { status: 403 })
 })
}

test('transaction checkpoints recheck authorization and lease expiry during lookup', async () => {
 let allowed = true, lease = true, checks = 0
 const guard = authorizedWriteLease(async () => { checks++; if (!lease) throw Error('lease expired') }, async () => { if (!allowed) throw denied() })
 await guard(); assert.equal(checks, 2)
 allowed = false; await assert.rejects(guard(), { status: 403 })
 allowed = true
 const expiresDuringRead = authorizedWriteLease(async () => { if (!lease) throw Error('lease expired') }, async () => { lease = false })
 await assert.rejects(expiresDuringRead(), /lease expired/)
})
