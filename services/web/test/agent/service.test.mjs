/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createAgentService,
  buildProposals,
  AgentError,
} from '../../app/src/Features/WritingAssist/WritingAssistAgentService.mjs'

const documents = [
  { id: 'doc', path: 'main.tex', version: 3, content: 'old\n' },
]
const diff = {
  content: '--- a/main.tex\n+++ b/main.tex\n@@ -1 +1 @@\n-old\n+new\n',
}

function fixture() {
  const records = new Map()
  const writes = []
  const creations = []
  const deletions = []
  const state = {
    allowed: true,
    workspaceIdentity: null,
    beforeRead: null,
    allowDeletion: false,
    diffs: [diff],
    deleteError: null,
    version: 3,
    content: 'old\n',
    writeError: null,
    createError: null,
    daemonError: null,
    snapshot: null,
    calls: [],
  }
  const store = {
    async create(task) {
      records.set(task.id, structuredClone(task))
    },
    async find(id, user, project) {
      const task = records.get(id)
      return task?.userId === user && task?.projectId === project
        ? structuredClone(task)
        : null
    },
    async finish(id, fields) {
      const task = records.get(id)
      if (['preparing', 'submitting', 'running'].includes(task.status))
        Object.assign(task, fields)
    },
    async prepare(id, documents) {
      const task = records.get(id)
      if (task.status !== 'preparing') return false
      Object.assign(task, { documents, status: 'submitting' })
      return true
    },
    async markRunning(id) {
      const task = records.get(id)
      if (task.status !== 'submitting') return false
      task.status = 'running'
      return true
    },
    async claim(id, proposalId, status) {
      const proposal = records
        .get(id)
        .proposals.find((p) => p.id === proposalId)
      if (proposal.status !== 'pending') return false
      proposal.status = status
      return true
    },
    claimDeletion: (id, proposalId) => store.claim(id, proposalId, 'applying'),
    async claimDeletionRetry(id, proposalId) {
      const proposal = records.get(id).proposals.find(p => p.id === proposalId)
      if (proposal.mode !== 'delete-document' || proposal.status !== 'uncertain') return false
      proposal.status = 'applying'
      return true
    },
    async settle(id, proposalId, status) {
      records.get(id).proposals.find((p) => p.id === proposalId).status = status
    },
  }
  const service = createAgentService({
    store,
    canWrite: async () => state.allowed,
    readWorkspaceIdentity: async () => structuredClone(state.workspaceIdentity),
    withWriteTransaction: async (_user, _project, _identity, action) =>
      state.transaction ? state.transaction(action) : action(async () => {}),
    allowDeletion: () => state.allowDeletion,
    deleteDocument: async (...args) => {
      deletions.push(args)
      if (state.deleteError) throw state.deleteError
    },
    snapshot: async () =>
      state.snapshot ? await state.snapshot() : structuredClone(documents),
    daemon: async (...args) => {
      state.calls.push(args)
      if (state.daemonError) throw state.daemonError
      return { status: 'completed', summary: 'Revised', diffs: state.diffs }
    },
    readDocument: async () => {
      await state.beforeRead?.()
      return { version: state.version, lines: state.content.split('\n') }
    },
    createDocument: async (...args) => {
      if (state.createError) throw state.createError
      creations.push(args)
    },
    writeDocument: async (...args) => {
      if (state.writeError) throw state.writeError
      writes.push(args)
    },
  })
  async function completed() {
    const task = await service.create(
      'user',
      'project',
      'Polish the manuscript'
    )
    return await service.get('user', 'project', task.taskId)
  }
  return { service, store, state, writes, creations, deletions, records, completed }
}

test('server snapshot becomes a reviewable proposal without writing', async () => {
  const f = fixture()
  const task = await f.completed()
  assert.deepEqual(f.state.calls[0][2].context.documents, documents)
  assert.equal(task.proposals[0].after, 'new\n')
  assert.equal(task.proposals[0].before, 'old\n')
  assert.deepEqual(f.writes, [])
  assert.equal(task.documents, undefined)
})

