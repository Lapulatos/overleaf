import test from 'node:test'
import assert from 'node:assert/strict'
import { changeWorkspaceLifecycle } from '../../app/src/Features/NativeGit/WorkspaceLifecycle.mjs'
function fixture() {
 let state = 'ready', epoch = 1, flushed = 0, allowed = true, pending = false
 const run = (action, expectedState = state) => changeWorkspaceLifecycle({ workspaceId: 'branch', action, expectedState,
  read: async () => ({ state }), authorize: async () => { if (!allowed) throw Object.assign(Error('denied'), { status: 403 }) },
  lock: fn => fn(), exclusive: (_, fn) => fn(async () => {}), epoch: () => ({ read: async () => epoch, advance: async n => { assert.equal(n, epoch); epoch++ } }),
  flush: async () => flushed++, blocked: async () => pending, save: async (_, before, after) => { assert.equal(before, state); state = after; return true } })
 return { run, snapshot: () => ({ state, epoch, flushed }), revoke: () => { allowed = false }, block: () => { pending = true } }
}
test('archive and restore retain storage and invalidate old editing epochs', async () => {
 const f = fixture(); await f.run('archive'); assert.deepEqual(f.snapshot(), { state: 'archived', epoch: 2, flushed: 1 })
 await f.run('restore'); assert.deepEqual(f.snapshot(), { state: 'ready', epoch: 3, flushed: 2 })
})
test('stale lifecycle request does not mutate or advance epoch', async () => {
 const f = fixture(); await f.run('archive'); await assert.rejects(f.run('restore', 'ready'), { status: 409 })
 assert.equal(f.snapshot().epoch, 2)
})
test('pending work blocks archive before any mutation', async () => {
 const f = fixture(); f.block(); await assert.rejects(f.run('archive'), { status: 409 }); assert.equal(f.snapshot().epoch, 1)
})
test('revoked access refuses lifecycle operation', async () => {
 const f = fixture(); f.revoke(); await assert.rejects(f.run('archive'), { status: 403 }); assert.equal(f.snapshot().state, 'ready')
})

test('restore uses the prepared membership transition instead of advancing only the database', async () => {
 const steps = []
 const result = await changeWorkspaceLifecycle({ workspaceId: 'branch', expectedState: 'archived', action: 'restore',
  read: async () => ({ state: 'archived' }), authorize: async () => {}, lock: fn => fn(), blocked: async () => false,
  exclusive: (_, fn) => fn(async () => {}, { advanceEpoch: async () => { steps.push('epoch-and-membership'); return 6 } }),
  epoch: () => ({ read: async () => 5, advance: async () => { throw Error('must advance membership together') } }),
  flush: async () => steps.push('flush'), save: async () => { steps.push('ready'); return true } })
 assert.equal(result.state, 'ready'); assert.deepEqual(steps, ['flush', 'epoch-and-membership', 'ready'])
})
