/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/RealTimeRedisManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')

describe('RealTimeRedisManager', function () {
  beforeEach(function () {
    this.rclient = {
      auth() {},
      exec: sinon.stub(),
    }
    this.rclient.multi = () => this.rclient
    this.pubsubClient = { publish: sinon.stub() }
    this.RealTimeRedisManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/redis-wrapper': {
          createClient: config =>
            config.name === 'pubsub' ? this.pubsubClient : this.rclient,
        },
        '@overleaf/settings': {
          redis: {
            documentupdater: (this.settings = {
              key_schema: {
                pendingUpdates({ doc_id: docId }) {
                  return `PendingUpdates:${docId}`
                },
              },
            }),
            pubsub: {
              name: 'pubsub',
            },
          },
        },
        crypto: (this.crypto = {
          randomBytes: sinon
            .stub()
            .withArgs(4)
            .returns(Buffer.from([0x1, 0x2, 0x3, 0x4])),
        }),
        os: (this.os = { hostname: sinon.stub().returns('somehost') }),
        './Metrics': (this.metrics = {
          summary: sinon.stub(),
          histogram: sinon.stub(),
        }),
      },
    })

    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    return (this.callback = sinon.stub())
  })

  describe('workspace queue admission', function () {
    beforeEach(function () {
      this.previousNativeGit = process.env.OVERLEAF_NATIVE_GIT_ENABLED
      process.env.OVERLEAF_NATIVE_GIT_ENABLED = 'true'
    })
    afterEach(function () {
      if (this.previousNativeGit === undefined) delete process.env.OVERLEAF_NATIVE_GIT_ENABLED
      else process.env.OVERLEAF_NATIVE_GIT_ENABLED = this.previousNativeGit
    })
    it('returns accepted operations and announces retained stale edits without broadcasting their content', async function () {
      const accepted = { op: [], meta: { workspaceEpoch: 2 } }
      this.rclient.eval = sinon.stub().resolves([JSON.stringify([JSON.stringify(accepted)]), 1])
      this.pubsubClient.publish.resolves()
      const updates = await this.RealTimeRedisManager.promises.getPendingUpdatesForWorkspace(this.project_id, this.doc_id)
      sinon.assert.calledOnce(this.rclient.eval)
      require('assert').deepStrictEqual(updates, [accepted])
      const event = JSON.parse(this.pubsubClient.publish.firstCall.args[1])
      require('assert').strictEqual(event.code, 'WORKSPACE_EPOCH_STALE')
      require('assert').strictEqual(event.op, undefined)
    })
    it('still returns accepted operations if the recovery notice cannot be published', async function () {
      const accepted = { op: [], meta: { workspaceEpoch: 2 } }
      this.rclient.eval = sinon.stub().resolves([JSON.stringify([JSON.stringify(accepted)]), 1])
      this.pubsubClient.publish.rejects(new Error('notification failed'))
      const updates = await this.RealTimeRedisManager.promises.getPendingUpdatesForWorkspace(this.project_id, this.doc_id)
      require('assert').deepStrictEqual(updates, [accepted])
    })
  })

  describe('getPendingUpdatesForDoc', function () {
    beforeEach(function () {
      this.rclient.llen = sinon.stub()
      this.rclient.lrange = sinon.stub()
      return (this.rclient.ltrim = sinon.stub())
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.updates = [
          { op: [{ i: 'foo', p: 4 }] },
          { op: [{ i: 'foo', p: 4 }] },
        ]
        this.jsonUpdates = this.updates.map(update => JSON.stringify(update))
        this.rclient.exec = sinon.stub().yields(null, [2, this.jsonUpdates])
        return this.RealTimeRedisManager.getPendingUpdatesForDoc(
          this.doc_id,
          this.callback
        )
      })

      it('should get the pending updates', function () {
        return this.rclient.lrange
          .calledWith(`PendingUpdates:${this.doc_id}`, 0, 7)
          .should.equal(true)
      })

      it('should delete the pending updates', function () {
        return this.rclient.ltrim
          .calledWith(`PendingUpdates:${this.doc_id}`, 8, -1)
          .should.equal(true)
      })

      return it('should call the callback with the updates', function () {
        return this.callback.calledWith(null, this.updates).should.equal(true)
      })
    })

    return describe("when the JSON doesn't parse", function () {
      beforeEach(function () {
        this.jsonUpdates = [
          JSON.stringify({ op: [{ i: 'foo', p: 4 }] }),
          'broken json',
        ]
        this.rclient.exec = sinon.stub().yields(null, [2, this.jsonUpdates])
        return this.RealTimeRedisManager.getPendingUpdatesForDoc(
          this.doc_id,
          this.callback
        )
      })

      return it('should return an error to the callback', function () {
        return this.callback
          .calledWith(sinon.match.has('name', 'SyntaxError'))
          .should.equal(true)
      })
    })
  })

  describe('getUpdatesLength', function () {
    beforeEach(function () {
      this.rclient.llen = sinon.stub().yields(null, (this.length = 3))
      return this.RealTimeRedisManager.getUpdatesLength(
        this.doc_id,
        this.callback
      )
    })

    it('should look up the length', function () {
      return this.rclient.llen
        .calledWith(`PendingUpdates:${this.doc_id}`)
        .should.equal(true)
    })

    return it('should return the length', function () {
      return this.callback.calledWith(null, this.length).should.equal(true)
    })
  })

  return describe('sendData', function () {
    beforeEach(function () {
      this.message_id = 'doc:somehost:01020304-0'
      return this.RealTimeRedisManager.sendData({ op: 'thisop' })
    })

    it('should send the op with a message id', function () {
      return this.pubsubClient.publish
        .calledWith(
          'applied-ops',
          JSON.stringify({ op: 'thisop', _id: this.message_id })
        )
        .should.equal(true)
    })

    return it('should track the payload size', function () {
      return this.metrics.summary
        .calledWith(
          'redis.publish.applied-ops',
          JSON.stringify({ op: 'thisop', _id: this.message_id }).length
        )
        .should.equal(true)
    })
  })
})
