import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createConversationService,
  conversationContext,
} from '../../app/src/Features/WritingAssist/WritingAssistConversationService.mjs'

function fixture() {
  const records = new Map()
  let allowed = true
  const store = {
    async create(value) {
      records.set(value.id, structuredClone(value))
    },
    async find(id, userId, projectId) {
      const value = records.get(id)
      return value?.userId === userId && value?.projectId === projectId
        ? structuredClone(value)
        : null
    },
    async list(userId, projectId) {
      return [...records.values()].filter(
        (c) => c.userId === userId && c.projectId === projectId
      )
    },
    async claim(id, revision, turn) {
      const value = records.get(id)
      if (value.revision !== revision || value.activeTaskId) return false
      value.turns.push(structuredClone(turn))
      value.activeTaskId = turn.taskId
      value.revision++
      return true
    },
    async settle(id, taskId, fields) {
      const value = records.get(id)
      const turn = value.turns.find((t) => t.taskId === taskId)
      if (!turn) return
      Object.assign(turn, structuredClone(fields))
      value.revision++
      if (value.activeTaskId === taskId) value.activeTaskId = null
    },
  }
  const service = createConversationService({
    store,
    canWrite: async () => allowed,
  })
  return {
    service,
    records,
    revoke: () => {
      allowed = false
    },
  }
}

test('conversations stay private to user/project and recheck revoked access', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p', 'Discussion')
  assert.equal((await f.service.list('u', 'p')).length, 1)
  assert.deepEqual(await f.service.list('other', 'p'), [])
  await assert.rejects(f.service.get('other', 'p', c.id), { status: 404 })
  await assert.rejects(f.service.get('u', 'other', c.id), { status: 404 })
  f.revoke()
  await assert.rejects(f.service.beginTurn('u', 'p', c.id, 'Question'), {
    status: 403,
  })
})

test('only one simultaneous turn is admitted', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  const results = await Promise.allSettled([
    f.service.beginTurn('u', 'p', c.id, 'First'),
    f.service.beginTurn('u', 'p', c.id, 'Second'),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(results.find((r) => r.status === 'rejected').reason.status, 409)
  assert.equal(f.records.get(c.id).turns.length, 1)
})

test('follow-up receives transcript and actual review status, never document snapshots', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  const first = await f.service.beginTurn(
    'u',
    'p',
    c.id,
    'Explain this argument'
  )
  await f.service.recordResult('u', 'p', c.id, {
    taskId: first.turn.taskId,
    status: 'completed',
    summary: 'The key assumption is independence.',
    proposals: [
      {
        path: 'main.tex',
        status: 'rejected',
        before: 'private snapshot',
        after: 'unused',
      },
    ],
  })
  const second = await f.service.beginTurn(
    'u',
    'p',
    c.id,
    'How can I test that assumption?'
  )
  assert.equal(
    second.history.turns[0].assistant,
    'The key assumption is independence.'
  )
  assert.deepEqual(second.history.turns[0].changes, [
    { path: 'main.tex', status: 'rejected' },
  ])
  assert.ok(!JSON.stringify(second.history).includes('private snapshot'))
  await f.service.recordResult('u', 'p', c.id, {
    taskId: first.turn.taskId,
    status: 'completed',
    summary: 'Previous answer',
  })
  assert.equal(f.records.get(c.id).activeTaskId, second.turn.taskId)
})

test('context keeps complete recent turns within limits and reports omissions', () => {
  const turns = Array.from({ length: 20 }, (_, i) => ({
    instruction: `Q${i}`,
    summary: `A${i}`,
    status: 'completed',
  }))
  const context = conversationContext(turns)
  assert.equal(context.turns.length, 12)
  assert.equal(context.omittedTurns, 8)
  assert.equal(context.turns[0].user, 'Q8')
  assert.deepEqual(conversationContext(turns, 1), {
    turns: [],
    omittedTurns: 20,
  })
})

test('full conversation and invalid messages cannot create unbounded storage', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  await assert.rejects(f.service.beginTurn('u', 'p', c.id, ' '.repeat(5)), {
    status: 400,
  })
  await assert.rejects(f.service.beginTurn('u', 'p', c.id, 'a'.repeat(32001)), {
    status: 400,
  })
  f.records.get(c.id).turns = Array(50).fill({ status: 'completed' })
  await assert.rejects(f.service.beginTurn('u', 'p', c.id, 'Next'), {
    status: 409,
  })
})

