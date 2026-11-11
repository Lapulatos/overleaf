import { vi, expect } from 'vitest'
import sinon from 'sinon'
import tk from 'timekeeper'
import moment from 'moment'
import { Project } from '../../../../app/src/models/Project.mjs'
import { DeletedProject } from '../../../../app/src/models/DeletedProject.mjs'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
const modulePath = '../../../../app/src/Features/Project/ProjectDeleter'

const { ObjectId, ReadPreference } = mongodb
vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('ProjectDeleter', function () {
  beforeEach(async function (ctx) {
    tk.freeze(Date.now())
    ctx.ip = '192.170.18.1'
    ctx.project = dummyProject()
    ctx.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {},
    }

    ctx.doc = {
      _id: '5bd975f54f62e803cb8a8fec',
      lines: ['a bunch of lines', 'for a sunny day', 'in London town'],
      ranges: {},
      project_id: '5cf9270b4eff6e186cf8b05e',
    }

    ctx.deletedProjects = [
      {
        _id: '5cf7f145c1401f0ca0eb1aaa',
        deleterData: {
          _id: '5cf7f145c1401f0ca0eb1aac',
          deletedAt: moment().subtract(95, 'days').toDate(),
          deleterId: '588f3ddae8ebc1bac07c9fa4',
          deleterIpAddress: '172.19.0.1',
          deletedProjectId: '5cf9270b4eff6e186cf8b05e',
          deletedProjectOwnerId: ctx.user._id,
        },
        project: {
          _id: '5cf9270b4eff6e186cf8b05e',
          overleaf: {
            history: {
              id: new ObjectId(),
            },
          },
        },
      },
      {
        _id: '5cf8eb11c1401f0ca0eb1ad7',
        deleterData: {
          _id: '5b74360c0fbe57011ae9938f',
          deletedAt: moment().subtract(95, 'days').toDate(),
          deleterId: '588f3ddae8ebc1bac07c9fa4',
          deleterIpAddress: '172.20.0.1',
          deletedProjectId: '5cf8f95a0c87371362c23919',
        },
        project: {
          _id: '5cf8f95a0c87371362c23919',
        },
      },
    ]

    ctx.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongoAndDelete: sinon.stub().resolves(),
      },
    }
    ctx.EditorRealTimeController = {
      emitToRoom: sinon.stub(),
    }
    ctx.TagsHandler = {
      promises: {
        removeProjectFromAllTags: sinon.stub().resolves(),
      },
    }
    ctx.CollaboratorsHandler = {
      promises: {
        removeUserFromAllProjects: sinon.stub().resolves(),
      },
    }
    ctx.CollaboratorsGetter = {
      promises: {
        getMemberIds: sinon
          .stub()
          .withArgs(ctx.project._id)
          .resolves(['member-id-1', 'member-id-2']),
      },
    }

    ctx.ProjectDetailsHandler = {
      promises: {
        generateUniqueName: sinon.stub().resolves(ctx.project.name),
      },
    }

    ctx.db = {
      projects: {
        insertOne: sinon.stub().resolves(),
      },
    }

    ctx.DocstoreManager = {
      promises: {
        archiveProject: sinon.stub().resolves(),
        destroyProject: sinon.stub().resolves(),
      },
    }
    ctx.HistoryManager = {
      promises: {
        deleteProject: sinon.stub().resolves(),
      },
    }

    ctx.ProjectMock = sinon.mock(Project)
    ctx.DeletedProjectMock = sinon.mock(DeletedProject)
    ctx.Features = {
      hasFeature: sinon.stub().returns(true),
    }
    ctx.ChatApiHandler = {
      promises: {
        destroyProject: sinon.stub().resolves(),
      },
    }
    ctx.WritingAssistConversation = {
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    ctx.NativeCommentDeletion = {
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    vi.doMock('../../../../app/src/models/NativeCommentDeletion', () => ({
      NativeCommentDeletion: ctx.NativeCommentDeletion,
    }))
    ctx.DocumentDeletionReservation = {
      collection: { findOne: sinon.stub().resolves(null) },
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    vi.doMock('../../../../app/src/models/DocumentDeletionReservation', () => ({
      DocumentDeletionReservation: ctx.DocumentDeletionReservation,
    }))
    ctx.WritingAssistTask = {
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }
    vi.doMock('../../../../app/src/models/WritingAssistConversation', () => ({
      WritingAssistConversation: ctx.WritingAssistConversation,
    }))
    vi.doMock('../../../../app/src/models/WritingAssistTask', () => ({
      WritingAssistTask: ctx.WritingAssistTask,
    }))
    ctx.ProjectAuditLogEntry = {
      deleteMany: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: {
        promises: { hooks: { fire: sinon.stub().resolves() } },
      },
    }))

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project,
    }))

    vi.doMock('../../../../app/src/models/DeletedProject', () => ({
      DeletedProject,
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Tags/TagsHandler', () => ({
      default: ctx.TagsHandler,
    }))

    vi.doMock('../../../../app/src/Features/Chat/ChatApiHandler', () => ({
      default: ctx.ChatApiHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler',
      () => ({
        default: ctx.CollaboratorsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    vi.doMock('../../../../app/src/Features/Docstore/DocstoreManager', () => ({
      default: ctx.DocstoreManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler',
      () => ({
        default: ctx.ProjectDetailsHandler,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      db: ctx.db,
      ObjectId,
      READ_PREFERENCE_SECONDARY: ReadPreference.secondaryPreferred.mode,
    }))

    vi.doMock('../../../../app/src/Features/History/HistoryManager', () => ({
      default: ctx.HistoryManager,
    }))

    vi.doMock('../../../../app/src/models/ProjectAuditLogEntry', () => ({
      ProjectAuditLogEntry: ctx.ProjectAuditLogEntry,
    }))

    ctx.recoverAcceptedDeletionsForProjectRemoval = sinon.stub().resolves({ completed: 0, conflicts: 0 })
    vi.doMock('../../../../app/src/Features/WritingAssist/DocumentDeletionTeardownService', () => ({
      recoverAcceptedDeletionsForProjectRemoval: ctx.recoverAcceptedDeletionsForProjectRemoval,
    }))
    ctx.ProjectDeleter = (await import(modulePath)).default
  })

  afterEach(function (ctx) {
    tk.reset()
    ctx.DeletedProjectMock.restore()
    ctx.ProjectMock.restore()
  })

  describe('mark as deleted by external source', function () {
    beforeEach(function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: ctx.project._id },
          { deletedByExternalDataSource: true }
        )
        .chain('exec')
        .resolves()
    })

    it('should update the project with the flag set to true', async function (ctx) {
      await ctx.ProjectDeleter.promises.markAsDeletedByExternalSource(
        ctx.project._id
      )
      ctx.ProjectMock.verify()
    })

    it('should tell the editor controler so users are notified', async function (ctx) {
      await ctx.ProjectDeleter.promises.markAsDeletedByExternalSource(
        ctx.project._id
      )
      expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
        ctx.project._id,
        'projectRenamedOrDeletedByExternalSource'
      )
    })
  })

  describe('unmarkAsDeletedByExternalSource', function () {
    beforeEach(async function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: ctx.project._id },
          { deletedByExternalDataSource: false }
        )
        .chain('exec')
        .resolves()
      await ctx.ProjectDeleter.promises.unmarkAsDeletedByExternalSource(
        ctx.project._id
      )
    })

    it('should remove the flag from the project', function (ctx) {
      ctx.ProjectMock.verify()
    })
  })

  describe('deleteUsersProjects', function () {
    beforeEach(function (ctx) {
      ctx.projects = [dummyProject(), dummyProject()]
      ctx.ProjectMock.expects('find')
        .withArgs({ owner_ref: ctx.user._id })
        .chain('exec')
        .resolves(ctx.projects)
      for (const project of ctx.projects) {
        ctx.ProjectMock.expects('findOne')
          .withArgs({ _id: project._id })
          .chain('exec')
          .resolves(project)
        ctx.ProjectMock.expects('deleteOne')
          .withArgs({ _id: project._id })
          .chain('exec')
          .resolves()
        ctx.DeletedProjectMock.expects('updateOne')
          .withArgs(
            { 'deleterData.deletedProjectId': project._id },
            {
              project,
              deleterData: sinon.match.has('deletedReason', 'account-deletion'),
            },
            { upsert: true }
          )
          .resolves()
      }
    })

    it('should delete all projects owned by the user', async function (ctx) {
      await ctx.ProjectDeleter.promises.deleteUsersProjects(ctx.user._id)
      ctx.ProjectMock.verify()
      ctx.DeletedProjectMock.verify()
    })

    it('should remove any collaboration from this user', async function (ctx) {
      await ctx.ProjectDeleter.promises.deleteUsersProjects(ctx.user._id)
      sinon.assert.calledWith(
        ctx.CollaboratorsHandler.promises.removeUserFromAllProjects,
        ctx.user._id
      )
      sinon.assert.calledOnce(
        ctx.CollaboratorsHandler.promises.removeUserFromAllProjects
      )
    })
  })

  describe('deleteProject', function () {
    beforeEach(function (ctx) {
      ctx.deleterData = {
        deletedAt: new Date(),
        deletedProjectId: ctx.project._id,
        deletedProjectOwnerId: ctx.project.owner_ref,
        deletedProjectCollaboratorIds: ctx.project.collaberator_refs,
        deletedProjectReadOnlyIds: ctx.project.readOnly_refs,
        deletedProjectReviewerIds: ctx.project.reviewer_refs,
        deletedProjectReadWriteTokenAccessIds:
          ctx.project.tokenAccessReadAndWrite_refs,
        deletedProjectReadOnlyTokenAccessIds:
          ctx.project.tokenAccessReadOnly_refs,
        deletedProjectReadWriteToken: ctx.project.tokens.readAndWrite,
        deletedProjectReadOnlyToken: ctx.project.tokens.readOnly,
        deletedProjectOverleafId: ctx.project.overleaf.id,
        deletedProjectOverleafHistoryId: ctx.project.overleaf.history.id,
        deletedProjectLastUpdatedAt: ctx.project.lastUpdated,
      }

      ctx.ProjectMock.expects('findOne')
        .withArgs({ _id: ctx.project._id })
        .chain('exec')
        .resolves(ctx.project)
    })

    it('stops before flush and archival when deletion recovery fails', async function (ctx) {
      ctx.project.documentDeletionTeardown = { operationId: 'closed' }
      ctx.recoverAcceptedDeletionsForProjectRemoval.rejects(new Error('recovery blocked'))
      await expect(ctx.ProjectDeleter.promises.deleteProject(ctx.project._id, { deleterUser: ctx.user })).to.be.rejectedWith('recovery blocked')
      expect(ctx.recoverAcceptedDeletionsForProjectRemoval).to.have.been.calledWithExactly(String(ctx.project._id), String(ctx.user._id))
      expect(ctx.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete).not.to.have.been.called
      expect(ctx.DocstoreManager.promises.archiveProject).not.to.have.been.called
    })

    it('archives the refreshed post-drain project snapshot', async function (ctx) {
      ctx.project.documentDeletionTeardown = { operationId: 'closed' }
      const fresh = { ...ctx.project, version: 900, rootFolder: [] }
      ctx.ProjectMock.expects('findOne').withArgs({ _id: ctx.project._id }).chain('exec').resolves(fresh)
      ctx.ProjectMock.expects('deleteOne').chain('exec').resolves()
      ctx.DeletedProjectMock.expects('updateOne').withArgs(
        { 'deleterData.deletedProjectId': ctx.project._id },
        { project: fresh, deleterData: ctx.deleterData }, { upsert: true }
      ).resolves()
      await ctx.ProjectDeleter.promises.deleteProject(ctx.project._id)
      expect(ctx.recoverAcceptedDeletionsForProjectRemoval).to.have.been.calledWithExactly(String(ctx.project._id), String(ctx.project.owner_ref))
      expect(ctx.recoverAcceptedDeletionsForProjectRemoval).to.have.been.calledBefore(ctx.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete)
    })

    it('should save a DeletedProject with additional deleterData', async function (ctx) {
      ctx.deleterData.deleterIpAddress = ctx.ip
      ctx.deleterData.deleterId = ctx.user._id
      ctx.deleterData.deletedReason = 'user'

      ctx.ProjectMock.expects('deleteOne').chain('exec').resolves()
      ctx.DeletedProjectMock.expects('updateOne')
        .withArgs(
          { 'deleterData.deletedProjectId': ctx.project._id },
          {
            project: ctx.project,
            deleterData: ctx.deleterData,
          },
          { upsert: true }
        )
        .resolves()

      await ctx.ProjectDeleter.promises.deleteProject(ctx.project._id, {
        deleterUser: ctx.user,
        ipAddress: ctx.ip,
        deletedReason: 'user',
      })
      ctx.DeletedProjectMock.verify()
    })

    it('should flushProjectToMongoAndDelete in doc updater', async function (ctx) {
      ctx.ProjectMock.expects('deleteOne').chain('exec').resolves()
      ctx.DeletedProjectMock.expects('updateOne').resolves()

      await ctx.ProjectDeleter.promises.deleteProject(ctx.project._id, {
        deleterUser: ctx.user,
        ipAddress: ctx.ip,
      })
      ctx.DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete
        .calledWith(ctx.project._id)
        .should.equal(true)
    })

    it('should flush docs out of mongo', async function (ctx) {
      ctx.ProjectMock.expects('deleteOne').chain('exec').resolves()
      ctx.DeletedProjectMock.expects('updateOne').resolves()
      await ctx.ProjectDeleter.promises.deleteProject(ctx.project._id, {
        deleterUser: ctx.user,
        ipAddress: ctx.ip,
      })
      expect(
        ctx.DocstoreManager.promises.archiveProject
      ).to.have.been.calledWith(ctx.project._id)
    })

    it('should flush docs out of mongo and ignore errors', async function (ctx) {
      ctx.ProjectMock.expects('deleteOne').chain('exec').resolves()
      ctx.DeletedProjectMock.expects('updateOne').resolves()
      ctx.DocstoreManager.promises.archiveProject.rejects(new Error('foo'))
      await ctx.ProjectDeleter.promises.deleteProject(ctx.project._id, {
        deleterUser: ctx.user,
        ipAddress: ctx.ip,
      })
    })

    it('should removeProjectFromAllTags', async function (ctx) {
      ctx.ProjectMock.expects('deleteOne').chain('exec').resolves()
      ctx.DeletedProjectMock.expects('updateOne').resolves()

      await ctx.ProjectDeleter.promises.deleteProject(ctx.project._id)
      sinon.assert.calledWith(
        ctx.TagsHandler.promises.removeProjectFromAllTags,
        'member-id-1',
        ctx.project._id
      )
      sinon.assert.calledWith(
        ctx.TagsHandler.promises.removeProjectFromAllTags,
        'member-id-2',
        ctx.project._id
      )
    })

    it('should remove the project from Mongo', async function (ctx) {
      ctx.ProjectMock.expects('deleteOne')
        .withArgs({ _id: ctx.project._id })
        .chain('exec')
        .resolves()
      ctx.DeletedProjectMock.expects('updateOne').resolves()

      await ctx.ProjectDeleter.promises.deleteProject(ctx.project._id)
      ctx.ProjectMock.verify()
    })
  })

  describe('expireDeletedProjectsAfterDuration', function () {
    beforeEach(async function (ctx) {
      for (const deletedProject of ctx.deletedProjects) {
        ctx.ProjectMock.expects('findById')
          .withArgs(deletedProject.deleterData.deletedProjectId)
          .chain('exec')
          .resolves(null)
      }
      ctx.DeletedProjectMock.expects('find')
        .withArgs({
          'deleterData.deletedAt': {
            $lt: new Date(moment().subtract(90, 'days')),
          },
          project: {
            $type: 'object',
          },
        })
        .chain('exec')
        .resolves(ctx.deletedProjects)

      for (const deletedProject of ctx.deletedProjects) {
        ctx.DeletedProjectMock.expects('findOne')
          .withArgs({
            'deleterData.deletedProjectId': deletedProject.project._id,
          })
          .chain('exec')
          .resolves(deletedProject)
        ctx.DeletedProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: deletedProject._id,
            },
            {
              $set: {
                'deleterData.deleterIpAddress': null,
                project: null,
              },
            }
          )
          .chain('exec')
          .resolves()
      }

      await ctx.ProjectDeleter.promises.expireDeletedProjectsAfterDuration()
    })

    it('should expire projects older than 90 days', function (ctx) {
      ctx.DeletedProjectMock.verify()
    })
  })

  describe('expireDeletedProject', function () {
    it('retains deletion reservations when native storage expiration fails', async function (ctx) {
      ctx.ProjectMock.expects('findById').chain('exec').resolves(null)
      ctx.DeletedProjectMock.expects('findOne').chain('exec').resolves(ctx.deletedProjects[0])
      ctx.DeletedProjectMock.expects('updateOne').never()
      ctx.DocstoreManager.promises.destroyProject.rejects(new Error('storage unavailable'))
      await expect(ctx.ProjectDeleter.promises.expireDeletedProject(ctx.deletedProjects[0].project._id))
        .to.be.rejectedWith('storage unavailable')
      expect(ctx.DocumentDeletionReservation.deleteMany).not.to.have.been.called
      ctx.DeletedProjectMock.verify()
    })

    it('keeps the expiration record retryable when reservation cleanup fails', async function (ctx) {
      ctx.ProjectMock.expects('findById').chain('exec').resolves(null)
      ctx.DeletedProjectMock.expects('findOne').chain('exec').resolves(ctx.deletedProjects[0])
      ctx.DeletedProjectMock.expects('updateOne').never()
      ctx.DocumentDeletionReservation.deleteMany.returns({
        exec: sinon.stub().rejects(new Error('reservation cleanup unavailable')),
      })
      await expect(ctx.ProjectDeleter.promises.expireDeletedProject(ctx.deletedProjects[0].project._id))
        .to.be.rejectedWith('reservation cleanup unavailable')
      ctx.DeletedProjectMock.verify()
    })

    for (const state of ['preparing', 'fenced', 'committing']) {
      it(`preserves all recovery data when a deletion is ${state}`, async function (ctx) {
        ctx.ProjectMock.expects('findById').chain('exec').resolves(null)
        ctx.DeletedProjectMock.expects('findOne').chain('exec').resolves(ctx.deletedProjects[0])
        ctx.DeletedProjectMock.expects('updateOne').never()
        ctx.DocumentDeletionReservation.collection.findOne.resolves({ _id: 'pending', state })
        await expect(ctx.ProjectDeleter.promises.expireDeletedProject(ctx.deletedProjects[0].project._id))
          .to.be.rejectedWith('Unfinished document deletion must be reconciled')
        expect(ctx.DocstoreManager.promises.destroyProject).not.to.have.been.called
        expect(ctx.HistoryManager.promises.deleteProject).not.to.have.been.called
        expect(ctx.WritingAssistTask.deleteMany).not.to.have.been.called
        expect(ctx.WritingAssistConversation.deleteMany).not.to.have.been.called
        expect(ctx.DocumentDeletionReservation.deleteMany).not.to.have.been.called
        expect(ctx.DocumentDeletionReservation.collection.findOne).to.have.been.calledWithExactly(
          { projectId: ctx.deletedProjects[0].project._id.toString(), state: { $ne: 'committed' } },
          { projection: { _id: 1 }, readPreference: 'primary' }
        )
        ctx.DeletedProjectMock.verify()
      })
    }

    it('does not expire recovery data when reservation lookup is unavailable', async function (ctx) {
      ctx.ProjectMock.expects('findById').chain('exec').resolves(null)
      ctx.DeletedProjectMock.expects('findOne').chain('exec').resolves(ctx.deletedProjects[0])
      ctx.DeletedProjectMock.expects('updateOne').never()
      ctx.DocumentDeletionReservation.collection.findOne.rejects(new Error('database unavailable'))
      await expect(ctx.ProjectDeleter.promises.expireDeletedProject(ctx.deletedProjects[0].project._id))
        .to.be.rejectedWith('database unavailable')
      expect(ctx.DocstoreManager.promises.destroyProject).not.to.have.been.called
      expect(ctx.WritingAssistTask.deleteMany).not.to.have.been.called
      ctx.DeletedProjectMock.verify()
    })

    describe('on an inactive project', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectMock.expects('findById')
          .withArgs(ctx.deletedProjects[0].deleterData.deletedProjectId)
          .chain('exec')
          .resolves(null)
        ctx.DeletedProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.deletedProjects[0]._id,
            },
            {
              $set: {
                'deleterData.deleterIpAddress': null,
                project: null,
              },
            }
          )
          .chain('exec')
          .resolves()

        ctx.DeletedProjectMock.expects('findOne')
          .withArgs({
            'deleterData.deletedProjectId': ctx.deletedProjects[0].project._id,
          })
          .chain('exec')
          .resolves(ctx.deletedProjects[0])

        await ctx.ProjectDeleter.promises.expireDeletedProject(
          ctx.deletedProjects[0].project._id
        )
      })

      it('should find the specified deletedProject and remove its project and ip address', function (ctx) {
        ctx.DeletedProjectMock.verify()
      })

      it('should destroy the docs in docstore', function (ctx) {
        expect(
          ctx.DocstoreManager.promises.destroyProject
        ).to.have.been.calledWith(ctx.deletedProjects[0].project._id)
      })

      it('should delete the project in history', function (ctx) {
        expect(
          ctx.HistoryManager.promises.deleteProject
        ).to.have.been.calledWith(
          ctx.deletedProjects[0].project._id,
          ctx.deletedProjects[0].project.overleaf.history.id
        )
      })

      it('should destroy the chat threads and messages', function (ctx) {
        expect(
          ctx.ChatApiHandler.promises.destroyProject
        ).to.have.been.calledWith(ctx.deletedProjects[0].project._id)
      })

      it('should remove private assistant transcripts and snapshots only for this expired project', function (ctx) {
        const query = {
          projectId: ctx.deletedProjects[0].project._id.toString(),
        }
        expect(
          ctx.WritingAssistConversation.deleteMany
        ).to.have.been.calledWithExactly(query)
        expect(ctx.WritingAssistTask.deleteMany).to.have.been.calledWithExactly(
          query
        )
      })

      it('removes only committed deletion reservations for the expired project', function (ctx) {
        expect(ctx.DocumentDeletionReservation.deleteMany).to.have.been.calledWithExactly({
          projectId: ctx.deletedProjects[0].project._id.toString(),
          state: 'committed',
        })
      })

      it('should delete audit logs', async function (ctx) {
        expect(ctx.ProjectAuditLogEntry.deleteMany).to.have.been.calledWith({
          projectId: ctx.deletedProjects[0].project._id,
        })
      })

      it('should log a completed deletion', async function (ctx) {
        expect(ctx.logger.info).toHaveBeenCalledWith(
          {
            projectId: ctx.deletedProjects[0].project._id,
            userId: ctx.user._id,
          },
          'expired deleted project successfully'
        )
      })
    })

    describe('on an active project (from an incomplete delete)', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectMock.expects('findById')
          .withArgs(ctx.deletedProjects[0].deleterData.deletedProjectId)
          .chain('exec')
          .resolves(ctx.deletedProjects[0].project)
        ctx.DeletedProjectMock.expects('deleteOne')
          .withArgs({
            'deleterData.deletedProjectId': ctx.deletedProjects[0].project._id,
          })
          .chain('exec')
          .resolves()
        await ctx.ProjectDeleter.promises.expireDeletedProject(
          ctx.deletedProjects[0].project._id
        )
      })

      it('should preserve assistant transcripts for an active project', function (ctx) {
        expect(ctx.WritingAssistConversation.deleteMany).not.to.have.been.called
        expect(ctx.WritingAssistTask.deleteMany).not.to.have.been.called
        expect(ctx.DocumentDeletionReservation.deleteMany).not.to.have.been.called
      })

      it('should delete the spurious deleted project record', function (ctx) {
        ctx.DeletedProjectMock.verify()
      })

      it('should not destroy the docs in docstore', function (ctx) {
        expect(ctx.DocstoreManager.promises.destroyProject).to.not.have.been
          .called
      })

      it('should not delete the project in history', function (ctx) {
        expect(ctx.HistoryManager.promises.deleteProject).to.not.have.been
          .called
      })

      it('should not destroy the chat threads and messages', function (ctx) {
        expect(ctx.ChatApiHandler.promises.destroyProject).to.not.have.been
          .called
      })
    })
  })

  describe('archiveProject', function () {
    beforeEach(function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: ctx.project._id },
          {
            $addToSet: { archived: new ObjectId(ctx.user._id) },
            $pull: { trashed: new ObjectId(ctx.user._id) },
          }
        )
        .resolves()
    })

    it('should update the project', async function (ctx) {
      await ctx.ProjectDeleter.promises.archiveProject(
        ctx.project._id,
        ctx.user._id
      )
      ctx.ProjectMock.verify()
    })
  })

  describe('unarchiveProject', function () {
    beforeEach(function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: ctx.project._id },
          { $pull: { archived: new ObjectId(ctx.user._id) } }
        )
        .resolves()
    })

    it('should update the project', async function (ctx) {
      await ctx.ProjectDeleter.promises.unarchiveProject(
        ctx.project._id,
        ctx.user._id
      )
      ctx.ProjectMock.verify()
    })
  })

  describe('trashProject', function () {
    beforeEach(function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: ctx.project._id },
          {
            $addToSet: { trashed: new ObjectId(ctx.user._id) },
            $pull: { archived: new ObjectId(ctx.user._id) },
          }
        )
        .resolves()
    })

    it('should update the project', async function (ctx) {
      await ctx.ProjectDeleter.promises.trashProject(
        ctx.project._id,
        ctx.user._id
      )
      ctx.ProjectMock.verify()
    })
  })

  describe('untrashProject', function () {
    beforeEach(function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          { _id: ctx.project._id },
          { $pull: { trashed: new ObjectId(ctx.user._id) } }
        )
        .resolves()
    })

    it('should update the project', async function (ctx) {
      await ctx.ProjectDeleter.promises.untrashProject(
        ctx.project._id,
        ctx.user._id
      )
      ctx.ProjectMock.verify()
    })
  })

  describe('restoreProject', function () {
    beforeEach(function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: ctx.project._id,
          },
          {
            $unset: { archived: true },
          }
        )
        .chain('exec')
        .resolves()
    })

    it('should unset the archive attribute', async function (ctx) {
      await ctx.ProjectDeleter.promises.restoreProject(ctx.project._id)
    })
  })

  describe('undeleteProject', function () {
    beforeEach(function (ctx) {
      ctx.unknownProjectId = new ObjectId()
      ctx.purgedProjectId = new ObjectId()

      ctx.deletedProject = {
        _id: 'deleted',
        project: ctx.project,
        deleterData: {
          deletedProjectId: ctx.project._id,
          deletedProjectOwnerId: ctx.project.owner_ref,
        },
      }
      ctx.purgedProject = {
        _id: 'purged',
        deleterData: {
          deletedProjectId: ctx.purgedProjectId,
          deletedProjectOwnerId: 'potato',
        },
      }

      ctx.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': ctx.project._id },
          '+project.deletionReceipts +project.deletionHistoryPending +project.documentDeletionAdmissions +project.documentDeletionTeardown')
        .chain('exec')
        .resolves(ctx.deletedProject)
      ctx.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': ctx.purgedProjectId },
          '+project.deletionReceipts +project.deletionHistoryPending +project.documentDeletionAdmissions +project.documentDeletionTeardown')
        .chain('exec')
        .resolves(ctx.purgedProject)
      ctx.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': ctx.unknownProjectId },
          '+project.deletionReceipts +project.deletionHistoryPending +project.documentDeletionAdmissions +project.documentDeletionTeardown')
        .chain('exec')
        .resolves(null)
      ctx.DeletedProjectMock.expects('deleteOne').chain('exec').resolves()
    })

    it('refuses restoration while an accepted admission remains', async function (ctx) {
      ctx.deletedProject.project.documentDeletionAdmissions = { doc: { operationId: 'pending' } }
      await expect(ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)).to.be.rejectedWith('unfinished document deletions')
      expect(ctx.db.projects.insertOne).not.to.have.been.called
    })

    it('refuses restoration while a reservation remains', async function (ctx) {
      ctx.DocumentDeletionReservation.collection.findOne.resolves({ _id: 'pending' })
      await expect(ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)).to.be.rejectedWith('unfinished document deletions')
      expect(ctx.db.projects.insertOne).not.to.have.been.called
    })

    it('refuses restoration while history confirmation is pending', async function (ctx) {
      ctx.deletedProject.project.deletionHistoryPending = 'pending-operation'
      await expect(ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)).to.be.rejectedWith('unfinished document deletions')
      expect(ctx.db.projects.insertOne).not.to.have.been.called
    })

    it('reopens only a drained restored project and preserves terminal receipts', async function (ctx) {
      ctx.deletedProject.project.documentDeletionTeardown = { operationId: 'closed' }
      ctx.deletedProject.project.documentDeletionAdmissions = {}
      ctx.deletedProject.project.deletionReceipts = { completed: { historyConfirmed: true } }
      await ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)
      const restored = ctx.db.projects.insertOne.firstCall.args[0]
      expect(restored.documentDeletionTeardown).to.equal(undefined)
      expect(restored.documentDeletionAdmissions).to.equal(undefined)
      expect(restored.deletionReceipts.get('completed')).to.deep.equal({ historyConfirmed: true })
    })

    it('should return not found if the project does not exist', async function (ctx) {
      await expect(
        ctx.ProjectDeleter.promises.undeleteProject(
          ctx.unknownProjectId.toString()
        )
      ).to.be.rejectedWith(Errors.NotFoundError, 'project_not_found')
    })

    it('should return not found if the project has been expired', async function (ctx) {
      await expect(
        ctx.ProjectDeleter.promises.undeleteProject(
          ctx.purgedProjectId.toString()
        )
      ).to.be.rejectedWith(Errors.NotFoundError, 'project_too_old_to_restore')
    })

    it('should insert the project into the collection', async function (ctx) {
      await ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)
      sinon.assert.calledWith(
        ctx.db.projects.insertOne,
        sinon.match({
          _id: ctx.project._id,
          name: ctx.project.name,
        })
      )
    })

    it('should clear the archive bit', async function (ctx) {
      ctx.project.archived = true
      await ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)
      sinon.assert.calledWith(
        ctx.db.projects.insertOne,
        sinon.match({ archived: undefined })
      )
    })

    it('should generate a unique name for the project', async function (ctx) {
      await ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)
      sinon.assert.calledWith(
        ctx.ProjectDetailsHandler.promises.generateUniqueName,
        ctx.project.owner_ref
      )
    })

    it('should add a suffix to the project name', async function (ctx) {
      await ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)
      sinon.assert.calledWith(
        ctx.ProjectDetailsHandler.promises.generateUniqueName,
        ctx.project.owner_ref,
        ctx.project.name + ' (Restored)'
      )
    })

    it('should remove the DeletedProject', async function (ctx) {
      // need to change the mock just to include the methods we want
      ctx.DeletedProjectMock.restore()
      ctx.DeletedProjectMock = sinon.mock(DeletedProject)
      ctx.DeletedProjectMock.expects('findOne')
        .withArgs({ 'deleterData.deletedProjectId': ctx.project._id })
        .chain('exec')
        .resolves(ctx.deletedProject)
      ctx.DeletedProjectMock.expects('deleteOne')
        .withArgs({ _id: 'deleted' })
        .chain('exec')
        .resolves()

      await ctx.ProjectDeleter.promises.undeleteProject(ctx.project._id)
      ctx.DeletedProjectMock.verify()
    })
  })
})

function dummyProject() {
  return {
    _id: new ObjectId(),
    lastUpdated: new Date(),
    rootFolder: [],
    collaberator_refs: [new ObjectId(), new ObjectId()],
    readOnly_refs: [new ObjectId(), new ObjectId()],
    reviewer_refs: [new ObjectId()],
    tokenAccessReadAndWrite_refs: [new ObjectId(), new ObjectId()],
    tokenAccessReadOnly_refs: [new ObjectId(), new ObjectId()],
    owner_ref: new ObjectId(),
    tokens: {
      readOnly: 'wombat',
      readAndWrite: 'potato',
    },
    overleaf: {
      id: 1234,
      history: {
        id: 5678,
      },
    },
    name: 'a very scientific analysis of spooky ghosts',
  }
}
