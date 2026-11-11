const assert = require('node:assert/strict')
const { createHash, randomUUID } = require('node:crypto')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/js/DocumentDeletionManager.js'

describe('DocumentDeletionManager', function () {
  beforeEach(function () {
    const projectId = 'a'.repeat(24)
    const docId = 'b'.repeat(24)
    const operationId = randomUUID()
    this.args = [projectId, docId, operationId]
    this.row = { _id: `${projectId}:${docId}`, projectId, docId, operationId,
      state: 'preparing', path: 'chapter.tex', expectedVersion: 3,
      baseHash: createHash('sha256').update('original').digest('hex') }
    this.snapshot = { version: 3, pathname: 'chapter.tex', lines: ['original'] }
    this.events = []
    const matches = query => this.row && Object.entries(query).every(([key, value]) => this.row[key] === value)
    this.collection = {
      findOne: sinon.spy(async query => matches(query) ? { ...this.row } : null),
      updateOne: sinon.spy(async (query, update) => {
        if (matches(query)) { Object.assign(this.row, update.$set); this.events.push(this.row.state) }
      }),
      deleteOne: sinon.spy(async query => { if (matches(query)) this.row = null }),
    }
    this.db = { documentDeletionReservations: this.collection, projects: { findOne: sinon.stub() }, docs: { findOne: sinon.stub() } }
    this.lock = { getLock: sinon.stub().resolves('lock'), releaseLock: sinon.stub().resolves() }
    this.document = {
      getDoc: sinon.spy(async () => { this.events.push('load'); return this.snapshot }),
      flushDocIfLoaded: sinon.spy(async () => { this.events.push('flush') }),
    }
    this.redis = { removeDocFromMemory: sinon.stub(), getDoc: sinon.spy(async () => { this.events.push('cached'); return this.snapshot }) }
    this.updates = { processOutstandingUpdates: sinon.spy(async () => { this.events.push('drain') }) }
    this.persistence = { getDeletionRecoverySnapshot: sinon.stub().rejects(new Error('recovery unavailable')) }
    this.fence = {
      reserveMissingCache: sinon.stub().resolves(),
      withOperation: async (id, check, action) => { await check(); return action() },
      reserve: sinon.spy(async () => { assert.equal(this.row.state, 'fenced'); this.events.push('CAS') }),
    }
    this.manager = SandboxedModule.require(MODULE_PATH, { requires: {
      '@overleaf/settings': { redis: { documentupdater: { key_schema: {} } } },
      '@overleaf/redis-wrapper': { createClient: () => ({}) },
      './mongodb': { db: this.db, ObjectId: require('mongodb-legacy').ObjectId },
      './LockManager': { promises: this.lock },
      './RedisManager': { promises: this.redis },
      './DocumentManager': { promises: this.document },
      './PersistenceManager': { promises: this.persistence },
      './UpdateManager': { promises: this.updates },
      './DocumentDeletionFence': { createDocumentDeletionFence: () => this.fence },
    } }).promises
  })

  

  describe('cleanup', function () {
    beforeEach(function () {
      this.row.state = 'committing'
      this.receipt = { ...this.row, projectVersion: 9, projectHistoryId: 'history',
        historyConfirmed: { projectStructureVersion: '9.0', projectHistoryId: 'history', version: 99 } }
      this.project = { rootFolder: [{ docs: [], folders: [] }], deletionReceipts: { [this.args[2]]: this.receipt } }
      this.db.projects.findOne.resolves(this.project)
      this.db.docs.findOne.resolves({ deleted: true })
      this.fence.retainForCleanup = sinon.spy(async () => { this.events.push('retain') })
      this.redis.removeDocFromMemory.callsFake(async () => { this.events.push('evict'); this.snapshot.lines = null; this.snapshot.version = 0 })
      this.fence.reserveMissingCache.callsFake(async () => {
        if (this.snapshot.lines != null || this.snapshot.version !== 0) throw new Error('DOCUMENT_DELETION_CONFLICT')
        this.events.push('empty-CAS')
      })
    })
    it('inspects complete prerequisites without eviction, reload or marker writes', async function () {
      this.fence.inspectClearedCache = sinon.stub().resolves(true)
      assert.equal((await this.manager.inspect(...this.args)).cacheCleared, true)
      this.fence.inspectClearedCache.resolves(false)
      assert.equal((await this.manager.inspect(...this.args)).cacheCleared, false)
      sinon.assert.notCalled(this.fence.retainForCleanup)
      sinon.assert.notCalled(this.fence.reserveMissingCache)
      sinon.assert.notCalled(this.redis.removeDocFromMemory)
      sinon.assert.notCalled(this.document.getDoc)
      sinon.assert.notCalled(this.collection.updateOne)
    })
    it('refuses inspection when durable cleanup prerequisites are absent', async function () {
      this.fence.inspectClearedCache = sinon.stub().resolves(true)
      this.db.docs.findOne.resolves({ deleted: false })
      await assert.rejects(this.manager.inspect(...this.args), { status: 409 })
      sinon.assert.notCalled(this.fence.inspectClearedCache)
    })
    it('retains protection then evicts without loading or flushing deleted content', async function () {
      const receipt = await this.manager.cleanup(...this.args)
      assert.equal(receipt.cacheCleared, true)
      assert.deepEqual(this.events, ['retain', 'evict', 'empty-CAS'])
      sinon.assert.notCalled(this.document.getDoc)
      sinon.assert.notCalled(this.document.flushDocIfLoaded)
      sinon.assert.notCalled(this.updates.processOutstandingUpdates)
      sinon.assert.calledOnce(this.lock.releaseLock)
    })
    it('rejects storage that is not soft-deleted', async function () {
      this.db.docs.findOne.resolves({ deleted: false })
      await assert.rejects(this.manager.cleanup(...this.args), { status: 409 })
      sinon.assert.notCalled(this.redis.removeDocFromMemory)
    })
    it('rejects a document restored into the filetree', async function () {
      this.project.rootFolder[0].folders.push({ docs: [{ _id: this.args[1] }] })
      await assert.rejects(this.manager.cleanup(...this.args), { status: 409 })
      sinon.assert.notCalled(this.redis.removeDocFromMemory)
    })
    it('rejects missing history confirmation and wrong snapshot binding', async function () {
      this.receipt.historyConfirmed = null
      await assert.rejects(this.manager.cleanup(...this.args), { status: 409 })
      this.receipt.historyConfirmed = { projectStructureVersion: '9.0', projectHistoryId: 'history', version: 99 }
      this.receipt.baseHash = 'f'.repeat(64)
      await assert.rejects(this.manager.cleanup(...this.args), { status: 409 })
      sinon.assert.notCalled(this.redis.removeDocFromMemory)
    })
    it('does not acknowledge incomplete cache eviction', async function () {
      this.redis.removeDocFromMemory.resetBehavior()
      this.redis.removeDocFromMemory.resolves()
      await assert.rejects(this.manager.cleanup(...this.args), /DOCUMENT_DELETION_CONFLICT/)
      sinon.assert.calledOnce(this.fence.retainForCleanup)
      sinon.assert.calledOnce(this.lock.releaseLock)
    })
  })

  it('drains, flushes, persists denial, fences exact snapshot then acknowledges committing', async function () {
    const result = await this.manager.prepare(...this.args)
    assert.equal(result.state, 'committing')
    assert.deepEqual(this.events, ['drain', 'load', 'flush', 'fenced', 'CAS', 'committing'])
    sinon.assert.calledWith(this.fence.reserve, {
      projectId: this.args[0], docId: this.args[1], operationId: this.args[2],
      expectedVersion: 3, expectedPath: 'chapter.tex', serializedLines: '["original"]',
    })
    sinon.assert.calledWith(this.collection.findOne, sinon.match.object, { readPreference: 'primary' })
    sinon.assert.calledWith(this.lock.releaseLock, this.args[1], 'lock')
  })

  it('rejects a newer queued edit and releases only its preparing record', async function () {
    this.updates.processOutstandingUpdates = async () => { this.snapshot.version++ }
    await assert.rejects(this.manager.prepare(...this.args), { status: 409 })
    assert.equal(this.row, null)
    sinon.assert.notCalled(this.document.flushDocIfLoaded)
    sinon.assert.notCalled(this.fence.reserve)
    sinon.assert.calledOnce(this.lock.releaseLock)
  })

  it('retains durable denial after a fence failure', async function () {
    this.fence.reserve = async () => { throw new Error('connection lost') }
    await assert.rejects(this.manager.prepare(...this.args), /connection lost/)
    assert.equal(this.row.state, 'fenced')
    sinon.assert.calledOnce(this.lock.releaseLock)
  })

  it('recovers fenced cached snapshots without processing edits or loading persistence', async function () {
    this.row.state = 'fenced'
    assert.equal((await this.manager.prepare(...this.args)).state, 'committing')
    assert.deepEqual(this.events, ['cached', 'CAS', 'committing'])
    sinon.assert.notCalled(this.updates.processOutstandingUpdates)
    sinon.assert.notCalled(this.document.getDoc)
  })

  it('does not reopen a fenced document when its recovery proof is unavailable', async function () {
    this.row.state = 'fenced'
    this.snapshot = {}
    await assert.rejects(this.manager.prepare(...this.args), /recovery unavailable/)
    assert.equal(this.row.state, 'fenced')
    sinon.assert.notCalled(this.collection.deleteOne)
    sinon.assert.notCalled(this.document.getDoc)
    sinon.assert.notCalled(this.fence.reserve)
  })

  it('recovers native missing-cache representation with version zero without loading content', async function () {
    this.row.state = 'fenced'
    this.snapshot = { lines: null, version: 0 }
    this.persistence.getDeletionRecoverySnapshot.resolves({ projectId: this.args[0], docId: this.args[1], operationId: this.args[2],
      version: 3, pathname: this.row.path, baseHash: this.row.baseHash })
    assert.equal((await this.manager.prepare(...this.args)).state, 'committing')
    sinon.assert.calledOnce(this.fence.reserveMissingCache)
    sinon.assert.notCalled(this.document.getDoc)
    sinon.assert.notCalled(this.document.flushDocIfLoaded)
    sinon.assert.notCalled(this.updates.processOutstandingUpdates)
    sinon.assert.notCalled(this.fence.reserve)
  })

  it('rejects a proof from another operation or changed snapshot', async function () {
    this.row.state = 'fenced'
    this.snapshot = {}
    const proof = { projectId: this.args[0], docId: this.args[1], operationId: this.args[2], version: 3, pathname: this.row.path, baseHash: this.row.baseHash }
    for (const changed of [{ operationId: randomUUID() }, { version: 4 }, { baseHash: 'f'.repeat(64) }, { pathname: 'other.tex' }, { projectId: 'e'.repeat(24) }]) {
      this.persistence.getDeletionRecoverySnapshot.resolves({ ...proof, ...changed })
      await assert.rejects(this.manager.prepare(...this.args), { status: 409 })
      assert.equal(this.row.state, 'fenced')
    }
    sinon.assert.notCalled(this.fence.reserveMissingCache)
  })

  it('does not use missing-cache recovery for a partial cache', async function () {
    this.row.state = 'fenced'
    this.snapshot = { version: 3 }
    await assert.rejects(this.manager.prepare(...this.args), { status: 409 })
    sinon.assert.notCalled(this.persistence.getDeletionRecoverySnapshot)
    sinon.assert.notCalled(this.fence.reserveMissingCache)
  })

  it('keeps the durable fence when atomic missing-cache reservation fails', async function () {
    this.row.state = 'fenced'
    this.snapshot = {}
    this.persistence.getDeletionRecoverySnapshot.resolves({ projectId: this.args[0], docId: this.args[1], operationId: this.args[2], version: 3, pathname: this.row.path, baseHash: this.row.baseHash })
    this.fence.reserveMissingCache.rejects(new Error('generation changed'))
    await assert.rejects(this.manager.prepare(...this.args), /generation changed/)
    assert.equal(this.row.state, 'fenced')
    sinon.assert.notCalled(this.collection.deleteOne)
  })

  it('returns committing receipts without replaying preparation', async function () {
    this.row.state = 'committing'
    assert.equal((await this.manager.prepare(...this.args)).state, 'committing')
    assert.deepEqual(this.events, [])
  })

  it('rejects other operations and releases the document lock', async function () {
    await assert.rejects(this.manager.prepare(this.args[0], this.args[1], randomUUID()), { status: 409 })
    assert.deepEqual(this.events, [])
    sinon.assert.calledOnce(this.lock.releaseLock)
  })

  it('matches native leading-slash paths but reserves the exact cached pathname', async function () {
    this.snapshot.pathname = '/chapter.tex'
    assert.equal((await this.manager.prepare(...this.args)).state, 'committing')
    assert.equal(this.fence.reserve.firstCall.args[0].expectedPath, '/chapter.tex')
  })

  it('hashes history-OT text but fences its original serialized representation', async function () {
    this.snapshot.lines = { content: 'original' }
    await this.manager.prepare(...this.args)
    assert.equal(this.fence.reserve.firstCall.args[0].serializedLines, '{"content":"original"}')
  })

  it('rejects malformed identities before acquiring locks or reading storage', async function () {
    await assert.rejects(this.manager.prepare('../project', this.args[1], this.args[2]), { status: 400 })
    sinon.assert.notCalled(this.lock.getLock)
    sinon.assert.notCalled(this.collection.findOne)
  })

  it('recovers a lost durable acknowledgement using the same operation', async function () {
    const update = this.collection.updateOne
    this.collection.updateOne = async (...args) => {
      await update(...args)
      throw new Error('acknowledgement lost')
    }
    await assert.rejects(this.manager.prepare(...this.args), /acknowledgement lost/)
    assert.equal(this.row.state, 'fenced')
    this.collection.updateOne = update
    const receipt = await this.manager.prepare(...this.args)
    assert.equal(receipt.operationId, this.args[2])
    assert.equal(receipt.state, 'committing')
    sinon.assert.calledOnce(this.updates.processOutstandingUpdates)
    sinon.assert.calledOnce(this.document.flushDocIfLoaded)
  })

  it('does not advance the durable state when flushing fails', async function () {
    this.document.flushDocIfLoaded = async () => { throw new Error('storage unavailable') }
    await assert.rejects(this.manager.prepare(...this.args), /storage unavailable/)
    assert.equal(this.row.state, 'preparing')
    sinon.assert.notCalled(this.fence.reserve)
    sinon.assert.calledOnce(this.lock.releaseLock)
  })
})
