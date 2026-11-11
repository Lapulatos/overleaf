/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createDocumentDeletionCoordinator } from '../../app/src/Features/WritingAssist/DocumentDeletionCoordinator.mjs'
import { createDocumentDeletionReservations } from '../../app/src/Features/WritingAssist/DocumentDeletionReservations.mjs'

function fixture() {
  const rows = new Map(); const events = []
  const collection = {
    async findOne(query) { return structuredClone(rows.get(query._id)) },
    async updateOne(query, update, options = {}) {
      const row = rows.get(query._id)
      if (!row && options.upsert) rows.set(query._id, { _id: query._id, ...structuredClone(update.$setOnInsert) })
      else if (row && Object.entries(query).every(([key,value]) => row[key] === value)) Object.assign(row, structuredClone(update.$set || {}))
    },
    async deleteOne(query) {
      const row = rows.get(query._id)
      if (!row || !Object.entries(query).every(([key,value]) => row[key] === value)) return { deletedCount: 0 }
      rows.delete(query._id)
      return { deletedCount: 1 }
    },
  }
  const input = { projectId:'a'.repeat(24), docId:'b'.repeat(24), userId:'c'.repeat(24), taskId:randomUUID(), proposalId:randomUUID(), expectedVersion:3, path:'chapter.tex', baseHash:createHash('sha256').update('original').digest('hex') }
  const reservations = createDocumentDeletionReservations(collection)
  let queue=Promise.resolve(); let removed=false; let commits=0
  const adapters = {
    reservations, preflightHistory: async () => {},
    authorize: async () => {}, verifyAcceptedProposal: async () => {},
    withProjectLock: (id, action) => { const next=queue.then(action);queue=next.catch(()=>{});return next },
    prepareDocument: async (projectId,docId,operationId) => {
      assert.equal(projectId,input.projectId);assert.equal(docId,input.docId)
      await reservations.markFenced(input,operationId)
      events.push('prepare')
      return reservations.markCommitting(input,operationId)
    },
    inspectDeletion: async () => removed,
    commitDeletion: async (input,row) => {assert.equal(row.state,'committing');events.push('commit');commits++;removed=true},
  }
  return {input,adapters,reservations,events,rows,run:()=>createDocumentDeletionCoordinator(adapters)(input),commits:()=>commits}
}

test('normal acceptance prepares through DU then commits once',async()=>{
 const f=fixture()
 const [a,b]=await Promise.all([f.run(),f.run()])
 assert.equal(a.operationId,b.operationId)
 assert.equal(a.state,'committed');assert.equal(b.state,'committed')
 assert.deepEqual(f.events,['prepare','commit'])
 assert.equal(f.commits(),1)
})
test('preparation conflict never commits or removes the service reservation',async()=>{
 const f=fixture()
 f.adapters.prepareDocument=async(projectId,docId,operationId)=>{
  await f.reservations.markFenced(f.input,operationId)
  throw Object.assign(new Error('CAS conflict'),{status:409})
 }
 await assert.rejects(f.run(),{status:409})
 assert.equal((await f.reservations.read(f.input)).state,'fenced')
 assert.equal(f.commits(),0)
})
test('lost preparation response recovers durable committing without a new operation',async()=>{
 const f=fixture()
 const normal=f.adapters.prepareDocument
 f.adapters.prepareDocument=async(...args)=>{await normal(...args);throw new Error('response lost')}
 await assert.rejects(f.run(),/response lost/)
 const before=await f.reservations.read(f.input)
 const after=await f.run()
 assert.equal(before.operationId,after.operationId);assert.equal(after.state,'committed')
 assert.deepEqual(f.events,['prepare','commit'])
})
test('wrong response binding or an unpersisted acknowledgement never permits commit',async()=>{
 for(const changed of [{projectId:'d'.repeat(24)},{docId:'e'.repeat(24)},{operationId:randomUUID()},{state:'fenced'},{}]) {
  const f=fixture()
  f.adapters.prepareDocument=async(projectId,docId,operationId)=>({projectId,docId,operationId,state:'committing',...changed})
  await assert.rejects(f.run(),error=>[409,502].includes(error.status))
  assert.equal(f.commits(),0)
  assert.equal((await f.reservations.read(f.input)).state,'preparing')
 }
})
test('lost native commit response is reconciled without repeating a completed deletion',async()=>{
 const f=fixture(); const normal=f.adapters.commitDeletion
 f.adapters.commitDeletion=async(...args)=>{await normal(...args);throw new Error('response lost')}
 await assert.rejects(f.run(),/response lost/)
 assert.equal((await f.reservations.read(f.input)).state,'committing')
 assert.equal((await f.run()).state,'committed')
 assert.equal(f.commits(),1)
})
test('unverified native postconditions remain committing for explicit recovery',async()=>{
 const f=fixture();f.adapters.inspectDeletion=async()=>false
 await assert.rejects(f.run(),{status:502})
 assert.equal((await f.reservations.read(f.input)).state,'committing')
})
test('revocation and unaccepted proposals are rejected before record creation',async()=>{
 for(const method of ['authorize','verifyAcceptedProposal']) {
  const f=fixture();f.adapters[method]=async()=>{throw Object.assign(new Error('denied'),{status:403})}
  await assert.rejects(f.run(),{status:403});assert.equal(f.rows.size,0);assert.equal(f.commits(),0)
 }
})
test('revocation before native commit leaves protection and does not delete',async()=>{
 const f=fixture();let checks=0
 f.adapters.authorize=async()=>{if(++checks===4)throw Object.assign(new Error('revoked'),{status:403})}
 await assert.rejects(f.run(),{status:403})
 assert.equal((await f.reservations.read(f.input)).state,'committing')
 assert.equal(f.commits(),0)
})