for (const ending of ['cancel', 'expire']) {
  test(`${ending} during snapshot preparation prevents late model submission`, async () => {
    const f = fixture()
    let release
    f.state.snapshot = () =>
      new Promise((resolve) => {
        release = resolve
      })
    const creation = f.service.create('user', 'project', 'Question', {
      taskId: 'reserved',
    })
    const rejected = assert.rejects(creation, { status: 409 })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(f.records.get('reserved').status, 'preparing')
    if (ending === 'cancel')
      await f.service.cancel('user', 'project', 'reserved')
    else {
      f.records.get('reserved').createdAt = new Date(0)
      const expired = await f.service.get('user', 'project', 'reserved')
      assert.equal(expired.status, 'failed')
    }
    release(structuredClone(documents))
    await rejected
    assert.equal(f.state.calls.length, 0)
    assert.equal(
      f.records.get('reserved').status,
      ending === 'cancel' ? 'cancelled' : 'failed'
    )
  })
}

test('preparing task is visible without mistaking a missing daemon task for failure', async () => {
  const f = fixture()
  let release
  f.state.snapshot = () =>
    new Promise((resolve) => {
      release = resolve
    })
  const creation = f.service.create('user', 'project', 'Question', {
    taskId: 'reserved',
  })
  await new Promise((resolve) => setImmediate(resolve))
  const pending = await f.service.get('user', 'project', 'reserved')
  assert.equal(pending.status, 'running')
  assert.match(pending.output, /Reading project/)
  assert.equal(f.state.calls.length, 0)
  release(structuredClone(documents))
  assert.equal((await creation).status, 'running')
})

test('follow-up includes server conversation history and a new project snapshot', async () => {
  const f = fixture()
  const history = {
    turns: [
      {
        user: 'Why?',
        assistant: 'Because independence.',
        status: 'completed',
        changes: [],
      },
    ],
    omittedTurns: 0,
  }
  const task = await f.service.create('user', 'project', 'Explain further', {
    taskId: 'followup',
    history,
  })
  assert.equal(task.taskId, 'followup')
  assert.deepEqual(f.state.calls[0][2].context.conversation, history)
  assert.deepEqual(f.state.calls[0][2].context.documents, documents)
})

test('permission denial prevents task submission and access after permission revocation', async () => {
  const f = fixture()
  f.state.allowed = false
  await assert.rejects(f.service.create('user', 'project', 'Polish'), {
    status: 403,
  })
  assert.equal(f.state.calls.length, 0)
  f.state.allowed = true
  const task = await f.completed()
  f.state.allowed = false
  await assert.rejects(f.service.get('user', 'project', task.taskId), {
    status: 403,
  })
  await assert.rejects(
    f.service.decide(
      'user',
      'project',
      task.taskId,
      task.proposals[0].id,
      true
    ),
    { status: 403 }
  )
  assert.deepEqual(f.writes, [])
})

test('task identifiers do not allow access from another user or project', async () => {
  const f = fixture()
  const task = await f.completed()
  await assert.rejects(f.service.get('other', 'project', task.taskId), {
    status: 404,
  })
  await assert.rejects(f.service.cancel('user', 'other', task.taskId), {
    status: 404,
  })
})

test('acceptance writes the reviewed snapshot with an expected version exactly once', async () => {
  const f = fixture()
  const task = await f.completed()
  const result = await f.service.decide(
    'user',
    'project',
    task.taskId,
    task.proposals[0].id,
    true
  )
  assert.equal(result.proposals[0].status, 'accepted')
  assert.deepEqual(f.writes, [['project', 'doc', 'user', ['new', ''], 3]])
  await assert.rejects(
    f.service.decide(
      'user',
      'project',
      task.taskId,
      task.proposals[0].id,
      true
    ),
    { status: 409 }
  )
  assert.equal(f.writes.length, 1)
})

