/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHistoryRestorePreparation } from '../../app/src/Features/History/HistoryRestorePreparation.mjs'
const project = enabled => ({
  overleaf: { history: { id: 'history', rangesSupportEnabled: enabled } },
})
test('migrated history requires no resync', async () => {
  const prepare = createHistoryRestorePreparation({
    getProject: async () => project(true),
    migrateProject: async () => assert.fail('unneeded migration'),
  })
  await prepare('p')
})
test('legacy restore waits for native resync and verifies persisted state', async () => {
  let enabled = false
  const calls = []
  const prepare = createHistoryRestorePreparation({
    getProject: async () => {
      calls.push('read')
      return project(enabled)
    },
    migrateProject: async (id, direction) => {
      calls.push([id, direction])
      enabled = true
    },
  })
  await prepare('p')
  assert.deepEqual(calls, ['read', ['p', 'forwards'], 'read'])
})
test('overlapping preparation shares migration but independent projects do not', async () => {
  const enabled = new Set()
  const calls = []
  const prepare = createHistoryRestorePreparation({
    getProject: async id => project(enabled.has(id)),
    migrateProject: async id => {
      calls.push(id)
      enabled.add(id)
    },
  })
  const first = prepare('p')
  assert.equal(first, prepare('p'))
  await Promise.all([first, prepare('q')])
  assert.deepEqual(calls.sort(), ['p', 'q'])
})
test('failed migration blocks restore preparation and permits a later retry', async () => {
  let count = 0
  let enabled = false
  const prepare = createHistoryRestorePreparation({
    getProject: async () => project(enabled),
    migrateProject: async () => {
      if (++count === 1) throw new Error('resync failed')
      enabled = true
    },
  })
  await assert.rejects(prepare('p'), /resync failed/)
  await prepare('p')
  assert.equal(count, 2)
})
test('missing history or ineffective migration cannot authorize restoration', async () => {
  const unavailable = createHistoryRestorePreparation({
    getProject: async () => ({}),
    migrateProject: async () => assert.fail('missing history'),
  })
  await assert.rejects(unavailable('p'), /unavailable/)
  const incomplete = createHistoryRestorePreparation({
    getProject: async () => project(false),
    migrateProject: async () => {},
  })
  await assert.rejects(incomplete('p'), /did not enable/)
})
