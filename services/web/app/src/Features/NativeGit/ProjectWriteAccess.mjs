import { withProjectOperationLock } from './ProjectOperationLock.mjs'
import Settings from '@overleaf/settings'
import { fetchJson } from '@overleaf/fetch-utils'
import ProjectWriteGate from '@overleaf/redis-wrapper/ProjectWriteGate.js'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import LockManager from '../../infrastructure/LockManager.mjs'

const gate = ProjectWriteGate.createProjectWriteGate(RedisWrapper.client('documentupdater'))
const locks = LockManager.withTimeout(6 * 60)

export async function checkProjectWriteIntegration() {
  const capabilities = await Promise.all([Settings.apis.documentupdater.url, Settings.apis.realTime.url].map(base =>
    fetchJson(`${base.replace(/\/$/, '')}/native-git/capabilities`, { signal: AbortSignal.timeout(5000) })))
  if (!gate.supported() || capabilities.some(value => value.projectWriteGate !== true)) {
    throw Object.assign(new Error('Document updater and real-time Git adapters must be enabled together'), { status: 503 })
  }
}

export async function withExclusiveProjectWrite(projectId, action) {
  await checkProjectWriteIntegration()
  return withProjectOperationLock(locks, 'sequentialProjectStructureUpdateLock', projectId, async () => {
    const { default: events } = await import('../Editor/EditorRealTimeController.mjs')
    let announced = false
    try {
      return await gate.withExclusive(projectId, async () => {
        announced = true
        events.emitToRoom(projectId, 'nativeGitWriteState', { busy: true, ttlMs: 300000 })
        return action()
      })
    } finally {
      if (announced) events.emitToRoom(projectId, 'nativeGitWriteState', { busy: false })
    }
  })
}

export const projectWriteIntegrationEnabled = ProjectWriteGate.enabled
