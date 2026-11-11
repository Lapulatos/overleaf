import { vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const MODULE_PATH =
  '../../../../app/src/Features/Documents/DocumentController.mjs'

describe('DocumentController', function () {
  beforeEach(async function (ctx) {
    ctx.res = new MockResponse(vi)
    ctx.req = new MockRequest(vi)
    ctx.next = sinon.stub()
    ctx.doc = { _id: 'doc-id-123' }
    ctx.doc_lines = ['one', 'two', 'three']
    ctx.version = 42
    ctx.ranges = {
      comments: [
        {
          id: 'comment1',
          op: {
            c: 'foo',
            p: 123,
            t: 'comment1',
          },
        },
        {
          id: 'comment2',
          op: {
            c: 'bar',
            p: 456,
            t: 'comment2',
          },
        },
      ],
    }
    ctx.pathname = '/a/b/c/file.tex'
    ctx.lastUpdatedAt = new Date().getTime()
    ctx.lastUpdatedBy = 'fake-last-updater-id'
    ctx.rev = 5
    ctx.project = {
      _id: 'project-id-123',
      overleaf: {
        history: {
          id: 1234,
          display: true,
        },
      },
    }
    ctx.resolvedThreadIds = [
      'comment2',
      'comment4', // Comment in project but not in doc
    ]

    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(ctx.project),
      },
    }
    ctx.ProjectLocator = {
      promises: {
        findElement: sinon
          .stub()
          .resolves({ element: ctx.doc, path: { fileSystem: ctx.pathname } }),
      },
    }
    ctx.ProjectEntityHandler = {
      promises: {
        getDoc: sinon.stub().resolves({
          lines: ctx.doc_lines,
          rev: ctx.rev,
          version: ctx.version,
          ranges: ctx.ranges,
        }),
      },
    }
    ctx.ProjectEntityUpdateHandler = {
      promises: {
        updateDocLines: sinon.stub().resolves(),
      },
    }

    ctx.ChatApiHandler = {
      promises: {
        getResolvedThreadIds: sinon.stub().resolves(ctx.resolvedThreadIds),
      },
    }

    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: ctx.ProjectLocator,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: ctx.ProjectEntityHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityUpdateHandler',
      () => ({
        default: ctx.ProjectEntityUpdateHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Chat/ChatApiHandler', () => ({
      default: ctx.ChatApiHandler,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules.mjs', () => ({
      default: ctx.Modules,
    }))

    ctx.DocumentDeletionReservation = { exists: sinon.stub().resolves(null) }
    vi.doMock('../../../../app/src/models/DocumentDeletionReservation.mjs', () => ({
      DocumentDeletionReservation: ctx.DocumentDeletionReservation,
    }))

    ctx.DocumentController = (await import(MODULE_PATH)).default
  })

  describe('getDocument', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        Project_id: ctx.project._id,
        doc_id: ctx.doc._id,
      }
    })

    describe('when project exists with project history enabled', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.callback = err => {
            resolve(err)
          }
          ctx.DocumentController.getDocument(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should return the history id and display setting to the client as JSON', function (ctx) {
        ctx.res.type.should.equal('application/json')
        JSON.parse(ctx.res.body).should.deep.equal({
          lines: ctx.doc_lines,
          version: ctx.version,
          ranges: ctx.ranges,
          pathname: ctx.pathname,
          projectHistoryId: ctx.project.overleaf.history.id,
          projectHistoryType: 'project-history',
          resolvedCommentIds: ['comment2'],
          historyRangesSupport: false,
          otMigrationStage: 0,
        })
      })
    })

    describe('when deletion blocks cache reload', function () {
      for (const plain of [false, true]) {
        it(`returns 409 without loading contents (plain=${plain})`, async function (ctx) {
          ctx.req.query.plain = String(plain)
          ctx.DocumentDeletionReservation.exists.resolves({ _id: 'reservation' })
          await new Promise((resolve, reject) => {
            ctx.res.callback = resolve
            ctx.DocumentController.getDocument(ctx.req, ctx.res, reject)
          })
          ctx.res.statusCode.should.equal(409)
          JSON.parse(ctx.res.body).code.should.equal('DOCUMENT_DELETION_PENDING')
          sinon.assert.notCalled(ctx.ProjectEntityHandler.promises.getDoc)
          sinon.assert.notCalled(ctx.ChatApiHandler.promises.getResolvedThreadIds)
          sinon.assert.calledWith(ctx.DocumentDeletionReservation.exists, {
            _id: `${ctx.project._id}:${ctx.doc._id}`,
            projectId: ctx.project._id,
            docId: ctx.doc._id,
            state: { $in: ['fenced', 'committing', 'committed'] },
          })
        })
      }

      it('does not return text if fencing completes during the storage read', async function (ctx) {
        ctx.DocumentDeletionReservation.exists.onFirstCall().resolves(null)
        ctx.DocumentDeletionReservation.exists.onSecondCall().resolves({ _id: 'reservation' })
        await new Promise((resolve, reject) => {
          ctx.res.callback = resolve
          ctx.DocumentController.getDocument(ctx.req, ctx.res, reject)
        })
        ctx.res.statusCode.should.equal(409)
        sinon.assert.calledOnce(ctx.ProjectEntityHandler.promises.getDoc)
        sinon.assert.notCalled(ctx.ChatApiHandler.promises.getResolvedThreadIds)
        ctx.res.body.includes('one').should.equal(false)
      })

      it('fails closed when reservation storage is unavailable', async function (ctx) {
        const failure = new Error('reservation storage unavailable')
        ctx.DocumentDeletionReservation.exists.rejects(failure)
        const error = await new Promise(resolve => {
          ctx.DocumentController.getDocument(ctx.req, ctx.res, resolve)
        })
        error.should.equal(failure)
        sinon.assert.notCalled(ctx.ProjectEntityHandler.promises.getDoc)
        ctx.res.returned.should.equal(false)
      })
    })

    describe('when the project does not exist', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ProjectGetter.promises.getProject.resolves(null)
          ctx.res.callback = err => {
            resolve(err)
          }
          ctx.DocumentController.getDocument(ctx.req, ctx.res, ctx.next)
        })
      })

      it('returns a 404', function (ctx) {
        ctx.res.statusCode.should.equal(404)
      })
    })
  })

  describe('setDocument', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        Project_id: ctx.project._id,
        doc_id: ctx.doc._id,
      }
    })

    describe('when the document exists', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.req.body = {
            lines: ctx.doc_lines,
            version: ctx.version,
            ranges: ctx.ranges,
            lastUpdatedAt: ctx.lastUpdatedAt,
            lastUpdatedBy: ctx.lastUpdatedBy,
          }
          ctx.res.callback = err => {
            resolve(err)
          }
          ctx.DocumentController.setDocument(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should update the document in Mongo', function (ctx) {
        sinon.assert.calledWith(
          ctx.ProjectEntityUpdateHandler.promises.updateDocLines,
          ctx.project._id,
          ctx.doc._id,
          ctx.doc_lines,
          ctx.version,
          ctx.ranges,
          ctx.lastUpdatedAt,
          ctx.lastUpdatedBy
        )
      })

      it('should return a successful response', function (ctx) {
        ctx.res.success.should.equal(true)
      })

      it('should call the docModified hook', function (ctx) {
        sinon.assert.calledWith(
          ctx.Modules.promises.hooks.fire,
          'docModified',
          ctx.project._id,
          ctx.doc._id
        )
      })
    })

    describe("when the document doesn't exist", function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ProjectEntityUpdateHandler.promises.updateDocLines.rejects(
            new Errors.NotFoundError('document does not exist')
          )
          ctx.req.body = { lines: ctx.doc_lines }
          ctx.next.callsFake(() => {
            resolve()
          })
          ctx.DocumentController.setDocument(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should call next with the NotFoundError', function (ctx) {
        ctx.next
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })
})