test('terminal results are idempotent and cancellation cannot be overwritten by late failure', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  const { turn } = await f.service.beginTurn('u', 'p', c.id, 'Question')
  const result = {
    taskId: turn.taskId,
    status: 'cancelled',
    summary: 'Cancelled',
  }
  await f.service.recordResult('u', 'p', c.id, result)
  const revision = f.records.get(c.id).revision
  await f.service.recordResult('u', 'p', c.id, result)
  await f.service.recordResult('u', 'p', c.id, { ...result, status: 'failed' })
  assert.equal(f.records.get(c.id).revision, revision)
  assert.equal(f.records.get(c.id).turns[0].status, 'cancelled')
})

test('stored Unicode summaries and proposal metadata stay below Mongo document limit', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  for (let i = 0; i < 50; i++) {
    const { turn } = await f.service.beginTurn(
      'u',
      'p',
      c.id,
      '文'.repeat(32000)
    )
    await f.service.recordResult('u', 'p', c.id, {
      taskId: turn.taskId,
      status: 'completed',
      summary: '文'.repeat(100000),
      proposals: Array(150).fill({
        path: '文'.repeat(1000),
        status: 'pending',
      }),
    })
  }
  assert.ok(
    Buffer.byteLength(JSON.stringify(f.records.get(c.id))) < 12 * 1024 * 1024
  )
  assert.match(f.records.get(c.id).turns[0].summary, /truncated/)
})

import { createConversationTasks } from '../../app/src/Features/WritingAssist/WritingAssistConversationTasks.mjs'

test('orchestration recovers abandoned reservations and preserves expired transcript', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  await f.service.beginTurn('u', 'p', c.id, 'Interrupted question')
  const tasks = {
    async get() {
      throw Object.assign(new Error('Missing'), { status: 404 })
    },
  }
  const lifecycle = createConversationTasks({ conversations: f.service, tasks })
  assert.ok((await lifecycle.get('u', 'p', c.id)).conversation.activeTaskId)
  f.records.get(c.id).turns[0].createdAt = new Date(Date.now() - 130000)
  const recovered = await lifecycle.get('u', 'p', c.id)
  assert.equal(recovered.conversation.activeTaskId, null)
  assert.equal(recovered.conversation.turns[0].status, 'failed')
  const expired = await lifecycle.get('u', 'p', c.id)
  assert.equal(expired.task, null)
  assert.equal(
    expired.conversation.turns[0].instruction,
    'Interrupted question'
  )
})

test('cancellation before task creation cannot resurrect a reserved turn', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  let lifecycle
  const missing = () => {
    throw Object.assign(new Error('Missing'), { status: 404 })
  }
  const tasks = {
    get: missing,
    cancel: missing,
    async create(u, p, instruction, options) {
      await lifecycle.cancel(u, p, c.id, options.taskId)
      assert.equal(await options.isActive(), false)
      throw Object.assign(new Error('Cancelled'), { status: 409 })
    },
  }
  lifecycle = createConversationTasks({ conversations: f.service, tasks })
  await assert.rejects(lifecycle.send('u', 'p', c.id, 'Question'), {
    status: 409,
  })
  assert.equal(f.records.get(c.id).turns[0].status, 'cancelled')
  assert.equal(f.records.get(c.id).activeTaskId, null)
})

test('conversation review rejects unrelated tasks before contacting the agent', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  const lifecycle = createConversationTasks({
    conversations: f.service,
    tasks: {},
  })
  await assert.rejects(
    lifecycle.decide('u', 'p', c.id, 'foreign', 'proposal', true),
    { status: 404 }
  )
})

test('a late poll cannot revert an accepted proposal to pending', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  const { turn } = await f.service.beginTurn('u', 'p', c.id, 'Edit')
  const result = {
    taskId: turn.taskId,
    status: 'completed',
    summary: 'Suggested change',
    proposals: [{ path: 'main.tex', status: 'accepted' }],
  }
  await f.service.recordResult('u', 'p', c.id, result)
  await f.service.recordResult('u', 'p', c.id, {
    ...result,
    proposals: [{ path: 'main.tex', status: 'pending' }],
  })
  assert.equal(f.records.get(c.id).turns[0].proposals[0].status, 'accepted')
})

