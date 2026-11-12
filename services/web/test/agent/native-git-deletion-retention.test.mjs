import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertLegacyDeletionAllowed } from '../../app/src/Features/NativeGit/DeletionRetentionGuard.mjs'

test('branch roots, internal workspaces and restored generations cannot enter legacy deletion', async () => {
  for (const fields of [
    { gitWorkspaceEnabled: true },
    { gitWorkspace: { logicalProjectId: 'parent' } },
    { gitBackupRestore: { operationId: 'restore' } },
  ]) {
    await assert.rejects(assertLegacyDeletionAllowed({ _id: 'paper', ...fields }, async () => false),
      { code: 'GIT_PROJECT_RETENTION_REQUIRED', status: 409 })
  }
})

test('legacy roots with child records are protected even without a feature flag', async () => {
  await assert.rejects(assertLegacyDeletionAllowed({ _id: 'paper' }, async id => {
    assert.equal(id, 'paper'); return { _id: 'child' }
  }), { code: 'GIT_PROJECT_RETENTION_REQUIRED' })
})

test('ordinary projects remain deletable and inventory failures never permit deletion', async () => {
  await assertLegacyDeletionAllowed({ _id: 'paper', gitWorkspaceEnabled: false }, async () => null)
  await assert.rejects(assertLegacyDeletionAllowed({ _id: 'paper' }, async () => {
    throw new Error('database unavailable')
  }), /database unavailable/)
})
