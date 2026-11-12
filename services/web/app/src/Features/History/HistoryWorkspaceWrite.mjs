import { assertStorageCapacity } from '../NativeGit/StorageCapacity.mjs'
import Path from 'node:path'
import { HistoryRestoreJournal, historyFingerprint } from './HistoryRestoreJournal.mjs'
import { createOverleafProject } from '../NativeGit/OverleafProject.mjs'
import { snapshotIdentity } from '../NativeGit/MergeDraftService.mjs'
import { writeRecoverySnapshot } from '../NativeGit/RecoverySnapshots.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import EditorController from '../Editor/EditorController.mjs'
import Settings from '@overleaf/settings'
import LockManager from '../../infrastructure/LockManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import { resolveWorkspaceScope } from '../NativeGit/WorkspaceScope.mjs'
import { workspaceEpochAdapter } from '../NativeGit/WorkspaceEpochRuntime.mjs'
import { withPreparedProjectWrite } from '../NativeGit/ProjectWriteAccess.mjs'
import { withProjectOperationLock } from '../NativeGit/ProjectOperationLock.mjs'
import { CollaborationTaskStore } from '../NativeGit/CollaborationTaskStore.mjs'
import { WorkspaceStore } from '../NativeGit/WorkspaceStore.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import HistoryManager from './HistoryManager.mjs'

const locks = LockManager.withTimeout(6 * 60)
// Reverts intentionally replace content. Serialize them with Git and ask every
// connected editor to flush before the exclusive write lease is taken.
export async function withHistoryWorkspaceWrite(projectId, userId, action, specification, recovery) {
  const scope = await resolveWorkspaceScope(projectId)
  if (!scope.fenceEnabled) {
    if (recovery) throw Object.assign(Error('History recovery requires a protected workspace'), { status: 409 })
    return action()
  }
  const root = Path.join(Settings.nativeGit?.storagePath || '/var/lib/overleaf/native-git', scope.logicalProjectId)
  return withProjectOperationLock(locks, 'nativeGitProject', scope.logicalProjectId, async () => {
    const authorize = async () => {
      if (!await AuthorizationManager.promises.canUserWriteProjectContent(userId, projectId)) throw Object.assign(Error('Project write access was revoked'), { status: 403 })
    }
    await authorize()
    const journal = new HistoryRestoreJournal(new CollaborationTaskStore(Path.join(root, 'history-restores', projectId)))
    if (!recovery && (await journal.pending()).length) throw Object.assign(Error('An interrupted history restore needs review. Open Source Control → History recovery.'), { status: 409 })
    const binding = await new WorkspaceStore(scope.internal ? Path.join(root, 'workspace-bindings', projectId) : Path.join(root, 'binding')).read()
    if (binding.pending || binding.mutationTaskId) throw Object.assign(Error('Finish the pending workspace recovery before restoring history'), { status: 409 })
    const tasks = await new CollaborationTaskStore(Path.join(root, 'collaboration-tasks')).list()
    if (tasks.some(t => t.workspaceId === projectId && !['resolved', 'cancelled', 'superseded'].includes(t.state))) throw Object.assign(Error('Finish the shared merge task before restoring history'), { status: 409 })
    let activeTask
    try {
    const result = await withPreparedProjectWrite(projectId, await workspaceEpochAdapter(projectId).read(), async (assertActive, preparation) => {
      await authorize(); await assertActive()
      // Keep the accepted pre-restore state in history before replacing anything.
      await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)
      await HistoryManager.promises.flushProject(projectId)
      await assertActive()
      const reader = historyReader(projectId, userId)
      const snapshot = await reader.read()
      const identity = await recoveryIdentity(projectId, snapshot)
      if (recovery?.decision !== 'keep') await assertStorageCapacity(root, [snapshot.files])
      let task
      if (recovery) {
        task = await journal.review(recovery.id, recovery.revision, recovery.fingerprint, identity)
        if (task.specification.workspaceId !== projectId) throw Object.assign(Error('Recovery workspace mismatch'), { status: 403 })
        activeTask = task.id
        if (recovery.decision === 'keep') {
          await assertActive(); await authorize()
          await preparation.advanceEpoch()
          await journal.save(task, { state: 'applied-awaiting-finalization', outcome: 'kept-current-files', final: identity })
          return []
        }
        task = await journal.save(task, { state: 'applying', attempts: [...task.attempts,
          { revision: task.revision, steps: task.steps, reviewed: identity, backupRevision: task.backupRevision, backupManifest: task.backupManifest }], steps: [] })
      } else if (specification) {
        task = await journal.start({ ...specification, workspaceId: projectId, userId }, identity)
        activeTask = task.id
      }
      if (!task) {
        try { return await action() } finally { await preparation.advanceEpoch() }
      }
      // Preserve current bytes for every explicit retry as well as the first run.
      const manifest = await writeRecoverySnapshot(Path.join(root, 'history-restores', projectId, task.id, String(task.revision)), snapshot.files)
      task = await journal.save(task, { backupManifest: manifest, backupRevision: task.revision })
      return journal.run(task, async step => {
        try {
          const result = await action(async (phase, path, kind) => {
            await authorize(); await assertActive()
            await step(phase, path, kind)
            await assertActive()
          }, task.specification)
          // A crash after deleting the root doc can lose its ID. Restore the
          // original root path when it still exists in the selected version.
          const rootPath = task.before.files.find(file => file.id === task.before.rootDocId)?.path
          if (rootPath) {
            await assertActive(); await authorize()
            const next = await reader.read(), root = next.entries.get(rootPath)
            if (root?.type === 'doc') await EditorController.promises.setRootDoc(projectId, root.id)
          }
          return result
        } finally {
          await preparation.advanceEpoch()
        }
      }, async () => historyFingerprint(await recoveryIdentity(projectId, await reader.read())))

    })
    if (activeTask) await journal.complete(activeTask)
    return result
    } catch (error) {
      if (activeTask) await journal.interrupt(activeTask)
      throw error
    }
  })
}