test('rejection never writes a document', async () => {
  const f = fixture()
  const task = await f.completed()
  const result = await f.service.decide(
    'user',
    'project',
    task.taskId,
    task.proposals[0].id,
    false
  )
  assert.equal(result.proposals[0].status, 'rejected')
  assert.deepEqual(f.writes, [])
})

for (const action of ['get', 'cancel']) {
  test(`${action}: lost daemon task terminates without writes or resubmission`, async () => {
    const f = fixture()
    const task = await f.service.create('user', 'project', 'Polish')
    f.state.daemonError = new AgentError(502, 'Lost', 'TASK_NOT_FOUND')
    const result = await f.service[action]('user', 'project', task.taskId)
    assert.equal(result.status, 'failed')
    assert.match(result.summary, /may have restarted/)
    assert.deepEqual(result.proposals, [])
    assert.deepEqual(f.writes, [])
    assert.equal(f.state.calls.filter((call) => call[1] === 'POST').length, 1)
    const calls = f.state.calls.length
    assert.equal(
      (await f.service.get('user', 'project', task.taskId)).status,
      'failed'
    )
    assert.equal(f.state.calls.length, calls)
  })
}

test('temporary daemon failure leaves a task recoverable', async () => {
  const f = fixture()
  const task = await f.service.create('user', 'project', 'Polish')
  f.state.daemonError = new AgentError(502, 'Unreachable')
  await assert.rejects(f.service.get('user', 'project', task.taskId), {
    status: 502,
  })
  assert.equal(f.records.get(task.taskId).status, 'running')
  f.state.daemonError = null
  const result = await f.service.get('user', 'project', task.taskId)
  assert.equal(result.status, 'completed')
  assert.equal(result.proposals.length, 1)
  assert.deepEqual(f.writes, [])
})

for (const when of ['before-read', 'during-write']) {
  test(`collaborative edit ${when} prevents acceptance`, async () => {
    const f = fixture()
    const task = await f.completed()
    if (when === 'before-read') f.state.version++
    else f.state.writeError = { response: { status: 409 } }
    await assert.rejects(
      f.service.decide(
        'user',
        'project',
        task.taskId,
        task.proposals[0].id,
        true
      ),
      { status: 409 }
    )
    assert.deepEqual(f.writes, [])
    assert.equal(
      (await f.service.get('user', 'project', task.taskId)).proposals[0].status,
      'conflict'
    )
  })
}

test('an uncertain write is not retried by clicking accept again', async () => {
  const f = fixture()
  const task = await f.completed()
  f.state.writeError = new Error('connection lost')
  await assert.rejects(
    f.service.decide(
      'user',
      'project',
      task.taskId,
      task.proposals[0].id,
      true
    ),
    { status: 502 }
  )
  f.state.writeError = null
  await assert.rejects(
    f.service.decide(
      'user',
      'project',
      task.taskId,
      task.proposals[0].id,
      true
    ),
    { status: 409 }
  )
  assert.deepEqual(f.writes, [])
})

for (const invalid of [
  diff.content.replaceAll('main.tex', '../main.tex'),
  diff.content.replace('-old', '-unrelated'),
  diff.content.replace('@@ -1 +1 @@', '@@ -2 +2 @@'),
  diff.content.replace('+++ b/main.tex', '+++ b/renamed.tex'),
]) {
  test(`rejects unsafe patch ${JSON.stringify(invalid.slice(0, 65))}`, () => {
    assert.throws(() => buildProposals([{ content: invalid }], documents))
  })
}

