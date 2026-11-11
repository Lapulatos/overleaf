/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createDeletionAdmissionSettlement } from '../../app/src/Features/WritingAssist/DocumentDeletionAdmissionSettlement.mjs'

function fixture(status = 'accepted') {
  const proposal = { id: randomUUID(), docId: 'b'.repeat(24), mode: 'delete-document', status, version: 2, path: 'notes.tex', before: 'original' }
  const task = { projectId: 'a'.repeat(24), userId: 'c'.repeat(24), proposals: [proposal] }
  const taskId = randomUUID(); const operationId = randomUUID()
  const expected = { projectId: task.projectId, userId: task.userId, docId: proposal.docId, taskId, proposalId: proposal.id, expectedVersion: 2, path: 'notes.tex', baseHash: createHash('sha256').update('original').digest('hex') }
  const f = { task, proposal, ticket: { operationId }, receipt: { operationId, state: 'committed' }, releases: 0, reads: 0 }
  const admission = {
    async read() { f.reads++; return { documentDeletionAdmissions: { [proposal.docId]: f.ticket } } },
    async readAccepted(input, op) { assert.deepEqual(input, expected); assert.equal(op, operationId); if (f.bindingError) throw f.bindingError },
    async releaseAfterSettlement(input, op) { assert.deepEqual(input, expected); assert.equal(op, operationId); f.releases++; f.ticket = undefined; if (f.lostReply) throw new Error('response lost') },
  }
  f.run = () => createDeletionAdmissionSettlement({ readTask: async () => task, projectDeletionAdmission: admission, reservations: { find: async () => f.receipt } })(taskId, proposal.id)
  return f
}

test('accepted task releases only its matching committed operation', async () => {
  const f = fixture(); await f.run(); assert.equal(f.releases, 1)
})
test('nonterminal task never reads or releases admission', async () => {
  for (const status of ['pending', 'applying', 'rejected']) {
    const f = fixture(status); await f.run(); assert.equal(f.reads, 0); assert.equal(f.releases, 0)
  }
})
test('accepted task retains ticket for missing, incomplete or different operation', async () => {
  for (const receipt of [null, { state: 'fenced' }, { state: 'committing' }, { state: 'committed', operationId: randomUUID() }]) {
    const f = fixture(); f.receipt = receipt
    await assert.rejects(f.run(), { status: 409 }); assert.equal(f.releases, 0)
  }
})
test('conflict releases only after reservation absence is confirmed', async () => {
  const f = fixture('conflict'); await assert.rejects(f.run(), { status: 409 }); assert.equal(f.releases, 0)
  f.receipt = null; await f.run(); assert.equal(f.releases, 1)
})
test('changed ticket binding fails closed', async () => {
  const f = fixture(); f.bindingError = Object.assign(new Error('binding changed'), { status: 409 })
  await assert.rejects(f.run(), /binding changed/); assert.equal(f.releases, 0)
})
test('lost release response is safely retried without another release', async () => {
  const f = fixture(); f.lostReply = true
  await assert.rejects(f.run(), /response lost/); await f.run(); assert.equal(f.releases, 1)
})
