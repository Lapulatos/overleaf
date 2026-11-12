import test from 'node:test'
import assert from 'node:assert/strict'
import { createAgentWriteTransaction } from '../../app/src/Features/WritingAssist/WritingAssistWriteTransaction.mjs'

const identity = { projectId:'root', workspaceId:'child', branch:'draft', epoch:2 }
function fixture() {
  const events = []
  const state = { identity:{...identity}, allowed:true, lease:true }
  const run = createAgentWriteTransaction({
    readIdentity: async id => { assert.equal(id,'child'); return state.identity },
    authorize: async () => { if (!state.allowed) throw Object.assign(new Error('revoked'),{status:403}) },
    withProjectLock: async (id, action) => {
      assert.equal(id,'root'); events.push('lock'); await state.afterLock?.()
      try { return await action() } finally { events.push('unlock') }
    },
    withPreparedWrite: async (id, epoch, action) => {
      assert.equal(id,'child'); assert.equal(epoch,2); events.push('prepare'); await state.afterPrepare?.()
      try { return await action(async () => { if (!state.lease) throw Object.assign(new Error('expired'),{status:409}) }) }
      finally { events.push('release') }
    },
  })
  return { state, events, run: action => run('user','child',identity,action) }
}

test('validation and mutation run inside project lock and preparation lease', async () => {
  const f=fixture()
  const result=await f.run(async check => { await check(); f.events.push('write'); return 42 })
  assert.equal(result,42)
  assert.deepEqual(f.events,['lock','prepare','write','release','unlock'])
})
for (const phase of ['afterLock','afterPrepare']) {
  for (const change of ['epoch','authorization']) {
    test(`${change} changes during ${phase} prevent mutation`, async () => {
      const f=fixture(); let writes=0
      f.state[phase]=() => { if(change==='epoch') f.state.identity.epoch++; else f.state.allowed=false }
      await assert.rejects(f.run(async () => {writes++}),{status:change==='epoch'?409:403})
      assert.equal(writes,0); assert.equal(f.events.at(-1),'unlock')
    })
  }
}
test('expired lease refuses dispatch and retained transaction capability', async () => {
  const f=fixture(); let retained
  await assert.rejects(f.run(async check => {retained=check; f.state.lease=false; await check()}),{status:409})
  await assert.rejects(retained(),/no longer active/)
})
test('post-mutation lease loss is surfaced rather than returning success', async () => {
  const f=fixture()
  await assert.rejects(f.run(async () => {f.events.push('write'); f.state.lease=false}),{status:502,code:'AI_WRITE_OUTCOME_UNCERTAIN'})
  assert.deepEqual(f.events,['lock','prepare','write','release','unlock'])
})
test('failed preparation never calls mutation', async () => {
  const f=fixture(); let writes=0
  f.state.afterPrepare=() => {throw Object.assign(new Error('offline client'),{status:409})}
  await assert.rejects(f.run(async()=>writes++),{status:409}); assert.equal(writes,0)
})