for (const accept of [false, true]) {
  test(`bibliography creation requires explicit review: accept=${accept}`, async () => {
    const f = fixture()
    f.records.set('import', {
      id: 'import',
      userId: 'user',
      projectId: 'project',
      status: 'completed',
      proposals: [
        {
          id: 'proposal',
          mode: 'create-bibliography',
          path: 'references.bib',
          before: '',
          after: '@article{key, title={Title}}',
          status: 'pending',
        },
      ],
    })
    await f.service.decide('user', 'project', 'import', 'proposal', accept)
    assert.equal(f.creations.length, accept ? 1 : 0)
    assert.equal(f.writes.length, 0)
    await assert.rejects(
      f.service.decide('user', 'project', 'import', 'proposal', true),
      { status: 409 }
    )
  })
}
test('new bibliography name collision becomes conflict without retrying creation', async () => {
  const f = fixture()
  f.records.set('import', {
    id: 'import',
    userId: 'user',
    projectId: 'project',
    status: 'completed',
    proposals: [
      {
        id: 'proposal',
        mode: 'create-bibliography',
        path: 'references.bib',
        before: '',
        after: 'new',
        status: 'pending',
      },
    ],
  })
  f.state.createError = new AgentError(409, 'File exists')
  await assert.rejects(
    f.service.decide('user', 'project', 'import', 'proposal', true),
    { status: 409 }
  )
  assert.equal(f.records.get('import').proposals[0].status, 'conflict')
  assert.equal(f.creations.length, 0)
})

test('model catalog requires project write authorization before querying daemon', async () => {
  const { service, state } = fixture()
  state.allowed = false
  await assert.rejects(service.models('user', 'project'), error => error.status === 403)
  assert.equal(state.calls.length, 0)
  state.allowed = true
  await service.models('user', 'project')
  assert.deepEqual(state.calls[0], ['/agent/models', 'GET'])
})

test('new document proposals validate paths and reject case-insensitive collisions', () => {
  const [proposal] = buildProposals([{kind:'create',path:'sections/new.tex',content:'New section\n'}], documents)
  assert.equal(proposal.mode,'create-document');assert.equal(proposal.before,'');assert.equal(proposal.after,'New section\n')
  for (const path of ['../new.tex','Main.tex','AGENTS.md']) assert.throws(()=>buildProposals([{kind:'create',path,content:'new'}],documents))
  assert.throws(()=>buildProposals([{kind:'create',path:'new.tex',content:'a'},{kind:'create',path:'NEW.tex',content:'b'}],documents))
  assert.throws(()=>buildProposals([{kind:'delete',path:'main.tex',content:diff.content}],documents))
})
for (const accept of [false,true]) test(`new manuscript files require explicit review: accept=${accept}`,async()=>{
  const {service,creations,records,completed}=fixture()
  const task=await completed()
  const [proposal]=buildProposals([{kind:'create',path:'sections/new.tex',content:'New\n'}],documents)
  records.get(task.taskId).proposals=[proposal]
  assert.equal(creations.length,0)
  await service.decide('user','project',task.taskId,proposal.id,accept)
  assert.equal(creations.length,accept?1:0)
  if(accept)assert.deepEqual(creations[0],['project','sections/new.tex',['New',''],'user'])
  await assert.rejects(service.decide('user','project',task.taskId,proposal.id,true),error=>error.status===409)
})
test('new document collision at acceptance becomes a conflict and cannot be retried',async()=>{
  const {service,creations,records,state,completed}=fixture()
  const task=await completed()
  const [proposal]=buildProposals([{kind:'create',path:'new.tex',content:'New'}],documents)
  records.get(task.taskId).proposals=[proposal]
  state.createError=new AgentError(409,'A file with this name already exists')
  await assert.rejects(service.decide('user','project',task.taskId,proposal.id,true),error=>error.status===409)
  assert.equal(creations.length,0);assert.equal(records.get(task.taskId).proposals[0].status,'conflict')
  state.createError=null
  await assert.rejects(service.decide('user','project',task.taskId,proposal.id,true),error=>error.status===409)
  assert.equal(creations.length,0)
})

