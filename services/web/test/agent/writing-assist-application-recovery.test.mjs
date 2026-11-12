import test from 'node:test'
import { createHash } from 'node:crypto'
import { applicationOutcomeFields } from '../../app/src/Features/WritingAssist/WritingAssistApplicationOutcome.mjs'
import assert from 'node:assert/strict'
import { createApplicationRecovery } from '../../app/src/Features/WritingAssist/WritingAssistApplicationRecovery.mjs'
import { applicationAcknowledgement } from '../../app/src/Features/WritingAssist/WritingAssistApplicationAcknowledgement.mjs'

function fixture() {
  const task = { id: 'task', userId: 'owner', projectId: 'workspace', status: 'completed', workspaceIdentity: { projectId: 'root', workspaceId: 'workspace', branch: 'draft', epoch: 2 }, proposals: [] }
  const proposal = { id: 'proposal', docId: 'doc', path: 'main.tex', version: 3, before: 'old', after: 'applied', status: 'uncertain' }
  proposal.applicationAcknowledgement = structuredClone(applicationAcknowledgement(task, proposal))
  task.proposals.push(proposal)
  const state = { task, proposal, allowed: true, mutations: 0, releases: 0, lockIds: [], insideLock: false, beforeLock: () => {}, cas: true }
  const store = {
    async find(id, user, project) { return id === task.id && user === task.userId && project === task.projectId ? structuredClone(state.task) : null },
    async recoverAcknowledged() { assert.equal(state.insideLock, true); if (!state.cas) return false; state.mutations++; state.proposal.status = 'accepted'; return true },
    async releaseApplicationRetention() { state.releases++ },
  }
  state.recover = createApplicationRecovery({ canWrite: async () => state.allowed, store, withApplicationLock: async (id, action) => {
    state.lockIds.push(id); state.beforeLock(); state.insideLock = true
    try { return await action() } finally { state.insideLock = false }
  } })
  state.run = () => state.recover('owner', 'workspace', 'task', 'proposal')
  return state
}

test('acknowledged recovery changes only task state under logical-project lock; repeat is idempotent', async () => {
  const f = fixture()
  const original = structuredClone(f.proposal)
  assert.equal((await f.run()).proposals[0].status, 'accepted')
  assert.equal((await f.run()).proposals[0].status, 'accepted')
  assert.equal(f.mutations, 1)
  assert.equal(f.releases, 1)
  assert.deepEqual(f.lockIds, ['root', 'root'])
  assert.deepEqual(f.proposal, { ...original, status: 'accepted' })
})
for (const status of ['applying', 'uncertain']) test(`recovers acknowledged ${status}`, async () => {
  const f = fixture(); f.proposal.status = status
  assert.equal((await f.run()).proposals[0].status, 'accepted')
})
for (const change of [
  f => { delete f.proposal.applicationAcknowledgement },
  f => { f.proposal.after = 'tampered' },
  f => { f.proposal.mode = 'delete-document' },
  f => { f.proposal.status = 'pending' },
  f => { f.task.status = 'running' },
  f => { f.task.workspaceIdentity.epoch++ },
]) test('refuses invalid acknowledgement or ineligible state without settlement', async () => {
  const f = fixture(); change(f)
  await assert.rejects(f.run(), { status: 409 })
  assert.equal(f.mutations, 0)
})
test('owner scoping refuses other collaborator', async () => {
  const f = fixture()
  await assert.rejects(f.recover('other', 'workspace', 'task', 'proposal'), { status: 404 })
  assert.equal(f.mutations, 0)
})
test('rechecks permission after waiting for project lock', async () => {
  const f = fixture(); f.beforeLock = () => { f.allowed = false }
  await assert.rejects(f.run(), { status: 403 }); assert.equal(f.mutations, 0)
})
test('rereads acknowledgement after waiting for project lock', async () => {
  const f = fixture(); f.beforeLock = () => { f.proposal.after = 'changed while queued' }
  await assert.rejects(f.run(), { status: 409 }); assert.equal(f.mutations, 0)
})
test('rejects CAS race without claiming recovery succeeded', async () => {
  const f = fixture(); f.cas = false
  await assert.rejects(f.run(), { status: 409 }); assert.equal(f.proposal.status, 'uncertain')
})

test('recovery restores persisted specialized outcome even after accepted settlement', async () => {
 const f=fixture()
 f.task.applicationOutcome={proposalId:f.proposal.id,afterHash:createHash('sha256').update(f.proposal.after).digest('hex'),fields:{referenceReview:{entries:[],appliedCount:1},summary:'Applied one field.'}}
 assert.deepEqual(applicationOutcomeFields(f.task,f.proposal),f.task.applicationOutcome.fields)
 await f.run()
 // An accepted result may still lack metadata if the original finalizer failed.
 await f.run()
 assert.equal(f.mutations,2)
})
for(const mismatch of ['proposal','hash','arbitrary-fields'])test(`invalid workflow outcome ${mismatch} cannot settle`,async()=>{
 const f=fixture()
 f.task.applicationOutcome={proposalId:f.proposal.id,afterHash:createHash('sha256').update(f.proposal.after).digest('hex'),fields:{claimInput:{documents:[]},claimReview:{items:[]},summary:'Applied'}}
 if(mismatch==='proposal')f.task.applicationOutcome.proposalId='other'
 if(mismatch==='hash')f.task.applicationOutcome.afterHash='bad'
 if(mismatch==='arbitrary-fields')f.task.applicationOutcome.fields.userId='other'
 await assert.rejects(f.run(),{status:409})
 assert.equal(f.mutations,0)
})
