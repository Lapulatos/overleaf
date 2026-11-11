/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDeletionHistoryPreflight } from '../../app/src/Features/WritingAssist/DocumentDeletionHistoryPreflight.mjs'

function fixture(overrides = {}) {
  return createDeletionHistoryPreflight({
    getProject: async () => ({ overleaf: { history: { id: 'history-id', rangesSupportEnabled: true } } }),
    getResyncState: async () => ({ resyncPending: false }),
    getLatestVersion: async () => ({ projectHistoryId: 'history-id', version: 3 }),
    ...overrides,
  })
}
test('available matching history permits preparation', async () => {
  await fixture()('project')
})
test('missing, legacy, or pending deletion history rejects before service calls', async () => {
  for (const project of [null, {}, { overleaf: { history: { id: 'history-id' } } },
    { overleaf: { history: { id: 'history-id', rangesSupportEnabled: true } }, deletionHistoryPending: 'operation' }]) {
    let calls = 0
    await assert.rejects(fixture({ getProject: async () => project, getResyncState: async () => { calls++ } })('project'), { status: 409 })
    assert.equal(calls, 0)
  }
})
test('ongoing or unrecognized resync state rejects without reading a revision', async () => {
  for (const state of [null, {}, { resyncPending: true }]) {
    let calls = 0
    await assert.rejects(fixture({ getResyncState: async () => state, getLatestVersion: async () => { calls++ } })('project'), { status: 409 })
    assert.equal(calls, 0)
  }
})
test('mismatched history identity or invalid revision rejects preparation', async () => {
  for (const latest of [null, {}, { projectHistoryId: 'other', version: 3 },
    { projectHistoryId: 'history-id', version: -1 }, { projectHistoryId: 'history-id', version: '3' }]) {
    await assert.rejects(fixture({ getLatestVersion: async () => latest })('project'), { status: 409 })
  }
})
test('history transport failures propagate without permitting preparation', async () => {
  await assert.rejects(fixture({ getResyncState: async () => { throw new Error('timeout') } })('project'), /timeout/)
})
