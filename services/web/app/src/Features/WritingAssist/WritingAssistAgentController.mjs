import { applicationOutcomeFields } from './WritingAssistApplicationOutcome.mjs'
import Path from 'node:path'
import { readAccessPolicy } from '../NativeGit/AccessPolicy.mjs'
import {resolveCheckIssues,completeCheckIssues} from '../SubmissionDeadlines/TrackCheckReportStore.mjs'
import { pluginLibrary } from '../Plugins/SkillPluginLibrary.mjs'
import { createSkillResolver } from '../Plugins/SkillInvocation.mjs'
import settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import Errors from '../Errors/Errors.js'
import EditorController from '../Editor/EditorController.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import { WritingAssistTask } from '../../models/WritingAssistTask.mjs'
import { Project } from '../../models/Project.mjs'
import { workspaceIdentity } from './WritingAssistWorkspaceIdentity.mjs'
import { applicationAcknowledgement, validatedApplicationAcknowledgement } from './WritingAssistApplicationAcknowledgement.mjs'
import { createAgentWriteTransaction } from './WritingAssistWriteTransaction.mjs'
import { withPreparedProjectWrite } from '../NativeGit/ProjectWriteAccess.mjs'
import { withProjectOperationLock } from '../NativeGit/ProjectOperationLock.mjs'
import ProjectWriteGate from '@overleaf/redis-wrapper/ProjectWriteGate.js'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import { assertCitationAbsent } from './WritingAssistCitationService.mjs'
import { createAgentService, AgentError } from './WritingAssistAgentService.mjs'
import { collectProjectAssets } from './WritingAssistProjectAssets.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import {
  PROJECT_TEXT_EXTENSION,
  validateProjectPath,
} from '@overleaf/validation-tools/project-input.mjs'

import { createHash } from 'node:crypto'
import { createDeletionTaskRetention } from './DocumentDeletionTaskRetention.mjs'
import LockManager from '../../infrastructure/LockManager.mjs'
import { DocumentDeletionReservation } from '../../models/DocumentDeletionReservation.mjs'
import { createDocumentDeletionReservations } from './DocumentDeletionReservations.mjs'
import { createDocumentDeletionCoordinator } from './DocumentDeletionCoordinator.mjs'
import { projectDeletionAdmission, settleDeletionAdmission, beginAdmittedDeletion, settleAdmittedDeletion } from './DocumentDeletionAdmissionService.mjs'
import { preflightDeletionHistory } from './DocumentDeletionHistoryService.mjs'
import { commitDeletion, inspectDeletion, notifyDeletionCommitted } from './DocumentDeletionCommitService.mjs'

