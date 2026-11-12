import test from 'node:test'
import assert from 'node:assert/strict'
import { listRemoteDiscoveries, publicDiscoveryTask } from '../../app/src/Features/NativeGit/RemoteDiscoveryStatus.mjs'
import { commandSchema } from '../../app/src/Features/NativeGit/GitCommands.mjs'
const task = { id: 'task', revision: 2, kind: 'remote-discovery', remote: 'origin',
 state: 'fetched', createdAt: '2026-11-11T01:00:00Z', fetchedAt: '2026-11-11T01:01:00Z',
 url: '/private/remote.git', ownerId: 'secret-account', before: { private: 'snapshot' },
 changes: [{ ref: 'refs/remotes/origin/main', before: 'old', after: 'new', change: 'advanced', privateField: 'secret' }] }
test('public status projects safe fields only including nested changes', () => {
 const result = publicDiscoveryTask(task)
 assert.equal(result.applied, false)
 assert.deepEqual(result.changes, [{ ref: 'refs/remotes/origin/main', before: 'old', after: 'new', change: 'advanced' }])
 for (const secret of ['private', 'secret', 'ownerId', 'url']) assert.equal(JSON.stringify(result).includes(secret), false)
})
test('shared list rechecks membership inside lock and after read, and sorts newest first', async () => {
 const events = []
 const result = await listRemoteDiscoveries({
  authorize: async () => events.push('authorize'),
  withLock: async fn => { events.push('lock'); return fn() },
  store: { list: async () => { events.push('read'); return [task, { ...task, id: 'new', createdAt: '2026-11-12' }, { ...task, kind: 'other' }] } },
 })
 assert.deepEqual(events, ['authorize', 'lock', 'authorize', 'read', 'authorize'])
 assert.deepEqual(result.map(x => x.id), ['new', 'task'])
})
test('revocation while waiting or reading rejects the entire snapshot', async () => {
 for (const revokedAt of [1, 2, 3]) {
  let count = 0, reads = 0
  await assert.rejects(listRemoteDiscoveries({
   authorize: async () => { if (++count === revokedAt) throw Object.assign(Error('revoked'), { status: 403 }) },
   withLock: fn => fn(), store: { list: async () => { reads++; return [task] } },
  }), { status: 403 })
  assert.equal(reads, revokedAt === 3 ? 1 : 0)
 }
})
test('list accepts no caller-controlled project, user or task filter', () => {
 assert.deepEqual(commandSchema.parse({ command: 'remoteDiscoveryList' }), { command: 'remoteDiscoveryList' })
 for (const extra of [{ userId: 'someone' }, { projectId: 'other' }, { path: '/private' }]) {
  assert.equal(commandSchema.safeParse({ command: 'remoteDiscoveryList', ...extra }).success, false)
 }
})
