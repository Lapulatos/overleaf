import { withProjectOperationLock } from './ProjectOperationLock.mjs'
import { createWorkspacePreparation } from './WorkspacePreparation.mjs'
import WorkspacePrepareGate from '@overleaf/redis-wrapper/WorkspacePrepareGate.js'
import Settings from '@overleaf/settings'
import { fetchJson } from '@overleaf/fetch-utils'
import ProjectWriteGate from '@overleaf/redis-wrapper/ProjectWriteGate.js'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import LockManager from '../../infrastructure/LockManager.mjs'

const gate = ProjectWriteGate.createProjectWriteGate(RedisWrapper.client('documentupdater'))
const locks = LockManager.withTimeout(6 * 60)

export async function checkProjectWriteIntegration() {
  const capabilities = await Promise.all([Settings.apis.documentupdater.url, Settings.apis.realTime.url].map(base =>
    fetchJson(`${base.replace(/\/$/, '')}/native-git/capabilities`, { signal: AbortSignal.timeout(5000) }))).catch(cause => {
    throw Object.assign(new Error('Collaboration services are restarting or unavailable; retry after they are ready', { cause }), { status: 503 })
  })
  if (!gate.supported() || capabilities.some(value => value.projectWriteGate !== true)) {
    throw Object.assign(new Error('Document updater and real-time Git adapters must be enabled together'), { status: 503 })
  }
}

export async function withExclusiveProjectWrite(projectId, action, { deletionId } = {}) {
  await checkProjectWriteIntegration()
  return withProjectOperationLock(locks, 'sequentialProjectStructureUpdateLock', projectId, async () => {
    const { Project } = await import('../../models/Project.mjs')
    const record = await Project.findById(projectId).select('gitProjectDeletion').lean().exec()
    if (record?.gitProjectDeletion && record.gitProjectDeletion !== deletionId) throw Object.assign(Error('Project deletion is in progress'), { status: 409 })
    const { default: events } = await import('../Editor/EditorRealTimeController.mjs')
    let announced = false
    try {
      return await gate.withExclusive(projectId, async () => {
        announced = true
        await events.emitToRoom(projectId, 'nativeGitWriteState', { busy: true, ttlMs: 300000 })
        return action(() => gate.assertWrite(projectId))
      })
    } finally {
      if (announced) await events.emitToRoom(projectId, 'nativeGitWriteState', { busy: false })
    }
  })
}

export const projectWriteIntegrationEnabled = ProjectWriteGate.enabled

// Explicit opt-in entry point for operations that transfer collaborative state.
// Never silently fall back to an unprepared transaction when membership is lost.
export async function withPreparedProjectWrite(projectId, expectedEpoch, action, options) {
  const { Project } = await import('../../models/Project.mjs')
  const project = await Project.findById(projectId)
    .select('gitWorkspaceFenceEnabled gitWorkspacePrepareEnabled gitWorkspaceEpoch').lean().exec()
  if (!project?.gitWorkspaceFenceEnabled || !project.gitWorkspacePrepareEnabled || project.gitWorkspaceEpoch !== expectedEpoch) {
    throw Object.assign(new Error('Workspace preparation is unavailable or the workspace changed'), { status: 409 })
  }
  const { default: events } = await import('../Editor/EditorRealTimeController.mjs')
  const preparedWrite = createWorkspacePreparation({
    gate: WorkspacePrepareGate.createWorkspacePrepareGate(RedisWrapper.client('documentupdater')),
    emit: (project, event, payload) => events.emitToRoom(project, event, payload),
    withExclusiveWrite: withExclusiveProjectWrite,
    advanceEpoch: async (project, epoch) => {
      const { workspaceEpochAdapter } = await import('./WorkspaceEpochRuntime.mjs')
      return workspaceEpochAdapter(project).advance(epoch)
    },
  })
  return preparedWrite(projectId, expectedEpoch, action, options)
}