test('image bytes reach only the current task while transcript stores metadata', async () => {
  const f = fixture()
  const c = await f.service.create('u', 'p')
  const image = { name: 'formula.png', mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO3sAAAAASUVORK5CYII=' }
  let options
  const lifecycle = createConversationTasks({ conversations: f.service, tasks: {
    async create(_u, _p, _instruction, value) { options = value; return { taskId: value.taskId, status: 'running' } },
  } })
  await lifecycle.send('u', 'p', c.id, 'Transcribe the image', [image])
  assert.equal(options.images[0].data, image.data)
  await f.service.recordResult('u', 'p', c.id, { taskId: options.taskId, status: 'completed', summary: 'Transcribed', proposals: [] })
  const transcript = f.records.get(c.id)
  assert.deepEqual(transcript.turns[0].attachments, [{ name: 'formula.png', mime: 'image/png', width: 1, height: 1 }])
  assert.equal(JSON.stringify(transcript).includes(image.data), false)
  assert.equal(JSON.stringify(conversationContext(transcript.turns)).includes(image.data), false)
  assert.equal(conversationContext(transcript.turns).turns[0].images[0].name, 'formula.png')
})

test('branch points copy only their prefix, freeze inherited turns, and preserve the parent',async()=>{
 const f=fixture();const parent=await f.service.create('u','p','Original');const ids=[]
 for(const instruction of ['First','Second','Later']){const {turn}=await f.service.beginTurn('u','p',parent.id,instruction);ids.push(turn.taskId);await f.service.recordResult('u','p',parent.id,{taskId:turn.taskId,status:'completed',summary:instruction+' answer',proposals:[{path:'main.tex',status:'pending'}]})}
 const before=structuredClone(f.records.get(parent.id));const branch=await f.service.fork('u','p',parent.id,ids[1],'assistant','branch-a');assert.equal(branch.turns.length,2);assert.ok(branch.turns.every(t=>t.inherited));assert.equal(branch.activeTaskId,null);assert.deepEqual(f.records.get(parent.id),before)
 const again=await f.service.fork('u','p',parent.id,ids[1],'assistant','branch-a');assert.equal(again.id,branch.id);assert.equal(f.records.size,2)
 const request=await f.service.fork('u','p',parent.id,ids[1],'user','branch-b');assert.equal(request.turns.length,1)
 const lifecycle=createConversationTasks({conversations:f.service,tasks:{get(){throw Error('Must not load inherited task')}}});assert.equal((await lifecycle.get('u','p',branch.id)).task,null);await assert.rejects(lifecycle.decide('u','p',branch.id,ids[0],'proposal',true),{status:404});await assert.rejects(f.service.fork('other','p',parent.id,ids[1],'user','private'),{status:404})
})

test('retry uses original request settings, fresh task and prefix only; duplicate delivery does not execute twice',async()=>{
 const f=fixture();const parent=await f.service.create('u','p');const request={model:'model',effort:'high',scope:[{kind:'file',path:'main.tex'}],skills:['skill']};const {turn}=await f.service.beginTurn('u','p',parent.id,'Retry this',[],undefined,request);await f.service.recordResult('u','p',parent.id,{taskId:turn.taskId,status:'failed',summary:'failure'});const old=structuredClone(f.records.get(parent.id));const records=new Map();let calls=0
 const missing=()=>{throw Object.assign(Error('expired'),{status:404})}
 const tasks={get:async(u,p,id)=>records.get(id)||missing(),retryRequest:async()=>request,create:async(u,p,instruction,opts)=>{calls++;assert.equal(instruction,'Retry this');assert.equal(opts.model,'model');assert.deepEqual(opts.scope,request.scope);assert.equal(opts.history.turns.length,0);const task={taskId:opts.taskId,status:'running',instruction,proposals:[]};records.set(task.taskId,task);return task}}
 const lifecycle=createConversationTasks({conversations:f.service,tasks});const result=await lifecycle.retry('u','p',parent.id,turn.taskId,{requestId:'retry-branch'});assert.notEqual(result.task.taskId,turn.taskId);await lifecycle.retry('u','p',parent.id,turn.taskId,{requestId:'retry-branch'});assert.equal(calls,1);assert.deepEqual(f.records.get(parent.id),old)
})

test('retry refuses missing images and changed selected text instead of silently losing context',async()=>{
 const f=fixture();const parent=await f.service.create('u','p');const {turn}=await f.service.beginTurn('u','p',parent.id,'Image request',[{name:'a.png'}]);await f.service.recordResult('u','p',parent.id,{taskId:turn.taskId,status:'failed'});const tasks={get:async()=>{throw Object.assign(Error('expired'),{status:404})},retryRequest:async()=>({})};const lifecycle=createConversationTasks({conversations:f.service,tasks});await assert.rejects(lifecycle.retry('u','p',parent.id,turn.taskId,{requestId:'new'}),/reattach/);assert.equal(f.records.size,1)
})