test('notification failure retries from committed without repeating deletion',async()=>{
 const f=fixture()
 let notifications=0
 f.adapters.notifyCommitted=async(input,row)=>{
  assert.equal(row.state,'committed')
  if(++notifications===1)throw new Error('publish failed')
 }
 await assert.rejects(f.run(),/publish failed/)
 assert.equal((await f.reservations.read(f.input)).state,'committed')
 assert.equal((await f.run()).state,'committed')
 assert.equal(f.commits(),1)
 assert.equal(notifications,2)
})
test('unconfirmed deletion never emits a committed notification',async()=>{
 const f=fixture()
 let notifications=0
 f.adapters.notifyCommitted=async()=>{notifications++}
 f.adapters.inspectDeletion=async()=>false
 await assert.rejects(f.run(),{status:502})
 assert.equal(notifications,0)
})

test('unavailable history fails before reservation or document preparation', async () => {
 const f=fixture()
 f.adapters.preflightHistory=async()=>{throw new Error('history unavailable')}
 await assert.rejects(f.run(), /history unavailable/)
 assert.equal(f.rows.size,0)
 assert.deepEqual(f.events,[])
})
test('preparing retry rechecks history while fenced recovery skips preflight', async () => {
 const f=fixture()
 const receipt=await f.reservations.begin(f.input)
 f.adapters.preflightHistory=async()=>{throw new Error('history unavailable')}
 await assert.rejects(f.run(), /history unavailable/)
 assert.equal((await f.reservations.read(f.input)).state,'preparing')
 await f.reservations.markFenced(f.input,receipt.operationId)
 assert.equal((await f.run()).state,'committed')
})

test('definitive preparation conflict with released reservation is terminal',async()=>{
 const f=fixture()
 f.adapters.prepareDocument=async(projectId,docId,operationId)=>{
  await f.reservations.releasePreparing(f.input,operationId)
  throw Object.assign(new Error('snapshot changed'),{response:{status:409}})
 }
 await assert.rejects(f.run(),{status:409,code:'DELETION_SNAPSHOT_CONFLICT'})
 assert.equal(await f.reservations.find(f.input),null)
 assert.equal(f.commits(),0)
})
test('absence alone does not turn a lost response into a terminal conflict',async()=>{
 const f=fixture()
 f.adapters.prepareDocument=async(projectId,docId,operationId)=>{
  await f.reservations.releasePreparing(f.input,operationId)
  throw new Error('response lost')
 }
 await assert.rejects(f.run(),error=>error.message==='response lost' && !error.code)
 assert.equal(f.commits(),0)
})

test('existing-only recovery never creates a replacement reservation',async()=>{
 const f=fixture()
 await assert.rejects(createDocumentDeletionCoordinator(f.adapters)(f.input,{existingOperationId:randomUUID()}),{status:409})
 assert.equal(f.rows.size,0);assert.equal(f.commits(),0)
})
test('existing-only recovery rejects another operation and resumes the matching one',async()=>{
 const f=fixture();const row=await f.reservations.begin(f.input)
 const execute=createDocumentDeletionCoordinator(f.adapters)
 await assert.rejects(execute(f.input,{existingOperationId:randomUUID()}),{status:409})
 assert.equal(f.commits(),0)
 const result=await execute(f.input,{existingOperationId:row.operationId})
 assert.equal(result.operationId,row.operationId);assert.equal(result.state,'committed')
})

test('new accepted deletion persists the admitted operation identity before preparation', async () => {
  const f = fixture()
  const operationId = randomUUID()
  f.adapters.admitDeletion = async input => { f.events.push('admit'); return { ...input, operationId } }
  const result = await f.run()
  assert.equal(result.operationId, operationId)
  assert.deepEqual(f.events, ['admit', 'prepare', 'commit'])
  f.adapters.admitDeletion = async () => { throw new Error('closed') }
  assert.equal((await f.run()).operationId, operationId)
})

test('failed preflight retains the same admitted identity for the eventual retry', async () => {
  const f = fixture()
  const operationId = randomUUID()
  f.adapters.admitDeletion = async input => ({ ...input, operationId })
  f.adapters.preflightHistory = async () => { throw new Error('history unavailable') }
  await assert.rejects(f.run(), /history unavailable/)
  assert.equal(f.rows.size, 0)
  f.adapters.preflightHistory = async () => {}
  assert.equal((await f.run()).operationId, operationId)
})

