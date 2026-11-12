import test from 'node:test'
import assert from 'node:assert/strict'
import { AutoCommitController } from '../../app/src/Features/NativeGit/AutoCommitController.mjs'
import { commandSchema } from '../../app/src/Features/NativeGit/GitCommands.mjs'
const id = '11111111-1111-4111-8111-111111111111'
function fixture(enabled = false) {
  let state, allowed = true
  const store = { read: async () => { if (!state) throw Object.assign(Error('absent'), { code: 'ENOENT' }); return structuredClone(state) }, write: async value => { state = structuredClone(value) } }
  const controller = new AutoCommitController({ store, service: {}, withLock: fn => fn(),
    authorize: async () => { if (!allowed) throw Object.assign(Error('owner only'), { status: 403 }) }, ownerId: 'owner', workspaceId: 'workspace', enabled })
  return { controller, revoke: () => { allowed = false }, get state() { return state } }
}
test('strict commands reject client identity, filesystem paths and short intervals', () => {
  assert.equal(commandSchema.safeParse({ command: 'autoCommitSchedule' }).success, true)
  assert.equal(commandSchema.safeParse({ command: 'autoCommitRecover', operationId: id, revision: 2, scheduleRevision: 3, fingerprint: 'a'.repeat(64) }).success, true)
  for (const command of [
    { command: 'autoCommitSchedule', ownerId: 'spoof' },
    { command: 'configureAutoCommitSchedule', revision: 0, enabled: true, intervalMs: 500 },
    { command: 'autoCommitRecoveryPreview', operationId: id, directory: '/etc' },
    { command: 'autoCommitRecover', operationId: id, revision: 2, fingerprint: 'a'.repeat(64) },
  ]) assert.equal(commandSchema.safeParse(command).success, false)
})
test('disabled server exposes status and permits disabling but refuses enabling or work', async () => {
  const f = fixture()
  assert.equal((await f.controller.execute({ command: 'autoCommitSchedule' })).schedulerAvailable, false)
  await assert.rejects(f.controller.execute({ command: 'configureAutoCommitSchedule', revision: 0, enabled: true, intervalMs: 60000 }), { status: 503 })
  await f.controller.execute({ command: 'configureAutoCommitSchedule', revision: 0, enabled: false, intervalMs: 60000 })
  assert.equal(f.state.enabled, false); assert.equal(await f.controller.runDue(), null)
})
test('nonowner cannot read or configure schedule', async () => {
  const f = fixture(true); f.revoke()
  await assert.rejects(f.controller.execute({ command: 'autoCommitSchedule' }), { status: 403 })
  await assert.rejects(f.controller.execute({ command: 'configureAutoCommitSchedule', revision: 0, enabled: true, intervalMs: 60000 }), { status: 403 })
  assert.equal(f.state, undefined)
})
test('recovery remains available when new automatic scheduling is disabled', async () => {
  const f = fixture()
  f.controller.service.recoveryPreview = async operationId => ({ operationId, action: 'cancel' })
  assert.equal((await f.controller.execute({ command: 'autoCommitRecoveryPreview', operationId: id })).action, 'cancel')
})
test('enabled controller dispatches server snapshot once and honours next due time', async () => {
  const f = fixture(true); let executions = 0
  f.controller.service.previewLocked = async () => ({ changed: true, head: 'a'.repeat(40), indexFingerprint: 'index', snapshotFingerprint: 'saved' })
  f.controller.service.executeLocked = async request => {
    executions++; assert.equal(request.snapshot.snapshotFingerprint, 'saved')
    return { operationId: request.operationId, commit: 'b'.repeat(40) }
  }
  await f.controller.execute({ command: 'configureAutoCommitSchedule', revision: 0, enabled: true, intervalMs: 60000 })
  assert.equal((await f.controller.runDue()).result.commit, 'b'.repeat(40))
  assert.equal(await f.controller.runDue(), null); assert.equal(executions, 1)
})

test('collaborator can read public schedule but cannot configure or recover it', async () => {
  const f = fixture(true)
  await f.controller.execute({ command: 'configureAutoCommitSchedule', revision: 0, enabled: true, intervalMs: 60000 })
  f.revoke()
  f.controller.authorizeRead = async () => false
  const status = await f.controller.execute({ command: 'autoCommitSchedule' })
  assert.equal(status.canManage, false)
  assert.equal(status.state, 'scheduled')
  assert.equal(status.ownerId, undefined)
  await assert.rejects(f.controller.execute({ command: 'configureAutoCommitSchedule', revision: status.revision, enabled: false, intervalMs: 60000 }), { status: 403 })
  await assert.rejects(f.controller.execute({ command: 'autoCommitRecoveryPreview', operationId: id }), { status: 403 })
  f.controller.authorizeRead = async () => { throw Object.assign(Error('membership revoked'), { status: 403 }) }
  await assert.rejects(f.controller.execute({ command: 'autoCommitSchedule' }), { status: 403 })
})
