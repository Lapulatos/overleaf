import test from 'node:test'
import assert from 'node:assert/strict'
import { requireCommandCapability } from '../../app/src/Features/NativeGit/CommandCapabilities.mjs'
import { authorizedOperationLock } from '../../app/src/Features/NativeGit/AuthorizedOperationLock.mjs'

for (const command of ['addRemote', 'removeRemote', 'changeRemote', 'connect', 'deleteRemoteRef']) {
  test(`${command}: owner allowed, ordinary editor refused before effects`, async () => {
    const access = async () => ({ getOwnerId: () => 'owner' })
    await requireCommandCapability(command, 'owner', access)
    await assert.rejects(requireCommandCapability(command, 'editor', access), { status: 403 })
  })
}
test('ownership lost during lock wait refuses mutation', async () => {
  let owner = 'actor', mutated = false
  const lock = authorizedOperationLock(async run => { owner = 'new-owner'; return run() },
    () => requireCommandCapability('removeRemote', 'actor', async () => ({ getOwnerId: () => owner })))
  await assert.rejects(lock(async () => { mutated = true }), { status: 403 })
  assert.equal(mutated, false)
})
test('content operations and personal credentials do not acquire remote-management authority', async () => {
  for (const command of ['commit', 'stage', 'createBranch', 'saveCredential', 'removeCredential', 'clone']) {
    await requireCommandCapability(command, 'editor', () => { throw Error('Unexpected management check') })
  }
})
