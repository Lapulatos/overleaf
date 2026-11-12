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

test('merge draft commands validate task/revision/lease input before dispatch and never accept disk paths', async () => {
  const id = '10000000-0000-4000-8000-000000000001'
  for (const body of [
    { command: 'mergeDraftPrepare', operationId: id, ref: 'source', directory: '/private' },
    { command: 'mergeDraftGet', id: '../task' },
    { command: 'mergeDraftClaim', id, revision: 0, sessionId: id },
    { command: 'mergeDraftResolve', id, revision: 1, sessionId: id, generation: 0, path: 'main.tex', fingerprint: 'a'.repeat(64), choice: 'incoming' },
  ]) {
    const f = fixture(); f.req.body = body
    await f.handlers.command(f.req, f.res)
    assert.equal(f.res.statusCode, 400)
    assert.equal(f.calls.some(call => call[0] === 'execute'), false)
  }
  const f = fixture()
  f.req.body = { command: 'mergeDraftPrepare', operationId: id, ref: 'source' }
  await f.handlers.command(f.req, f.res)
  assert.equal(f.res.statusCode, 200)
  assert.deepEqual(f.calls[1], ['execute', project, user, f.req.body])
  const denied = fixture({ canWrite: async () => false })
  denied.req.body = { command: 'mergeDraftList' }
  await denied.handlers.command(denied.req, denied.res)
  assert.equal(denied.res.statusCode, 403)
  assert.equal(denied.calls.length, 0)
})

test('application and recovery commands enforce explicit bounded identities and recovery choice', async () => {
 const id='10000000-0000-4000-8000-000000000001'
 const apply={command:'mergeDraftApply',id,revision:1,sessionId:id,generation:1}
 const recover={command:'mergeDraftRecover',id,revision:1,fingerprint:'a'.repeat(64),mode:'resume',operationId:id}
 for(const body of [apply,recover,{command:'mergeDraftRecoveryPreview',id}]){
  const f=fixture();f.req.body=body;await f.handlers.command(f.req,f.res)
  assert.equal(f.res.statusCode,200)
  const denied=fixture({canWrite:async()=>false});denied.req.body=body
  await denied.handlers.command(denied.req,denied.res);assert.equal(denied.res.statusCode,403)
 }
 for(const body of [{...apply,generation:0},{...apply,directory:'/tmp'}, {...recover,mode:'overwrite'}, {...recover,fingerprint:''}, {...recover,epoch:99}]){
  const f=fixture();f.req.body=body;await f.handlers.command(f.req,f.res)
  assert.equal(f.res.statusCode,400);assert.equal(f.calls.some(call=>call[0]==='execute'),false)
 }
})

test('session recovery commands reject client epochs, lease tokens and disk paths', async () => {
 const operationId='10000000-0000-4000-8000-000000000001'
 for(const body of [{command:'sessionRecover',operationId},{command:'sessionRecoveryList'}]){
  const f=fixture();f.req.body=body;await f.handlers.command(f.req,f.res)
  assert.equal(f.res.statusCode,200)
  const denied=fixture({canWrite:async()=>false});denied.req.body=body
  await denied.handlers.command(denied.req,denied.res);assert.equal(denied.res.statusCode,403)
  assert.equal(denied.calls.length,0)
 }
 for(const extra of [{epoch:7},{writeToken:operationId},{directory:'/tmp'},{operationId:'../invalid'}]){
  const f=fixture();f.req.body={command:'sessionRecover',operationId,...extra}
  await f.handlers.command(f.req,f.res);assert.equal(f.res.statusCode,400)
  assert.equal(f.calls.some(call=>call[0]==='execute'),false)
 }
})

test('read-only members may inspect history but never stage, initialize, or configure a webhook', async () => {
  for (const command of [{command:'graph'}, {command:'commitDetails',ref:'HEAD'}]) {
    const f=fixture({canWrite:async()=>false,canRead:async()=>true});f.req.body=command
    await f.handlers.command(f.req,f.res);assert.equal(f.res.statusCode,200);assert(f.calls.some(c=>c[0]==='execute'))
  }
  for (const command of [{command:'stage',paths:['main.tex']}, {command:'configureWebhook',revision:0,enabled:true}, {command:'terminalOpen'}]) {
    const f=fixture({canWrite:async()=>false,canRead:async()=>true});f.req.body=command
    await f.handlers.command(f.req,f.res);assert.equal(f.res.statusCode,403);assert.equal(f.calls.length,0)
  }
  const f=fixture({canWrite:async()=>false,canRead:async()=>true})
  await f.handlers.status(f.req,f.res);assert.equal(f.res.statusCode,200)
  const g=fixture({canWrite:async()=>false,canRead:async()=>true})
  await g.handlers.initialize(g.req,g.res);assert.equal(g.res.statusCode,403)
})