test('explicit deletion proposals bind the complete snapshot and remain disabled by default',()=>{
 const deletion={kind:'delete',path:'main.tex',content:'old\n',version:3}
 assert.throws(()=>buildProposals([deletion],documents),{status:422})
 const [proposal]=buildProposals([deletion],documents,{allowDeletion:true})
 assert.equal(proposal.mode,'delete-document');assert.equal(proposal.docId,'doc')
 assert.equal(proposal.before,'old\n');assert.equal(proposal.after,'')
 for(const changed of [{content:''},{version:4},{path:'other.tex'}]) {
  assert.throws(()=>buildProposals([{...deletion,...changed}],documents,{allowDeletion:true}),{status:422})
 }
 assert.throws(()=>buildProposals([deletion,deletion],documents,{allowDeletion:true}),{status:422})
})
test('deletion acceptance calls the deletion adapter and never writes an empty document',async()=>{
 const f=fixture();f.state.allowDeletion=true
 f.state.diffs=[{kind:'delete',path:'main.tex',content:'old\n',version:3}]
 const task=await f.completed()
 assert.equal(f.deletions.length,0)
 await f.service.decide('user','project',task.taskId,task.proposals[0].id,true)
 assert.equal(f.deletions.length,1);assert.equal(f.writes.length,0)
 assert.equal(f.records.get(task.taskId).proposals[0].status,'accepted')
})
test('uncertain deletion retries the same proposal and rechecks authorization',async()=>{
 const f=fixture();f.state.allowDeletion=true
 f.state.diffs=[{kind:'delete',path:'main.tex',content:'old\n',version:3}]
 const task=await f.completed();const proposalId=task.proposals[0].id
 f.state.deleteError=new Error('response lost')
 await assert.rejects(f.service.decide('user','project',task.taskId,proposalId,true),{code:'DELETION_UNCERTAIN'})
 assert.equal(f.records.get(task.taskId).proposals[0].status,'uncertain')
 f.state.allowed=false
 await assert.rejects(f.service.decide('user','project',task.taskId,proposalId,true),{status:403})
 assert.equal(f.deletions.length,1)
 f.state.allowed=true;f.state.deleteError=null
 await f.service.decide('user','project',task.taskId,proposalId,true)
 assert.equal(f.deletions.length,2)
 assert.equal(f.deletions[0][3].id,f.deletions[1][3].id)
 assert.equal(f.records.get(task.taskId).proposals[0].status,'accepted')
})

test('proven aborted deletion settles conflict instead of offering recovery',async()=>{
 const f=fixture();f.state.allowDeletion=true
 f.state.diffs=[{kind:'delete',path:'main.tex',content:'old\n',version:3}]
 const task=await f.completed();const proposalId=task.proposals[0].id
 f.state.deleteError=Object.assign(new Error('snapshot changed'),{code:'DELETION_SNAPSHOT_CONFLICT',status:409})
 await assert.rejects(f.service.decide('user','project',task.taskId,proposalId,true),{status:409,code:'DELETION_SNAPSHOT_CONFLICT'})
 assert.equal(f.records.get(task.taskId).proposals[0].status,'conflict')
 await assert.rejects(f.service.decide('user','project',task.taskId,proposalId,true),{status:409})
 assert.equal(f.deletions.length,1)
})


test('deletion settlement failure returns a stable error and preserves the original cause', async () => {
 for (const deleteError of [null, new Error('lost response'), Object.assign(new Error('changed'),{code:'DELETION_SNAPSHOT_CONFLICT'})]) {
  const f=fixture();f.state.allowDeletion=true
  f.state.diffs=[{kind:'delete',path:'main.tex',content:'old\n',version:3}]
  const task=await f.completed();f.state.deleteError=deleteError
  const failure=new Error('internal cleanup unavailable')
  f.store.settle=async()=>{throw failure}
  await assert.rejects(f.service.decide('user','project',task.taskId,task.proposals[0].id,true),error=>{
   assert.equal(error.status,502);assert.equal(error.code,'DELETION_UNCERTAIN')
   assert.equal(error.cause,failure);assert.ok(!error.message.includes('internal cleanup'))
   return true
  })
  assert.equal(f.records.get(task.taskId).proposals[0].status,'applying')
  assert.equal(f.deletions.length,1);assert.equal(f.writes.length,0)
 }
})