test('closed admission or malformed acknowledgement cannot create a reservation', async () => {
  const variants = [null, {}, { operationId: 'bad' }, { operationId: randomUUID(), path: 'other.tex' }]
  for (const variant of variants) {
    const f = fixture()
    f.adapters.admitDeletion = async input => variant === null ? null : { ...input, ...variant }
    await assert.rejects(f.run(), { status: 502 })
    assert.equal(f.rows.size, 0)
    assert.equal(f.commits(), 0)
  }
  const f = fixture()
  f.adapters.admitDeletion = async () => { throw Object.assign(new Error('closed'), { status: 409 }) }
  await assert.rejects(f.run(), { status: 409 })
  assert.equal(f.rows.size, 0)
})

test('unauthorized requests and existing-only recovery never mint a ticket', async () => {
  for (const method of ['authorize', 'verifyAcceptedProposal']) {
    const f = fixture()
    f.adapters[method] = async () => { throw Object.assign(new Error('denied'), { status: 403 }) }
    f.adapters.admitDeletion = async () => { assert.fail('admission before authorization') }
    await assert.rejects(f.run(), { status: 403 })
  }
  const f = fixture()
  f.adapters.admitDeletion = async () => { assert.fail('existing-only recovery allocated admission') }
  await assert.rejects(createDocumentDeletionCoordinator(f.adapters)(f.input, { existingOperationId: randomUUID() }), { status: 409 })
})

test('a proposal settled while waiting for the lock cannot obtain fresh admission', async () => {
  const f = fixture()
  let settled = false
  f.adapters.verifyAcceptedProposal = async () => {
    if (settled) throw Object.assign(new Error('proposal settled'), { status: 409 })
  }
  f.adapters.withProjectLock = async (_id, action) => { settled = true; return action() }
  f.adapters.admitDeletion = async () => { assert.fail('settled proposal admitted') }
  await assert.rejects(f.run(), { status: 409 })
  assert.equal(f.rows.size, 0)
})

test('a proposal settled during preflight cannot begin a new reservation', async () => {
  const f = fixture()
  let settled = false
  f.adapters.admitDeletion = async input => ({ ...input, operationId: randomUUID() })
  f.adapters.verifyAcceptedProposal = async () => {
    if (settled) throw Object.assign(new Error('proposal settled'), { status: 409 })
  }
  f.adapters.preflightHistory = async () => { settled = true }
  await assert.rejects(f.run(), { status: 409 })
  assert.equal(f.rows.size, 0)
})


test('admitted recovery fills a missing reservation with the original ticket UUID', async () => {
 const f=fixture();const operationId=randomUUID();let reads=0
 f.adapters.readAdmission=async(input,id)=>{reads++;assert.equal(id,operationId);return {...input,operationId}}
 f.adapters.admitDeletion=async()=>assert.fail('recovery must not admit new work')
 const result=await createDocumentDeletionCoordinator(f.adapters)(f.input,{admittedOperationId:operationId})
 assert.equal(result.operationId,operationId);assert.equal(result.state,'committed');assert.equal(reads,2)
})
test('admitted recovery rejects missing ticket, wrong binding and wrong operation', async () => {
 for(const variant of [null,{operationId:randomUUID()},{path:'other.tex'}]) {
  const f=fixture();const operationId=randomUUID()
  f.adapters.readAdmission=async()=>variant===null?null:{...f.input,operationId,...variant}
  await assert.rejects(createDocumentDeletionCoordinator(f.adapters)(f.input,{admittedOperationId:operationId}))
  assert.equal(f.rows.size,0);assert.equal(f.commits(),0)
 }
})
test('admitted recovery rechecks the ticket after preflight', async () => {
 const f=fixture();const operationId=randomUUID();let closed=false
 f.adapters.readAdmission=async()=>{if(closed)throw Object.assign(Error('ticket removed'),{status:409});return {...f.input,operationId}}
 f.adapters.preflightHistory=async()=>{closed=true}
 await assert.rejects(createDocumentDeletionCoordinator(f.adapters)(f.input,{admittedOperationId:operationId}),{status:409})
 assert.equal(f.rows.size,0)
})
test('admitted recovery rejects an existing receipt for another operation', async () => {
 const f=fixture();const row=await f.reservations.begin(f.input);const operationId=randomUUID()
 f.adapters.readAdmission=async()=>({...f.input,operationId})
 await assert.rejects(createDocumentDeletionCoordinator(f.adapters)(f.input,{admittedOperationId:operationId}),{status:409})
 assert.equal((await f.reservations.read(f.input)).operationId,row.operationId);assert.equal(f.commits(),0)
})
test('admitted recovery requires an explicit adapter and cannot combine recovery modes', async () => {
 const f=fixture();const operationId=randomUUID()
 await assert.rejects(createDocumentDeletionCoordinator(f.adapters)(f.input,{admittedOperationId:operationId}),{status:409})
 f.adapters.readAdmission=async()=>assert.fail('ambiguous mode must reject first')
 await assert.rejects(createDocumentDeletionCoordinator(f.adapters)(f.input,{admittedOperationId:operationId,existingOperationId:operationId}),{status:409})
 assert.equal(f.rows.size,0)
})
