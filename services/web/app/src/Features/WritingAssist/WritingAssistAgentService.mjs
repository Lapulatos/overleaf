import { createApplicationDisposition } from './WritingAssistApplicationDisposition.mjs'
import { normalizeScope, assertScopedProposals, scopeInstruction } from './WritingAssistScope.mjs'
import { buildClaimReview } from './WritingAssistClaimReview.mjs'
import { boundedActivity } from './WritingAssistActivity.mjs'
import { resolveSourceSelection } from './WritingAssistSelection.mjs'
import { validateImages } from '@overleaf/validation-tools/image-input.mjs'
import { randomUUID, createHash } from 'node:crypto'
import { parsePatch, applyPatch } from 'diff'
import { validateProjectPath } from '@overleaf/validation-tools/project-input.mjs'
import { assertWorkspaceIdentity } from './WritingAssistWorkspaceIdentity.mjs'
import { createApplicationInspection } from './WritingAssistApplicationInspection.mjs'
import { createApplicationRecovery } from './WritingAssistApplicationRecovery.mjs'

import { AgentError } from './WritingAssistErrors.mjs'
export { AgentError } from './WritingAssistErrors.mjs'

// Only exact, complete patches against the server-captured snapshot are eligible
// for acceptance. New files use explicit creation proposals, never fuzzy patches.
export function buildProposals(diffs, documents, { allowDeletion = false } = {}) {
  const proposals = []
  const seen = new Set()
  let totalSize = 0
  for (const diff of diffs) {
    if (typeof diff.content !== 'string')
      throw new AgentError(422, 'Invalid change proposal')
    if (diff.kind === 'delete' && allowDeletion) {
      const doc = documents.find(item => item.path === diff.path)
      if (!doc || seen.has(doc.path) || diff.content !== doc.content || diff.version !== doc.version) {
        throw new AgentError(422, 'Deletion does not match the document snapshot')
      }
      totalSize += doc.content.length
      if (totalSize > 2000000) throw new AgentError(422, 'Proposed changes exceed the task size limit')
      seen.add(doc.path)
      proposals.push({ id: randomUUID(), mode: 'delete-document', path: doc.path,
        docId: doc.id, version: doc.version, before: doc.content, after: '', status: 'pending' })
      continue
    }
    if (diff.kind === 'create') {
      try {
        validateProjectPath(diff.path)
      } catch {
        throw new AgentError(422, 'Unsupported new document path')
      }
      if (
        documents.some(
          (doc) => doc.path.toLowerCase() === diff.path.toLowerCase(),
        ) ||
        [...seen].some((path) => path.toLowerCase() === diff.path.toLowerCase())
      )
        throw new AgentError(422, 'New document already exists or is repeated')
      if (diff.content.length > 500000)
        throw new AgentError(422, 'Proposed document is too large')
      totalSize += diff.content.length
      if (totalSize > 2000000)
        throw new AgentError(422, 'Proposed changes exceed the task size limit')
      seen.add(diff.path)
      proposals.push({
        id: randomUUID(),
        mode: 'create-document',
        path: diff.path,
        before: '',
        after: diff.content,
        status: 'pending',
      })
      continue
    }
    if (diff.kind !== undefined && diff.kind !== 'edit')
      throw new AgentError(422, 'Unsupported document operation')
    const patches = parsePatch(diff.content, { strict: true })
    if (!patches.length)
      throw new AgentError(422, 'No patch found in change proposal')
    for (const patch of patches) {
      const path = patch.oldFileName?.replace(/^a\//, '')
      const target = patch.newFileName?.replace(/^b\//, '')
      const doc = documents.find((doc) => doc.path === path)
      if (!doc || path !== target || seen.has(path) || !patch.hunks.length) {
        throw new AgentError(
          422,
          'Proposal has an unknown, repeated or renamed file',
        )
      }
      const originalLines = doc.content.split('\n')
      let previousEnd = 0
      for (const hunk of patch.hunks) {
        const start = hunk.oldLines === 0 ? hunk.oldStart : hunk.oldStart - 1
        if (start < previousEnd || start < 0 || start > originalLines.length) {
          throw new AgentError(422, 'Invalid patch position')
        }
        let line = start
        for (const entry of hunk.lines) {
          if (entry[0] === ' ' || entry[0] === '-') {
            if (originalLines[line++] !== entry.slice(1)) {
              throw new AgentError(
                422,
                'Proposal does not match the document snapshot',
              )
            }
          }
        }
        previousEnd = line
      }
      const after = applyPatch(doc.content, patch, { fuzzFactor: 0 })
      if (after === false)
        throw new AgentError(
          422,
          'Proposal could not be applied to the snapshot',
        )
      if (after === doc.content) continue
      if (after.length > 500000)
        throw new AgentError(422, 'Proposed document is too large')
      totalSize += after.length + doc.content.length
      if (totalSize > 2000000)
        throw new AgentError(422, 'Proposed changes exceed the task size limit')
      seen.add(path)
      proposals.push({
        id: randomUUID(),
        docId: doc.id,
        path,
        version: doc.version,
        before: doc.content,
        after,
        status: 'pending',
      })
    }
  }
  return proposals
}

const terminal = new Set(['completed', 'failed', 'cancelled', 'timeout'])

/** Dependencies are explicit so authorization and write ordering can be tested
 * independently of MongoDB and a running paid model. */
export function createAgentService({
  authorizeWrite = async () => {},
  readWorkspaceIdentity = async () => null,
  withWriteTransaction = async (_userId, _projectId, _identity, action) => action(async () => {}),
  withApplicationLock = async () => { throw new AgentError(503, 'Application recovery is unavailable') },
  store,
  canWrite,
  snapshot,
  snapshotAssets,
  daemon,
  readDocument,
  writeDocument,
  createDocument,
  validateProposal,
  deleteDocument,
  allowDeletion = () => false,
  resolveSkill,
  resolveRequest,
  prepareSessionTools,
  completeRequest,
  listContext,
}) {
  async function authorize(userId, projectId) {
    if (!(await canWrite(userId, projectId)))
      throw new AgentError(403, 'Project write access required')
  }
  async function ownedTask(userId, projectId, taskId) {
    await authorize(userId, projectId)
    const task = await store.find(taskId, userId, projectId)
    if (!task) throw new AgentError(404, 'Task not found')
    return task
  }
  function visible(task) {
    return {
      taskId: task.id,
      projectId: task.projectId,
      workspaceIdentity: task.workspaceIdentity || null,
      status: ['preparing', 'submitting'].includes(task.status)
        ? 'running'
        : task.status,
      instruction: task.instruction,
      plugin: task.plugin,
      plugins: task.plugins,
      scope: task.scope,
      sourceSelection: task.sourceSelection,
      referenceReview: task.referenceReview,
      claimReview: task.claimReview,
      summary: task.summary || '',
      activity: task.activity || [],
      output:
        task.output ||
        (task.status === 'preparing' ? 'Reading project documents…' : ''),
      proposals: task.proposals || [],
      createdAt: task.createdAt,
    }
  }
  async function handleMissingTask(error, taskId) {
    // Only an explicit daemon response proves loss. A timeout or connection
    // failure must leave the task recoverable when the daemon returns.
    if (error.code !== 'TASK_NOT_FOUND') throw error
    await store.finish(taskId, {
      status: 'failed',
      summary:
        'The local agent no longer has this task. It may have restarted. No changes were applied; run a new task.',
      proposals: [],
    })
  }
  return {
    inspect: createApplicationInspection({ canWrite, store, snapshot, readWorkspaceIdentity }),
    async closeUnconfirmed(userId, projectId, taskId, proposalId, input) {
      const inspect = createApplicationInspection({ canWrite, store, snapshot, readWorkspaceIdentity })
      return visible(await createApplicationDisposition({ canWrite, store, inspect, withApplicationLock })(userId, projectId, taskId, proposalId, input))
    },
    async recover(userId, projectId, taskId, proposalId) {
      return visible(await createApplicationRecovery({ canWrite, store, withApplicationLock })(userId, projectId, taskId, proposalId))
    },
    async fingerprints(userId, projectId) {
      await authorize(userId, projectId)
      return (await snapshot(projectId)).map(d=>({path:d.path,hash:createHash('sha256').update(d.content).digest('hex')}))
    },
    async context(userId, projectId) {
      await authorize(userId, projectId)
      return listContext ? await listContext(projectId) : (await snapshot(projectId)).map(d=>({kind:"file",path:d.path}))
    },
    async models(userId, projectId) {
      await authorize(userId, projectId)
      return await daemon('/agent/models', 'GET')
    },
    async resolveSelection(userId, projectId, selection) {
      await authorize(userId, projectId)
      return resolveSourceSelection(await snapshot(projectId), selection)
    },
    async retryRequest(userId,projectId,taskId){
      const task=await ownedTask(userId,projectId,taskId)
      return task.retryRequest
    },
    async create(userId, projectId, instruction, options = {}) {
      await authorize(userId, projectId)
      const scope = normalizeScope(options.scope)
      const resolved = resolveRequest ? await resolveRequest(userId,projectId,instruction) : null
      if(resolved?.summary){
        const task={id:options.taskId||randomUUID(),userId,projectId,instruction,status:'completed',summary:resolved.summary,documents:[],proposals:[],createdAt:new Date()}
        await store.create(task)
        return visible(task)
      }
      const skill = resolved || (resolveSkill ? await resolveSkill(userId, instruction, options.skills) : {instruction, assets:[]})
      let images
      try {
        images = validateImages(options.images)
      } catch (error) {
        throw new AgentError(400, error.message)
      }
      if (images.length) {
        const health = await daemon('/agent/health', 'GET')
        if (!health.capabilities?.images)
          throw new AgentError(
            422,
            'The configured agent does not support image input',
          )
      }
      const id = options.taskId || randomUUID()
      const workspaceIdentity = await readWorkspaceIdentity(projectId)
      if (Object.hasOwn(options, 'expectedWorkspaceIdentity'))
        assertWorkspaceIdentity(options.expectedWorkspaceIdentity, workspaceIdentity)
      const task = {
        id,
        workspaceIdentity,
        userId,
        projectId,
        instruction,
        plugin: skill.plugin,
        plugins: skill.plugins,
        scope,
        sourceSelection: options.sourceSelection,
        reportOnly: options.reportOnly === true,
        exportOnly: options.exportOnly === true,
        retryRequest: {model:options.model,effort:options.effort,scope:options.scope,skills:options.skills,sourceSelection:options.sourceSelection,images:options.images},
        recommendationCatalog: options.recommendationCatalog,
        trackReview: options.trackReview,
        issueContext: resolved?.issueContext,
        referenceReview: options.referenceReview,
        claimInput: options.claimInput,
        documents: [],
        status: 'preparing',
        proposals: [],
        createdAt: new Date(),
      }
      await store.create(task)
      try {
        if (scope.length && listContext) {
          const entries = await listContext(projectId)
          if (scope.some(s=>!entries.some(e=>e.kind===s.kind && e.path===s.path))) throw new AgentError(409,"A selected file or folder no longer exists. Update the scope.")
        }
        const sourceDocuments = await snapshot(projectId)
        const documents = options.prepareDocuments ? await options.prepareDocuments(sourceDocuments) : sourceDocuments
        const sourceSelection = resolveSourceSelection(documents, options.sourceSelection)
        if (skill.plugin && skill.instruction.length + (sourceSelection?.text.length || 0) > 30000) throw new AgentError(422, 'Skill, request and selected passage are too long. Shorten the request or selection.')
        const useHarness =
          snapshotAssets &&
          (await daemon('/agent/health', 'GET')).capabilities?.documentHarness
        const terminalTools=prepareSessionTools?await prepareSessionTools(userId,projectId,id,instruction):null
        if(terminalTools&&!useHarness)throw new AgentError(422,'Terminal tools require the Codex document runtime')
        const assets = useHarness && (!options.reportOnly || options.includeProjectAssets) ? await snapshotAssets(projectId) : []
        if (skill.assets.length && !useHarness) throw new AgentError(422, 'Skill execution requires the project tool runtime')
        let snapshotInstruction = ''
        if (options.captureSnapshot) {
          if (!useHarness) throw new AgentError(422, "Conversion requires the project tool runtime")
          const captured = await options.captureSnapshot(documents, assets)
          if (typeof captured?.instructionSuffix === 'string') snapshotInstruction = captured.instructionSuffix.slice(0,2000)
        }
        if (useHarness) assets.push(...skill.assets)
        if (options.extraAssets && !useHarness) throw new AgentError(422, 'ACM style preparation requires the document compiler')
        if (useHarness && options.extraAssets) assets.push(...options.extraAssets)
        if (!documents.length)
          throw new AgentError(
            422,
            'No editable text documents in this project',
          )
        if (options.isActive && !(await options.isActive()))
          throw new AgentError(409, 'Conversation turn is no longer active')
        await authorize(userId, projectId)
        assertWorkspaceIdentity(task.workspaceIdentity, await readWorkspaceIdentity(projectId))
        if (!(await store.prepare(id, documents)))
          throw new AgentError(409, 'Task preparation was cancelled or expired')
        await daemon('/agent/task', 'POST', {
          taskId: id,
          type: 'writing',
          instruction: (sourceSelection ? `${skill.instruction}\n\nSelected source (${sourceSelection.path}, lines ${sourceSelection.startLine}–${sourceSelection.endLine}):\n${sourceSelection.text}\nTreat this selected passage as the request scope. Preserve surrounding content unless needed for consistency.` : skill.instruction) + scopeInstruction(scope) + snapshotInstruction,
          ...(options.model ? { model: options.model } : {}),
          ...(options.effort ? { effort: options.effort } : {}),
          context: {
            ...(terminalTools?{terminalTools}:{}),
            maintenanceUserId: userId,
            projectId,
            userId,
            documents,
            ...(assets.length ? { assets } : {}),
            conversation: options.history,
            ...(images.length ? { images } : {}),
          },
        })
        if (!(await store.markRunning(id))) {
          // Cancellation/expiry may race with the HTTP submission. Stop late
          // accepted work, and never resurrect its local terminal record.
          await daemon(`/agent/task/${id}`, 'DELETE').catch(() => {})
          throw new AgentError(409, 'Task was cancelled during submission')
        }
      } catch (error) {
        await store.finish(id, {
          status: 'failed',
          summary: 'Task submission failed. Check the local agent connection.',
        })
        throw error
      }
      return visible(await store.find(id, userId, projectId))
    },
    async get(userId, projectId, taskId) {
      let task = await ownedTask(userId, projectId, taskId)
      if (['preparing', 'submitting'].includes(task.status)) {
        if (Date.now() - new Date(task.createdAt).getTime() > 120000) {
          await store.finish(taskId, {
            status: 'failed',
            summary:
              'Task submission was interrupted. No changes were applied; start a new task.',
          })
          task = await store.find(taskId, userId, projectId)
        }
        return visible(task)
      }
      if (!terminal.has(task.status)) {
        let result
        try {
          result = await daemon(`/agent/task/${taskId}`, 'GET')
        } catch (error) {
          await handleMissingTask(error, taskId)
          return visible(await store.find(taskId, userId, projectId))
        }
        if (terminal.has(result.status)) {
          let proposals = []
          let status = result.status
          let summary = String(result.summary || '').slice(0, 100000)
          if (status === 'completed') {
            try {
              proposals = task.reportOnly ? [] : buildProposals(result.diffs || [], task.documents, { allowDeletion: allowDeletion() })
              assertScopedProposals(proposals, task.scope)
            } catch {
              proposals = []
              status = 'failed'
              summary +=
                '\nThe proposed changes could not be validated. No documents were changed.'
            }
          }
          await store.finish(taskId, { status, summary, proposals, ...(task.claimInput && status === 'completed' ? { claimReview: buildClaimReview(task.claimInput, summary) } : {}), activity: boundedActivity(result.activity, 1000000) })
          task = await store.find(taskId, userId, projectId)
        } else {
          task.output = String(result.output || '').slice(-10000)
          task.activity = boundedActivity(result.activity, 1000000)
        }
      }
      if(task.status==='completed'&&task.issueContext&&completeRequest)await completeRequest(task)
      return visible(task)
    },
    async cancel(userId, projectId, taskId) {
      const task = await ownedTask(userId, projectId, taskId)
      if (['preparing', 'submitting'].includes(task.status)) {
        await store.finish(taskId, {
          status: 'cancelled',
          summary: 'Cancelled by user',
        })
        // create() will observe the terminal record and cancel a late daemon
        // acceptance. Before preparation, no backend work has started.
        return visible(await store.find(taskId, userId, projectId))
      }
      if (!terminal.has(task.status)) {
        try {
          await daemon(`/agent/task/${taskId}`, 'DELETE')
        } catch (error) {
          await handleMissingTask(error, taskId)
          return visible(await store.find(taskId, userId, projectId))
        }
        await store.finish(taskId, {
          status: 'cancelled',
          summary: 'Cancelled by user',
        })
      }
      return visible(await store.find(taskId, userId, projectId))
    },
    async decide(userId, projectId, taskId, proposalId, accept) {
      if (accept) await authorizeWrite(userId, projectId)
      const task = await ownedTask(userId, projectId, taskId)
      if (task.exportOnly) throw new AgentError(409, 'Conversion changes can only be exported to a new project; the original cannot be modified')
      if (task.status !== 'completed')
        throw new AgentError(409, 'Task has not completed')
      const proposal = task.proposals.find((item) => item.id === proposalId)
      if (!proposal) throw new AgentError(404, 'Proposal not found')
      if (accept) assertScopedProposals([proposal],task.scope)
      const deletion = proposal.mode === 'delete-document'
      if (deletion && accept && (!allowDeletion() || !deleteDocument)) {
        throw new AgentError(422, 'Reviewed document deletion is not enabled')
      }
      const recovering = deletion && accept && ['applying', 'uncertain'].includes(proposal.status)
      const claimed = recovering
        ? proposal.status === 'applying' || (store.claimDeletionRetry && await store.claimDeletionRetry(taskId, proposalId))
        : deletion && accept
          ? store.claimDeletion && await store.claimDeletion(taskId, proposalId)
          : await store.claim(taskId, proposalId, accept ? 'applying' : 'rejected')
      if (!claimed) throw new AgentError(409, 'Proposal has already been reviewed')
      if (accept) {
        let mutationStarted = false
        try {
          await withWriteTransaction(userId, projectId, task.workspaceIdentity, async assertLease => {
            const assertCurrent = async () => {
              await assertLease()
              await authorize(userId, projectId)
              await authorizeWrite(userId, projectId)
              assertWorkspaceIdentity(task.workspaceIdentity, await readWorkspaceIdentity(projectId))
              await assertLease()
            }
            await assertCurrent()
            if (validateProposal) await validateProposal(projectId, proposal)
            if (deletion) {
              await assertCurrent()
              mutationStarted = true
              await deleteDocument(userId, projectId, taskId, proposal)
            } else if (proposal.mode === 'create-document') {
              try {
                validateProjectPath(proposal.path)
              } catch {
                throw new AgentError(422, 'Unsupported new document path')
              }
              if (!createDocument)
                throw new AgentError(422, 'Document creation is unavailable')
              await assertCurrent()
              mutationStarted = true
              await createDocument(
                projectId,
                proposal.path,
                proposal.after.split('\n'),
                userId,
              )
            } else if (proposal.mode === 'create-bibliography') {
              if (
                !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}\.bib$/.test(proposal.path) ||
                !createDocument
              )
                throw new AgentError(422, 'Unsupported bibliography destination')
              await assertCurrent()
              mutationStarted = true
              await createDocument(
                projectId,
                proposal.path,
                proposal.after.split('\n'),
                userId,
              )
            } else {
              // Recheck membership: documents may have been deleted or moved.
              const current = await readDocument(projectId, proposal.docId)
              if (
                current.version !== proposal.version ||
                current.lines.join('\n') !== proposal.before
              ) {
                throw new AgentError(
                  409,
                  'Document changed since this suggestion. Run a new task.',
                )
              }
              await assertCurrent()
              mutationStarted = true
              await writeDocument(
                projectId,
                proposal.docId,
                userId,
                proposal.after.split('\n'),
                proposal.version,
              )
            }
            // Record only after the server mutation call has returned. This is
            // retained even if subsequent lease release or settlement fails.
            if (!deletion && store.recordApplicationAcknowledgement)
              await store.recordApplicationAcknowledgement(task, proposal)
          })
          await store.settle(taskId, proposalId, 'accepted')
        } catch (error) {
          if (!mutationStarted && !recovering &&
              (error.code === 'AI_WORKSPACE_CHANGED' || error.status === 403)) {
            await store.settle(taskId, proposalId, error.status === 409 ? 'conflict' : 'pending')
            throw error
          }
          if (deletion) {
            const conflict = error.code === 'DELETION_SNAPSHOT_CONFLICT'
            try {
              // Retention was established before execution. If settlement itself
              // fails, leave that evidence intact and return a stable API error.
              await store.settle(taskId, proposalId, conflict ? 'conflict' : 'uncertain')
            } catch (settlementError) {
              const unavailable = new AgentError(502,
                'Deletion status could not be confirmed. Check this proposal before continuing.',
                'DELETION_UNCERTAIN')
              unavailable.cause = settlementError
              throw unavailable
            }
            if (conflict) {
              throw new AgentError(409,
                'Document changed since this suggestion. Run a new task.',
                'DELETION_SNAPSHOT_CONFLICT')
            }
            throw new AgentError(502, 'Deletion is not confirmed. Retry this same proposal to recover.', 'DELETION_UNCERTAIN')
          }
          const conflict =
            error.status === 409 || error.response?.status === 409
          // Unknown network outcomes cannot safely be retried automatically.
          await store.settle(
            taskId,
            proposalId,
            conflict ? 'conflict' : 'uncertain',
          )
          if (conflict)
            throw new AgentError(
              409,
              'Document changed since this suggestion. Run a new task.',
            )
          throw new AgentError(
            502,
            'Could not confirm the write. Check the document before trying again.',
          )
        }
      }
      return visible(await store.find(taskId, userId, projectId))
    },
  }
}
