import test from 'node:test'
import assert from 'node:assert/strict'
import { withProjectOperationLock } from '../../app/src/Features/NativeGit/ProjectOperationLock.mjs'

test('lock acquisition timeout is retryable without running the Git operation', async () => {
  let called = false
  const locks = { promises: { runWithLock: async () => { throw new Error('Timeout') } } }
  await assert.rejects(withProjectOperationLock(locks, 'nativeGitProject', 'project', () => { called = true }), error =>
    error.status === 503 && error.code === 'GIT_PROJECT_BUSY' && error.retryAfter === 2)
  assert.equal(called, false)
})

test('a timeout after acquisition remains the original operation error and is not retried', async () => {
  let calls = 0
  const error = new Error('Timeout')
  const locks = { promises: { runWithLock: async (namespace, id, fn) => fn() } }
  await assert.rejects(withProjectOperationLock(locks, 'nativeGitProject', 'project', () => { calls++; throw error }), actual => actual === error)
  assert.equal(calls, 1)
})

test('successful operation and non-timeout lock errors retain original results', async () => {
  const locks = { promises: { runWithLock: async (namespace, id, fn) => fn() } }
  assert.equal(await withProjectOperationLock(locks, 'nativeGitProject', 'project', () => 42), 42)
  const error = new Error('Redis connection failed')
  locks.promises.runWithLock = async () => { throw error }
  await assert.rejects(withProjectOperationLock(locks, 'nativeGitProject', 'project', () => 42), actual => actual === error)
})