test('reference report discards model edits and supplies only scoped evidence', async () => {
  const f = fixture()
  const scoped = [{ id: 'evidence', path: 'evidence.json', version: 0, content: '{}'}]
  const started = await f.service.create('user', 'project', 'Check reference metadata only', { reportOnly: true, prepareDocuments: () => scoped })
  assert.equal(f.records.get(started.taskId).reportOnly, true)
  assert.deepEqual(f.state.calls[0][2].context.documents, scoped)
  const done = await f.service.get('user', 'project', started.taskId)
  assert.equal(done.status, 'completed')
  assert.deepEqual(done.proposals, [])
  assert.deepEqual(f.writes, [])
})


test('read-only goal review includes project images while metadata reports remain evidence-only',async()=>{
 for(const includeProjectAssets of [false,true]){
  let record,payload,reads=0
  const service=createAgentService({canWrite:async()=>true,snapshot:async()=>documents,snapshotAssets:async()=>{reads++;return [{path:'figures/diagram.png',data:'aW1hZ2U='}]},store:{create:async t=>{record=t},find:async()=>record,prepare:async()=>true,markRunning:async()=>true,finish:async(id,f)=>Object.assign(record,f)},daemon:async(path,method,body)=>{if(path==='/agent/health')return {capabilities:{documentHarness:true}};if(method==='POST'){payload=body;return {}};return {status:'completed',summary:'Reviewed',diffs:[diff]}}})
  const task=await service.create('u','p','Review goal',{reportOnly:true,includeProjectAssets})
  assert.equal(reads,includeProjectAssets?1:0)
  assert.equal(Boolean(payload.context.assets?.some(a=>a.path==='figures/diagram.png')),includeProjectAssets)
  const result=await service.get('u','p',task.taskId);assert.deepEqual(result.proposals,[])
 }
})


test('large activity previews do not hide later execution events',async()=>{
 const {boundedActivity}=await import('../../app/src/Features/WritingAssist/WritingAssistActivity.mjs')
 const events=boundedActivity([{id:'a',kind:'files',title:'Edit',status:'completed',changes:[{after:'x'.repeat(5000)}]},{id:'b',kind:'command',title:'Compile',status:'running'}],1000)
 assert.equal(events.length,2);assert.equal(events[0].truncated,true);assert.equal(events[1].id,'b')
})

test('export-only conversion cannot apply any changes to the original project',async()=>{
 const {service,writes}=fixture();const started=await service.create('user','project','convert',{exportOnly:true});const task=await service.get('user','project',started.taskId);assert.equal(task.status,'completed');await assert.rejects(service.decide('user','project',task.taskId,task.proposals[0].id,true),/original cannot be modified/);assert.equal(writes.length,0)
})

test('conversion snapshot supplies the authoritative entry file to the model',async()=>{
 let record,payload
 const service=createAgentService({canWrite:async()=>true,snapshot:async()=>documents,snapshotAssets:async()=>[],store:{create:async t=>{record=t},find:async()=>record,prepare:async()=>true,markRunning:async()=>true,finish:async(id,f)=>Object.assign(record,f)},daemon:async(path,method,body)=>{if(path==='/agent/health')return {capabilities:{documentHarness:true}};if(method==='POST'){payload=body;return {}};return {status:'completed',summary:'Reviewed',diffs:[]}}})
 await service.create('user','project','Convert manuscript',{captureSnapshot:async()=>({instructionSuffix:'\nSERVER-CONFIRMED ENTRY FILE: nested/main.tex'})})
 assert.ok(payload.instruction.endsWith('SERVER-CONFIRMED ENTRY FILE: nested/main.tex'))
})

test('Track audit metadata persists and report-only tasks discard model edits',async()=>{const f=fixture();const trackReview={snapshot:{venueId:'track-id',evidence:[]},mode:'check'};const started=await f.service.create('user','project','TRACK_REQUIREMENTS_REVIEW_V1',{reportOnly:true,trackReview});assert.deepEqual(f.records.get(started.taskId).trackReview,trackReview);const done=await f.service.get('user','project',started.taskId);assert.deepEqual(done.proposals,[]);assert.deepEqual(f.writes,[])})