const deletionTaskRetention = createDeletionTaskRetention(WritingAssistTask.collection)
const taskQuery = (id, userId, projectId) => ({ _id: id, userId, projectId })
export const agentStore = {
  async create(task) {
    await WritingAssistTask.create({ ...task, _id: task.id })
  },
  async find(id, userId, projectId, { includeRecommendationCatalog = false } = {}) {
    const task = await WritingAssistTask.findOne(
      taskQuery(id, userId, projectId),
      includeRecommendationCatalog ? undefined : { recommendationCatalog: 0 },
    )
      .lean()
      .exec()
    return task && { ...task, id: task._id }
  },
  async finish(id, fields) {
    await WritingAssistTask.updateOne(
      { _id: id, status: { $in: ['preparing', 'submitting', 'running'] } },
      { $set: fields },
    ).exec()
  },
  async recordClaimApplication(id, userId, projectId, proposalId, claimInput, claimReview) {
    const result = await WritingAssistTask.updateOne(
      { ...taskQuery(id, userId, projectId), status: 'completed', proposals: { $elemMatch: { id: proposalId, status: 'accepted' } } },
      { $set: { claimInput, claimReview, summary: 'Citation suggestion applied.' } },
    ).exec()
    if (result.matchedCount !== 1) throw new Error('Accepted citation application not found')
  },
  async recordReferenceApplication(id, userId, projectId, proposalId, referenceReview, summary) {
    const result = await WritingAssistTask.updateOne(
      { ...taskQuery(id, userId, projectId), status: 'completed',
        proposals: { $elemMatch: { id: proposalId, status: 'accepted' } } },
      { $set: { referenceReview, summary } },
    ).exec()
    if (result.matchedCount !== 1) throw new AgentError(409, 'Reference application could not be recorded; check again')
  },
  async prepare(id, documents) {
    const result = await WritingAssistTask.updateOne(
      { _id: id, status: 'preparing' },
      { $set: { documents, status: 'submitting' } },
    ).exec()
    return result.modifiedCount === 1
  },
  async markRunning(id) {
    const result = await WritingAssistTask.updateOne(
      { _id: id, status: 'submitting' },
      { $set: { status: 'running' } },
    ).exec()
    return result.modifiedCount === 1
  },
  async claim(id, proposalId, status) {
    if (status === 'applying') return deletionTaskRetention.claimApplication(id, proposalId)
    const result = await WritingAssistTask.updateOne(
      {
        _id: id,
        status: 'completed',
        proposals: { $elemMatch: { id: proposalId, status: 'pending' } },
      },
      { $set: { 'proposals.$.status': status } },
    ).exec()
    return result.modifiedCount === 1
  },
  claimDeletion: (id, proposalId) => deletionTaskRetention.claim(id, proposalId),
  async recordApplicationAcknowledgement(task, proposal) {
    const result = await WritingAssistTask.updateOne({
      ...taskQuery(task.id, task.userId, task.projectId), status: 'completed', workspaceIdentity: task.workspaceIdentity || null,
      applicationOutcome: task.applicationOutcome || { $exists: false },
      proposals: { $elemMatch: { id: proposal.id, status: 'applying', before: proposal.before, after: proposal.after,
        path: proposal.path, docId: proposal.docId || { $exists: false }, mode: proposal.mode || { $exists: false },
        version: proposal.version ?? { $exists: false }, applicationAcknowledgement: { $exists: false } } },
    }, { $set: { 'proposals.$.applicationAcknowledgement': applicationAcknowledgement(task, proposal) } }).exec()
    if (result.matchedCount !== 1) throw new AgentError(502, 'Application acknowledgement could not be recorded')
  },
  claimDeletionRetry: (id, proposalId) => deletionTaskRetention.claim(id, proposalId, true),
  async recoverAcknowledged(task, proposal) {
    const outcomeFields = applicationOutcomeFields(task, proposal)
    const result = await WritingAssistTask.updateOne({
      ...taskQuery(task.id, task.userId, task.projectId), status: 'completed', workspaceIdentity: task.workspaceIdentity || null,
      applicationOutcome: task.applicationOutcome || { $exists: false },
      proposals: { $elemMatch: { id: proposal.id, status: proposal.status,
        before: proposal.before, after: proposal.after, path: proposal.path,
        docId: proposal.docId || { $exists: false }, mode: proposal.mode || { $exists: false },
        version: proposal.version ?? { $exists: false },
        applicationAcknowledgement: proposal.applicationAcknowledgement } },
    }, { $set: { ...outcomeFields, 'proposals.$.status': 'accepted', 'proposals.$.applicationRecovery': proposal.applicationRecovery || {
      kind: 'server-acknowledgement', recoveredAt: new Date().toISOString(), userId: task.userId,
    } } }).exec()
    if (result.matchedCount !== 1) return false
    await deletionTaskRetention.releaseCompleted(task.id)
    return true
  },
  async closeUnconfirmed(task, proposal, disposition) {
    const result = await WritingAssistTask.updateOne({
      ...taskQuery(task.id, task.userId, task.projectId), status: 'completed',
      workspaceIdentity: task.workspaceIdentity || null,
      proposals: { $elemMatch: { ...proposal, status: proposal.status,
        applicationAcknowledgement: Object.hasOwn(proposal, 'applicationAcknowledgement') ? proposal.applicationAcknowledgement : { $exists: false } } },
    }, { $set: { 'proposals.$.status': 'closed-unconfirmed', 'proposals.$.applicationDisposition': disposition,
      applicationRetention: true }, $unset: { expiresAt: 1 } }).exec()
    return result.modifiedCount === 1
  },
  releaseApplicationRetention: id => deletionTaskRetention.releaseCompleted(id),
  async settle(id, proposalId, status) {
    if (await settleAdmittedDeletion(id, proposalId, status)) {
      await deletionTaskRetention.releaseCompleted(id)
      return
    }
    if (status === 'accepted') {
      const saved = await WritingAssistTask.findById(id).lean().exec()
      if (saved?.applicationOutcome) {
        const task = { ...saved, id: saved._id }
        const proposal = saved.proposals.find(value => value.id === proposalId)
        if (!proposal || !validatedApplicationAcknowledgement(task, proposal)) throw new AgentError(409, 'Workflow settlement requires a valid application acknowledgement')
        const fields = applicationOutcomeFields(task, proposal)
        const result = await WritingAssistTask.updateOne({
          _id: id, status: 'completed', applicationOutcome: saved.applicationOutcome,
          proposals: { $elemMatch: { ...proposal, status: 'applying' } },
        }, { $set: { ...fields, 'proposals.$.status': 'accepted' } }).exec()
        if (result.matchedCount !== 1) throw new AgentError(409, 'Workflow changed before settlement')
        await deletionTaskRetention.releaseCompleted(id)
        return
      }
    }
    await WritingAssistTask.updateOne(
      {
        _id: id,
        proposals: { $elemMatch: { id: proposalId, status: 'applying' } },
      },
      { $set: { 'proposals.$.status': status } },
    ).exec()
    await settleDeletionAdmission(id, proposalId)
    await deletionTaskRetention.releaseCompleted(id)
  },
}

