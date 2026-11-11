import { vi } from 'vitest'
import assert from 'node:assert/strict'
import sinon from 'sinon'

describe('DocumentDeletionCommitService', function () {
  beforeEach(async function (ctx) {
    ctx.input = { projectId: 'a'.repeat(24), docId: 'b'.repeat(24), userId: 'c'.repeat(24),
      path: 'chapter.tex', expectedVersion: 3, baseHash: 'd'.repeat(64) }
    ctx.operationId = '00000000-0000-4000-8000-000000000001'
    ctx.reservation = { ...ctx.input, operationId: ctx.operationId, state: 'committing' }
    ctx.receipt = { ...ctx.reservation, name: 'chapter.tex', removedAt: new Date(),
      projectVersion: 9, projectHistoryId: 'history',
      historyConfirmed: { projectStructureVersion: '9.0', projectHistoryId: 'history', version: 99 } }
    ctx.events = []
    ctx.commit = sinon.spy(async () => { ctx.events.push('filetree'); return ctx.receipt })
    ctx.history = sinon.spy(async () => { ctx.events.push('history'); if (ctx.historyError) throw ctx.historyError })
    ctx.softDelete = sinon.spy(async () => { ctx.events.push('soft-delete') })
    ctx.cleanup = sinon.spy(async () => { ctx.events.push('cleanup'); if (ctx.cleanupError) throw ctx.cleanupError })
    ctx.notify = sinon.stub().resolves()
    ctx.project = { rootFolder: [{ docs: [], folders: [] }], deletionReceipts: { [ctx.operationId]: ctx.receipt } }
    ctx.projects = { findOne: sinon.stub().callsFake(async () => ctx.project) }
    ctx.docs = { findOne: sinon.stub().resolves({ deleted: true }) }
    vi.doMock('../../../../app/src/infrastructure/mongodb.mjs', () => ({
      db: { projects: ctx.projects, docs: ctx.docs }, ObjectId: class { constructor(id) { this.id = id } },
    }))
    vi.doMock('../../../../app/src/models/DocumentDeletionReservation.mjs', () => ({ DocumentDeletionReservation: { collection: {} } }))
    vi.doMock('../../../../app/src/Features/WritingAssist/DocumentDeletionReservations.mjs', () => ({
      createDocumentDeletionReservations: () => ({ read: async () => ctx.reservation }),
    }))
    vi.doMock('../../../../app/src/Features/WritingAssist/DocumentDeletionProjectCommit.mjs', () => ({ createDocumentDeletionProjectCommit: () => ctx.commit }))
    vi.doMock('../../../../app/src/Features/WritingAssist/DocumentDeletionHistoryService.mjs', () => ({ confirmDeletionHistory: ctx.history }))
    vi.doMock('../../../../app/src/Features/Docstore/DocstoreManager.mjs', () => ({ default: { promises: { deleteDoc: ctx.softDelete } } }))
    vi.doMock('../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs', () => ({ default: { promises: { cleanupDocumentDeletion: ctx.cleanup } } }))
    vi.doMock('../../../../app/src/Features/Editor/EditorRealTimeController.mjs', () => ({ default: { emitToRoom: ctx.notify } }))
    ctx.service = await import('../../../../app/src/Features/WritingAssist/DocumentDeletionCommitService.mjs')
  })

  it('orders filetree, confirmed history, native soft delete and cache cleanup', async function (ctx) {
    await ctx.service.commitDeletion(ctx.input, ctx.reservation)
    assert.deepEqual(ctx.events, ['filetree', 'history', 'soft-delete', 'cleanup'])
    sinon.assert.calledWith(ctx.softDelete, ctx.input.projectId, ctx.input.docId, 'chapter.tex', ctx.receipt.removedAt)
    sinon.assert.notCalled(ctx.notify)
  })
  it('stops before soft deletion when history confirmation fails', async function (ctx) {
    ctx.historyError = new Error('history unavailable')
    await assert.rejects(ctx.service.commitDeletion(ctx.input, ctx.reservation), /history unavailable/)
    assert.deepEqual(ctx.events, ['filetree', 'history'])
    sinon.assert.notCalled(ctx.softDelete)
    sinon.assert.notCalled(ctx.cleanup)
  })
  it('does not report completion when live cache finalization fails', async function (ctx) {
    ctx.cleanupError = new Error('cache unavailable')
    await assert.rejects(ctx.service.inspectDeletion(ctx.input, ctx.reservation), /cache unavailable/)
    sinon.assert.notCalled(ctx.notify)
  })
  it('does not accept absence from filetree without soft-deleted storage', async function (ctx) {
    ctx.docs.findOne.resolves({ deleted: false })
    assert.equal(await ctx.service.inspectDeletion(ctx.input, ctx.reservation), false)
    sinon.assert.notCalled(ctx.cleanup)
  })
  it('refuses a restored filetree document', async function (ctx) {
    ctx.project.rootFolder[0].folders.push({ docs: [{ _id: ctx.input.docId }] })
    assert.equal(await ctx.service.inspectDeletion(ctx.input, ctx.reservation), false)
    sinon.assert.notCalled(ctx.cleanup)
  })
  it('requires persisted history confirmation before cache finalization', async function (ctx) {
    ctx.receipt.historyConfirmed = null
    assert.equal(await ctx.service.inspectDeletion(ctx.input, ctx.reservation), false)
    sinon.assert.notCalled(ctx.cleanup)
  })
  it('verifies live cleanup instead of trusting a previous success response', async function (ctx) {
    assert.equal(await ctx.service.inspectDeletion(ctx.input, ctx.reservation), true)
    sinon.assert.calledWith(ctx.cleanup, ctx.input.projectId, ctx.input.docId, ctx.operationId)
  })
  it('emits the native removal event only when explicitly notified', async function (ctx) {
    await ctx.service.notifyDeletionCommitted(ctx.input)
    sinon.assert.calledWith(ctx.notify, ctx.input.projectId, 'removeEntity', ctx.input.docId, 'writing-assist')
  })
})