function historyReader(projectId, userId) {
  return createOverleafProject({ projectId, userId,
    entities: id => ProjectEntityHandler.promises.getAllEntities(id),
    documents: DocumentUpdaterHandler.promises,
    blobs: (id, hash, signal) => HistoryManager.promises.requestBlobWithProjectId(id, hash, 'GET', '', signal),
  })
}
async function recoveryIdentity(projectId, snapshot) {
  const settings = await ProjectGetter.promises.getProject(projectId, { rootDoc_id: true, compiler: true })
  return { ...snapshotIdentity(snapshot), workspaceEpoch: await workspaceEpochAdapter(projectId).read(), rootDocId: String(settings.rootDoc_id || ''), compiler: settings.compiler }
}
export async function historyRecoveryPreview(projectId, userId) {
  const scope = await resolveWorkspaceScope(projectId)
  const root = Path.join(Settings.nativeGit?.storagePath || '/var/lib/overleaf/native-git', scope.logicalProjectId)
  return withProjectOperationLock(locks, 'nativeGitProject', scope.logicalProjectId, async () => {
    if (!await AuthorizationManager.promises.canUserWriteProjectContent(userId, projectId)) throw Object.assign(Error('Project write access was revoked'), { status: 403 })
    const journal = new HistoryRestoreJournal(new CollaborationTaskStore(Path.join(root, 'history-restores', projectId)))
    const pending = await journal.pending()
    if (!pending.length) return { tasks: [] }
    const identity = await recoveryIdentity(projectId, await historyReader(projectId, userId).read())
    return { tasks: pending.map(t => ({ id: t.id, revision: t.revision, state: t.state,
      version: t.specification.version, pathname: t.specification.pathname,
      steps: t.steps.map(({ phase, path, kind }) => ({ phase, path, kind })),
      currentFiles: identity.files.map(f => ({ path: f.path, hash: f.hash })),
      fingerprint: historyFingerprint(identity) })) }
  })
}