const reviewedDeletionEnabled = () => settings.documentupdater?.reviewedDeletionEnabled === true
const executeDeletion = createDocumentDeletionCoordinator({
  beginAdmittedDeletion,
  admitDeletion: input => projectDeletionAdmission.admit(input),
  preflightHistory: preflightDeletionHistory,
  reservations: createDocumentDeletionReservations(DocumentDeletionReservation.collection),
  authorize: async input => {
    if (!reviewedDeletionEnabled()) throw new AgentError(422, 'Reviewed document deletion is not enabled')
    if (!(await AuthorizationManager.promises.canUserWriteProjectContent(input.userId, input.projectId))) {
      throw new AgentError(403, 'Project write access required')
    }
  },
  verifyAcceptedProposal: async input => {
    const task = await agentStore.find(input.taskId, input.userId, input.projectId)
    const proposal = task?.proposals?.find(item => item.id === input.proposalId)
    if (task?.status !== 'completed' || proposal?.mode !== 'delete-document' || proposal.status !== 'applying' ||
        proposal.docId !== input.docId || proposal.path !== input.path || proposal.version !== input.expectedVersion ||
        typeof proposal.before !== 'string' || createHash('sha256').update(proposal.before).digest('hex') !== input.baseHash) {
      throw new AgentError(409, 'Deletion proposal is not accepted for execution')
    }
    if (!(await deletionTaskRetention.holdApplying(input.taskId, input.proposalId))) {
      throw new AgentError(409, 'Deletion task could not be retained')
    }
  },
  withProjectLock: async (projectId, action) => {
    const writer = ProjectWriteGate.current(projectId)
    if (writer?.structureLocked && writer.assertWrite) {
      await writer.assertWrite()
      return action()
    }
    return LockManager.promises.runWithLock('sequentialProjectStructureUpdateLock', projectId, action)
  },
  prepareDocument: DocumentUpdaterHandler.promises.prepareDocumentDeletion,
  commitDeletion, inspectDeletion, notifyCommitted: notifyDeletionCommitted,
})

async function readDocument(projectId, docId) {
  const { docs } = await ProjectEntityHandler.promises.getAllEntities(projectId)
  if (!docs.some(({ doc }) => doc._id.toString() === docId)) {
    throw new AgentError(409, 'Document is no longer in this project')
  }
  return await DocumentUpdaterHandler.promises.getDocument(projectId, docId, -1)
}