test('issue status commands complete without daemon or manuscript snapshots after project authorization',async()=>{
 const records=new Map();let daemonCalls=0,resolveCalls=0
 const service=createAgentService({store:{create:async t=>records.set(t.id,t)},canWrite:async(u)=>u==='owner',resolveRequest:async()=>{resolveCalls++;return {summary:'Issue resolved by user'}},snapshot:async()=>{throw Error('must not snapshot')},daemon:async()=>{daemonCalls++}})
 await assert.rejects(service.create('other','p','/close-issue ID'),e=>e.status===403)
 assert.equal(resolveCalls,0)
 const task=await service.create('owner','p','/close-issue ID',{taskId:'command-task'})
 assert.equal(task.status,'completed');assert.deepEqual(task.proposals,[]);assert.equal(task.taskId,'command-task');assert.equal(daemonCalls,0);assert.equal(records.size,1)
})

const taskWorkspace = { projectId: 'root', workspaceId: 'project', branch: 'draft', epoch: 4 }

test('AI task persists and returns its server workspace identity', async () => {
  const f = fixture()
  f.state.workspaceIdentity = { ...taskWorkspace }
  const task = await f.completed()
  assert.deepEqual(task.workspaceIdentity, taskWorkspace)
  assert.deepEqual(f.records.get(task.taskId).workspaceIdentity, taskWorkspace)
  await f.service.decide('user', 'project', task.taskId, task.proposals[0].id, true)
  assert.equal(f.writes.length, 1)
})

for (const change of ['epoch', 'branch', 'workspaceId', 'projectId', 'legacy']) {
  test(`AI acceptance refuses changed ${change} without writing`, async () => {
    const f = fixture()
    f.state.workspaceIdentity = { ...taskWorkspace }
    const task = await f.completed()
    if (change === 'legacy') delete f.records.get(task.taskId).workspaceIdentity
    else f.state.workspaceIdentity[change] = change === 'epoch' ? 5 : 'different'
    await assert.rejects(f.service.decide('user', 'project', task.taskId, task.proposals[0].id, true),
      { status: 409, code: 'AI_WORKSPACE_CHANGED' })
    assert.equal(f.writes.length, 0)
    assert.equal(f.records.get(task.taskId).proposals[0].status, 'conflict')
  })
}

test('workspace epoch change during snapshot stops model submission', async () => {
  const f = fixture()
  f.state.workspaceIdentity = { ...taskWorkspace }
  f.state.snapshot = async () => { f.state.workspaceIdentity.epoch++; return structuredClone(documents) }
  await assert.rejects(f.service.create('user', 'project', 'Edit'), { code: 'AI_WORKSPACE_CHANGED' })
  assert.equal(f.state.calls.some(call => call[0] === '/agent/task'), false)
  assert.equal(f.writes.length, 0)
})

for (const change of ['epoch', 'authorization']) {
  test(`AI acceptance rechecks ${change} after document read`, async () => {
    const f = fixture()
    f.state.workspaceIdentity = { ...taskWorkspace }
    const task = await f.completed()
    f.state.beforeRead = () => {
      if (change === 'epoch') f.state.workspaceIdentity.epoch++
      else f.state.allowed = false
    }
    await assert.rejects(f.service.decide('user', 'project', task.taskId, task.proposals[0].id, true),
      { status: change === 'epoch' ? 409 : 403 })
    assert.equal(f.writes.length, 0)
  })
}

