import test from 'node:test'
import assert from 'node:assert/strict'
import { createNativeGitHandlers } from '../../app/src/Features/NativeGit/NativeGitHandlers.mjs'

const project = 'abcdef012345678901234567'
const user = '1234567890abcdef01234567'
function response() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this },
    sendStatus(code) { this.statusCode = code; return this },
    set(key, value) { this.headers[key] = value; return this }, json(body) { this.body = body; return this } }
}
function fixture(overrides = {}) {
  const calls = []
  const handlers = createNativeGitHandlers({ enabled: () => true, userId: () => user,
    canWrite: async (...args) => { calls.push(['authorize', ...args]); return true },
    runtime: {
      status: async (...args) => { calls.push(['status', ...args]); return { connected: false } },
      initialize: async (...args) => { calls.push(['initialize', ...args]); return {} },
      execute: async (...args) => { calls.push(['execute', ...args]); return {} },
    }, ...overrides })
  return { handlers, calls, req: { params: { projectId: project }, body: {} }, res: response() }
}

test('disabled, anonymous and unauthorized requests cannot access native repository storage', async () => {
  for (const [overrides, status] of [[{ enabled: () => false }, 404], [{ userId: () => null }, 401], [{ canWrite: async () => false }, 403]]) {
    const f = fixture(overrides)
    await f.handlers.status(f.req, f.res)
    assert.equal(f.res.statusCode, status)
    assert.deepEqual(f.calls, [])
  }
})

test('HTTP command rejects traversal project IDs, unknown commands and supplied filesystem/config fields', async () => {
  const f = fixture()
  f.req.params.projectId = '../../another-project'
  await f.handlers.command(f.req, f.res)
  assert.equal(f.res.statusCode, 400)
  assert.deepEqual(f.calls, [])
  for (const body of [{ command: 'raw' }, { command: 'stage', paths: ['main.tex'], directory: '/other' }, { command: 'commit', message: '' }]) {
    const f = fixture()
    f.req.body = body
    await f.handlers.command(f.req, f.res)
    assert.equal(f.res.statusCode, 400)
    assert.equal(f.calls.length, 1)
  }
})

test('authenticated request is bound to the session user and authorized project, with no-store responses', async () => {
  const f = fixture()
  f.req.body = { command: 'commit', message: 'Update title' }
  await f.handlers.command(f.req, f.res)
  assert.deepEqual(f.calls, [['authorize', user, project], ['execute', project, user, f.req.body]])
  assert.equal(f.res.headers['Cache-Control'], 'no-store')
  const init = fixture()
  await init.handlers.initialize(init.req, init.res)
  assert.deepEqual(init.calls[1], ['initialize', project, user, 'main'])
})

test('pending editor integration reports unavailable without pretending a command succeeded', async () => {
  const f = fixture({ runtime: { execute: async () => { throw Object.assign(new Error('Editor integration unavailable'), { status: 503 }) } } })
  f.req.body = { command: 'checkout', name: 'B' }
  await f.handlers.command(f.req, f.res)
  assert.equal(f.res.statusCode, 503)
  assert.equal(f.res.body.error, 'Editor integration unavailable')
})

test('project lock contention returns JSON 503 with Retry-After instead of a generic 500 page', async () => {
  const f = fixture({ runtime: { status: async () => { throw Object.assign(new Error('Wait and refresh repository status'), {
    status: 503, code: 'GIT_PROJECT_BUSY', retryAfter: 2,
  }) } } })
  await f.handlers.status(f.req, f.res)
  assert.equal(f.res.statusCode, 503)
  assert.equal(f.res.headers['Retry-After'], '2')
  assert.equal(f.res.body.code, 'GIT_PROJECT_BUSY')
  assert.equal(f.res.body.error, 'Wait and refresh repository status')
})

test('native conflicts return actionable JSON 409 instead of an internal error page', async () => {
  const f = fixture({ runtime: { execute: async () => { throw Object.assign(new Error('Resolve files in Merge Changes'), { status: 409, code: 'GIT_CONFLICT' }) } } })
  f.req.body = { command: 'merge', ref: 'source' }
  await f.handlers.command(f.req, f.res)
  assert.equal(f.res.statusCode, 409)
  assert.deepEqual(f.res.body, { error: 'Resolve files in Merge Changes', code: 'GIT_CONFLICT' })
})

test('actual native duplicate branch and unknown revision errors become actionable JSON', async t => {
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { GitRepository } = await import('../../app/src/Features/NativeGit/GitRepository.mjs')
  const root = await mkdtemp(join(tmpdir(), 'git-http-refusal-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = await GitRepository.init(root)
  await repo.author('Fixture Author', 'fixture@example.test')
  await repo.git.raw(['commit', '--allow-empty', '-m', 'Initial'])
  for (const [action, status, expected] of [
    [() => repo.createBranch('main'), 409, /already exists/],
    [() => repo.resolve('missing-ref'), 400, /could not be found/],
    [() => repo.createBranch('invalid branch'), 400, /Invalid branch/],
  ]) {
    const f = fixture({ runtime: { execute: action } })
    f.req.body = { command: 'createBranch', name: 'test' }
    await f.handlers.command(f.req, f.res)
    assert.equal(f.res.statusCode, status)
    assert.match(f.res.body.error, expected)
    assert.equal(f.res.body.error.includes(root), false)
  }
})

test('unexpected storage failures remain server errors', async () => {
  const failure = Object.assign(new Error('disk unavailable'), { code: 'EIO' })
  const f = fixture({ runtime: { status: async () => { throw failure } } })
  await assert.rejects(f.handlers.status(f.req, f.res), error => error === failure)
})