export async function snapshot(projectId) {
  const { docs } = await ProjectEntityHandler.promises.getAllEntities(projectId)
  const selected = docs.filter(({ path }) => PROJECT_TEXT_EXTENSION.test(path))
  if (selected.length > 100)
    throw new AgentError(422, 'Project has more than 100 text documents')
  const documents = []
  let size = 0
  for (const { path, doc } of selected) {
    const id = doc._id.toString()
    const value = await DocumentUpdaterHandler.promises.getDocument(
      projectId,
      id,
      -1, // Fetch the latest snapshot without requesting historical operations.
    )
    if (!Array.isArray(value.lines) || !Number.isSafeInteger(value.version)) {
      throw new AgentError(422, 'Unsupported document representation')
    }
    const content = value.lines.join('\n')
    size += Buffer.byteLength(content)
    if (size > 2000000)
      throw new AgentError(
        422,
        'Project text exceeds the 2 MB snapshot limit',
      )
    documents.push({
      id,
      path: path.replace(/^\//, ''),
      content,
      version: value.version,
    })
  }
  return documents
}

async function daemon(path, method, body) {
  const { agentEndpoint, agentToken } = settings.writingAssist || {}
  if (!agentEndpoint || !agentToken)
    throw new AgentError(
      503,
      'Local agent endpoint and token are not configured',
    )
  try {
    const response = await fetch(`${agentEndpoint.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Token': agentToken,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      if (response.status === 404) {
        const detail = await response.json().catch(() => null)
        if (detail?.code === 'TASK_NOT_FOUND')
          throw new AgentError(
            502,
            'Local agent task was lost',
            'TASK_NOT_FOUND',
          )
      }
      throw new AgentError(
        response.status === 429 ? 429 : 502,
        response.status === 429
          ? 'Local agent is busy'
          : 'Local agent request failed',
      )
    }
    return await response.json()
  } catch (error) {
    if (error instanceof AgentError) throw error
    throw new AgentError(502, 'Local agent is unreachable')
  }
}

export const readWorkspaceIdentity = async projectId => workspaceIdentity(projectId,
  await Project.findById(projectId)
    .select('gitWorkspace gitWorkspaceFenceEnabled gitWorkspaceEpoch').lean().exec())
const agentWriteLocks = LockManager.withTimeout(6 * 60)

export const agentService = createAgentService({
  readWorkspaceIdentity,
  withApplicationLock: (id, action) => withProjectOperationLock(agentWriteLocks, 'nativeGitProject', id, action),
  withWriteTransaction: createAgentWriteTransaction({
    readIdentity: readWorkspaceIdentity,
    withProjectLock: (id, action) => withProjectOperationLock(agentWriteLocks, 'nativeGitProject', id, action),
    withPreparedWrite: withPreparedProjectWrite,
    authorize: async (userId, projectId) => {
      if (!await AuthorizationManager.promises.canUserWriteProjectContent(userId, projectId)) {
        throw new AgentError(403, 'Project write access required')
      }
    },
  }),
  authorizeWrite: async (userId, projectId) => {
    const policy = await readAccessPolicy(Path.join(settings.nativeGit?.storagePath || '/var/lib/overleaf/native-git', String(projectId)), String(userId))
    if (policy.mode === 'read-only') throw new AgentError(403, 'Read-only mode: change the mode in Paper Assistant before applying file changes.')
  },
  resolveSkill: createSkillResolver(pluginLibrary),
  resolveRequest: resolveCheckIssues,
  completeRequest: task=>completeCheckIssues(task,()=>snapshot(task.projectId)),
  store: agentStore,
  allowDeletion: reviewedDeletionEnabled,
  deleteDocument: (userId, projectId, taskId, proposal) => executeDeletion({
    userId, projectId, taskId, proposalId: proposal.id, docId: proposal.docId,
    path: proposal.path, expectedVersion: proposal.version,
    baseHash: createHash('sha256').update(proposal.before).digest('hex'),
  }),
  snapshot,
  listContext: async projectId => {
    const {docs,files,folders:projectFolders}=await ProjectEntityHandler.promises.getAllEntities(projectId)
    const paths=[...docs,...files].map(item=>item.path.replace(/^\//,""));const folders=new Set(projectFolders.map(f=>f.path.replace(/^\//,"" )).filter(Boolean))
    for(const path of paths){const parts=path.split("/");for(let i=1;i<parts.length;i++)folders.add(parts.slice(0,i).join("/"))}
    return [...folders].sort().map(path=>({kind:"folder",path})).concat(paths.sort().map(path=>({kind:"file",path})))
  },
  snapshotAssets: (projectId) =>
    collectProjectAssets(projectId, {
      listEntities: ProjectEntityHandler.promises.getAllEntities,
      readBlob: (id, hash, signal) =>
        HistoryManager.promises.requestBlobWithProjectId(
          id,
          hash,
          'GET',
          '',
          signal,
        ),
    }),
  daemon,
  readDocument,
  validateProposal: async (projectId, proposal) => {
    if (proposal.citation || proposal.citations) {
      const currentDocuments = await snapshot(projectId)
      for (const citation of proposal.citations || [proposal.citation])
        assertCitationAbsent(currentDocuments, citation)
    }
  },
  createDocument: async (projectId, path, lines, userId) => {
    try {
      const parts = validateProjectPath(path)
      const name = parts.pop()
      const folder = parts.length
        ? await EditorController.promises.mkdirp(
            projectId,
            parts.join('/'),
            userId,
          )
        : null
      return await EditorController.promises.addDoc(
        projectId,
        folder?.lastFolder?._id || null,
        name,
        lines,
        'writing-assist',
        userId,
      )
    } catch (error) {
      if (error instanceof Errors.DuplicateNameError)
        throw new AgentError(409, 'A file with this name already exists')
      throw error
    }
  },
  canWrite: (userId, projectId) =>
    AuthorizationManager.promises.canUserWriteProjectContent(userId, projectId),
  writeDocument: (projectId, docId, userId, lines, version) =>
    DocumentUpdaterHandler.promises.setDocument(
      projectId,
      docId,
      userId,
      lines,
      'writing-assist',
      version,
    ),
})

const service = agentService

const params = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i),
  taskId: z.string().uuid().optional(),
  proposalId: z.string().uuid().optional(),
})
const schemas = {
  create: z.object({
    params,
    body: z.object({ instruction: z.string().trim().min(1).max(32000) }),
  }),
  get: z.object({ params }),
  models: z.object({ params }),
  cancel: z.object({ params }),
  decide: z.object({ params, body: z.object({ accept: z.boolean() }) }),
  inspect: z.object({ params }),
  recover: z.object({ params, body: z.object({}) }),
  closeUnconfirmed: z.object({ params, body: z.object({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/), decision: z.literal('close-without-retry') }) }),
}

function handler(action) {
  return expressify(async (req, res) => {
    const parsed = parseReq(req, schemas[action])
    const { projectId, taskId, proposalId } = parsed.params
    const userId = SessionManager.getLoggedInUserId(req.session).toString()
    try {
      let result
      if (action === 'create')
        result = await service.create(
          userId,
          projectId,
          parsed.body.instruction,
        )
      else if (action === 'closeUnconfirmed')
        result = await service.closeUnconfirmed(userId, projectId, taskId, proposalId, parsed.body)
      else if (action === 'inspect' || action === 'recover')
        result = await service[action](userId, projectId, taskId, proposalId)
      else if (action === 'decide')
        result = await service.decide(
          userId,
          projectId,
          taskId,
          proposalId,
          parsed.body.accept,
        )
      else result = await service[action](userId, projectId, taskId)
      res.status(action === 'create' ? 201 : 200).json(result)
    } catch (error) {
      if (!(error instanceof AgentError)) throw error
      res.status(error.status).json({ error: error.message })
    }
  })
}

export default {
  create: handler('create'),
  get: handler('get'),
  models: handler('models'),
  cancel: handler('cancel'),
  decide: handler('decide'),
  inspect: handler('inspect'),
  recover: handler('recover'),
  closeUnconfirmed: handler('closeUnconfirmed'),
}