for (const mode of ['create-document', 'create-bibliography', 'delete-document']) {
  test(`stale workspace cannot bypass identity check through ${mode}`, async () => {
    const f = fixture()
    f.state.workspaceIdentity = { ...taskWorkspace }
    f.state.allowDeletion = true
    const task = await f.completed()
    f.records.get(task.taskId).proposals[0].mode = mode
    f.state.workspaceIdentity.epoch++
    await assert.rejects(f.service.decide('user', 'project', task.taskId, task.proposals[0].id, true),
      {code:'AI_WORKSPACE_CHANGED'})
    assert.deepEqual([f.writes.length,f.creations.length,f.deletions.length], [0,0,0])
  })
}

test('AI acceptance keeps validation and mutation inside transaction and settles afterwards', async () => {
  const f=fixture(), events=[]
  const task=await f.completed()
  f.state.transaction=async action => {
    events.push('enter')
    await action(async () => events.push('lease'))
    assert.equal(f.writes.length,1)
    assert.equal(f.records.get(task.taskId).proposals[0].status,'applying')
    events.push('release')
  }
  await f.service.decide('user','project',task.taskId,task.proposals[0].id,true)
  assert.equal(events[0],'enter'); assert.equal(events.at(-1),'release')
  assert.equal(f.records.get(task.taskId).proposals[0].status,'accepted')
})

test('transaction failure after AI mutation retains uncertain proposal and prevents replay', async () => {
  const f=fixture(), task=await f.completed()
  f.state.transaction=async action => {
    await action(async()=>{})
    throw Object.assign(new Error('release failed'),{status:502,code:'AI_WRITE_OUTCOME_UNCERTAIN'})
  }
  await assert.rejects(f.service.decide('user','project',task.taskId,task.proposals[0].id,true),{status:502})
  assert.equal(f.writes.length,1)
  assert.equal(f.records.get(task.taskId).proposals[0].status,'uncertain')
  await assert.rejects(f.service.decide('user','project',task.taskId,task.proposals[0].id,true),{status:409})
  assert.equal(f.writes.length,1)
})

test('report tasks reject evidence captured in an older workspace before persistence',async()=>{
 const f=fixture();f.state.workspaceIdentity={...taskWorkspace,epoch:5}
 await assert.rejects(f.service.create('user','project','Audit',{reportOnly:true,expectedWorkspaceIdentity:taskWorkspace}),{code:'AI_WORKSPACE_CHANGED'})
 assert.equal(f.records.size,0);assert.equal(f.state.calls.length,0)
})

test('application acknowledgement follows server write and precedes settlement',async()=>{
 const f=fixture(),task=await f.completed(),events=[]
 f.store.recordApplicationAcknowledgement=async(saved,proposal)=>{
  assert.equal(f.writes.length,1);assert.equal(saved.id,task.taskId)
  assert.equal(f.records.get(saved.id).proposals[0].status,'applying')
  events.push(proposal.id)
 }
 await f.service.decide('user','project',task.taskId,task.proposals[0].id,true)
 assert.deepEqual(events,[task.proposals[0].id]);assert.equal(f.records.get(task.taskId).proposals[0].status,'accepted')
})

test('server mutation error never records acknowledgement',async()=>{
 const f=fixture(),task=await f.completed();let acknowledgements=0
 f.store.recordApplicationAcknowledgement=async()=>{acknowledgements++}
 f.state.writeError=Error('response lost')
 await assert.rejects(f.service.decide('user','project',task.taskId,task.proposals[0].id,true),{status:502})
 assert.equal(acknowledgements,0);assert.equal(f.records.get(task.taskId).proposals[0].status,'uncertain')
})

test('acknowledged operation retains its journal when final settlement fails',async()=>{
 const f=fixture(),task=await f.completed();let journal=false
 f.store.recordApplicationAcknowledgement=async()=>{journal=true}
 const settle=f.store.settle
 f.store.settle=async(id,pid,status)=>{if(status==='accepted')throw Error('settlement unavailable');return settle(id,pid,status)}
 await assert.rejects(f.service.decide('user','project',task.taskId,task.proposals[0].id,true),{status:502})
 assert.equal(journal,true);assert.equal(f.writes.length,1);assert.equal(f.records.get(task.taskId).proposals[0].status,'uncertain')
})
