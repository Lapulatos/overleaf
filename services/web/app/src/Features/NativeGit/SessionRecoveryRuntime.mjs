import { CollaborationTaskStore } from './CollaborationTaskStore.mjs'
import { pendingMergeForSessionRecovery, linkSessionRecoveryToMerge, acceptsMergeRecoveryEpoch } from './MergeSessionRecovery.mjs'
import Path from 'node:path'
import ProjectWriteGate from '@overleaf/redis-wrapper/ProjectWriteGate.js'
import WorkspacePrepareGate from '@overleaf/redis-wrapper/WorkspacePrepareGate.js'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import { requireRepositoryWrite } from './AccessPolicy.mjs'
import { createSessionRecoveryService } from './SessionRecoveryService.mjs'

const publicTask = ({ id, state, phase, epoch, nextEpoch, revision }) => ({ id, state, phase, epoch, nextEpoch, revision })
export async function runSessionRecoveryCommand({ c, projectId, userId, ownerId, command, policy, withExclusiveWrite }) {
  if (userId !== ownerId) throw Object.assign(new Error('Only the project owner can recover workspace sessions'), { status: 403 })
  if (!c.collaboration.apply || !c.epoch || !withExclusiveWrite) throw Object.assign(new Error('Session recovery requires enabled workspace fencing and preparation'), { status: 409 })
  if (command.command === 'sessionRecoveryList') {
    return { result: await c.recoveryLock(async () => (await c.recoveryTasks.list()).map(publicTask)) }
  }
  requireRepositoryWrite(policy)
  const gate = WorkspacePrepareGate.createWorkspacePrepareGate(RedisWrapper.client('documentupdater'))
  const mergeStore = new CollaborationTaskStore(Path.join(c.root, 'collaboration-tasks'))
  let pendingMerge
  const recover = createSessionRecoveryService({ projectId, store: c.recoveryTasks,
    snapshotsDirectory: Path.join(c.root, 'session-recovery', projectId, 'snapshots'),
    withLock: fn => c.recoveryLock(async () => {
      const binding = await c.store.read()
      pendingMerge = await pendingMergeForSessionRecovery(mergeStore, binding, projectId, c.logicalProjectId)
      if (pendingMerge) {
        const currentEpoch = await c.epoch.read()
        // An interrupted session recovery may already have advanced once but
        // not yet linked that transition into the merge journal.
        const pending = (await c.recoveryTasks.list()).find(task => task.id === command.operationId && task.state !== 'resolved')
        const expected = pending?.epoch ?? currentEpoch
        if (!acceptsMergeRecoveryEpoch(pendingMerge, expected) ||
            (pending && ![pending.epoch, pending.nextEpoch].includes(currentEpoch))) {
          throw Object.assign(new Error('Pending merge generation changed'), { status: 409 })
        }
      }
      return fn()
    }),
    withExclusiveWrite: fn => withExclusiveWrite(projectId, async assertActive => {
      const writeToken = ProjectWriteGate.current(projectId)?.token
      if (!writeToken) throw Object.assign(new Error('Exclusive project write token is unavailable'), { status: 503 })
      return fn({ assertActive, writeToken })
    }),
    readSnapshot: () => c.project.read(), epoch: c.epoch,
    beforeResolve: task => linkSessionRecoveryToMerge(mergeStore, pendingMerge, task),
    recoverMembership: request => gate.recoverMembership(projectId, request),
    notify: epoch => EditorRealTimeController.emitToRoom(projectId, 'nativeGitWorkspaceEpochChanged', { projectId, epoch }),
  })
  return { result: publicTask(await recover(command.operationId)) }
}
