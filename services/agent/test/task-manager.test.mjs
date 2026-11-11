import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { createTaskManager } from '../src/task-manager.mjs'

const config = { timeout: 1000, maxSteps: 10, maxConcurrentTasks: 1 }
const request = { taskId: 'task-1', type: 'rewrite', instruction: 'Improve clarity' }
const result = {
  summary: 'Suggested revision',
  diffs: [{ path: 'main.tex', content: '--- a/main.tex\n+++ b/main.tex\n@@ -1 +1 @@\n-old\n+new' }],
  artifacts: [{ name: 'notes', type: 'text', content: 'Explanation' }],
}

test('conversation prompt distinguishes earlier suggestions from the current snapshot', async t => {
  let prompt
  const manager = createTaskManager({ execute: async value => { prompt = value; return result } }, config)
  t.after(() => manager.shutdown())
  const task = manager.createTask({ ...request, context: {
    conversation: { turns: [{ user: 'Why?', assistant: 'Earlier explanation', changes: [{ path: 'main.tex', status: 'rejected' }] }], omittedTurns: 2 },
    documents: [{ path: 'main.tex', content: 'Current manuscript' }],
  } })
  await manager.executeTask(task.id)
  assert.match(prompt, /Earlier explanation/)
  assert.match(prompt, /"status":"rejected"/)
  assert.match(prompt, /"omittedTurns":2/)
  assert.match(prompt, /Current manuscript/)
  assert.match(prompt, /do not assume a suggested change was applied/)
})

test('returns proposals and artifacts without writing to the project bridge', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Task execution must not write to the project')
  })
  const manager = createTaskManager({ execute: async () => result }, config)
  t.after(() => manager.shutdown())
  const task = manager.createTask({ ...request, context: { apiToken: 'test', projectId: 'project' } })
  await manager.executeTask(task.id)
  assert.equal(task.status, 'completed')
  assert.deepEqual(task.toResult().diffs, result.diffs)
  assert.deepEqual(task.toResult().artifacts, result.artifacts)
  assert.equal(fetchMock.mock.callCount(), 0)
})

for (const ending of ['cancelled', 'timeout']) {
  test(`${ending} aborts backend and ignores late progress/results`, async t => {
    let resolveBackend
    let options
    const backend = { execute: async (_prompt, opts) => {
      options = opts
      return await new Promise(resolve => { resolveBackend = resolve })
    } }
    const manager = createTaskManager(backend, config)
    t.after(() => manager.shutdown())
    const task = manager.createTask({ ...request, timeout: ending === 'timeout' ? 10 : 1000 })
    const execution = manager.executeTask(task.id)
    if (ending === 'cancelled') task.cancel()
    else await sleep(30)
    assert.equal(options.signal.aborted, true)
    assert.equal(task.status, ending)
    const snapshot = task.toResult()
    options.onProgress('late output')
    resolveBackend(result)
    await execution
    assert.deepEqual(task.toResult(), snapshot)
    assert.deepEqual(task.outputs, [])
    assert.equal(manager.getConcurrency().running, 0)
  })
}

test('rejects duplicate execution and preserves the original task on duplicate creation', async t => {
  let resolveBackend
  const manager = createTaskManager({ execute: () => new Promise(resolve => { resolveBackend = resolve }) }, config)
  t.after(() => manager.shutdown())
  const task = manager.createTask(request)
  assert.throws(() => manager.createTask(request), /Duplicate/)
  assert.equal(manager.getTask(task.id), task)
  const execution = manager.executeTask(task.id)
  await assert.rejects(manager.executeTask(task.id), /already started/)
  assert.equal(manager.getConcurrency().running, 1)
  resolveBackend(result)
  await execution
})

test('shutdown aborts pending work', async () => {
  const manager = createTaskManager({ execute: async () => result }, config)
  const task = manager.createTask(request)
  manager.shutdown()
  assert.equal(task.status, 'cancelled')
  await assert.rejects(manager.executeTask(task.id), /already started/)
})

test('legacy writing task requests exact JSON without conflicting diff instructions', async t => {
  let prompt
  const manager = createTaskManager({ execute: async value => { prompt = value; return { summary: '{"issues":[]}' } } }, config)
  t.after(() => manager.shutdown())
  const task = manager.createTask({ ...request, type: 'writing-assist-json', instruction: 'Return JSON issues.', context: { userMessage: 'They is ready.' } })
  await manager.executeTask(task.id)
  assert.match(prompt, /Do not use tools/)
  assert.match(prompt, /Return JSON issues/)
  assert.match(prompt, /They is ready/)
  assert.doesNotMatch(prompt, /provide a unified diff/)
  assert.equal(task.toResult().summary, '{"issues":[]}')
})

for (const fail of [false, true]) {
  test(`image data is released after backend ${fail ? 'failure' : 'success'}`, async t => {
    const manager = createTaskManager({ execute: async (_prompt, opts) => {
      assert.equal(opts.context.images[0].data, 'private-image-bytes')
      if (fail) throw new Error('Decode failed')
      return { summary: 'Transcribed' }
    } }, config)
    t.after(() => manager.shutdown())
    const task = manager.createTask({ ...request, context: { images: [{ data: 'private-image-bytes' }] } })
    await manager.executeTask(task.id)
    assert.equal(task.status, fail ? 'failed' : 'completed')
    assert.equal(task.context.images, undefined)
    assert.equal(JSON.stringify(task.toJSON()).includes('private-image-bytes'), false)
  })
}
test('per-task model and reasoning selection reaches the backend without changing other tasks',async t=>{
 const seen=[]
 const manager=createTaskManager({execute:async(_prompt,options)=>{seen.push(options);return result}},{...config,model:'default-model'})
 t.after(()=>manager.shutdown())
 const chosen=manager.createTask({...request,model:'chosen-model',effort:'high'})
 await manager.executeTask(chosen.id)
 const next=manager.createTask({...request,taskId:'task-2'})
 await manager.executeTask(next.id)
 assert.equal(seen[0].model,'chosen-model');assert.equal(seen[0].effort,'high')
 assert.equal(seen[1].model,'default-model');assert.equal(seen[1].effort,undefined)
})
