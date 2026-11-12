import { Project } from '../../models/Project.mjs'
import events from '../Editor/EditorRealTimeController.mjs'
import { resolveWorkspaceScope } from './WorkspaceScope.mjs'

const changesRepository = new Set([
  'workspaceLifecycle',
  'autoSync', 'configureAutoSyncSchedule', 'reconcileAutoSync',
  'autoCommit', 'autoCommitRecover', 'configureAutoCommitSchedule',
  'shellDraftApply', 'shellDraftRecover',
  'discoverRemote','mergeDraftApply','mergeDraftRecover','mergeDraftPrepare','mergeDraftClaim','mergeDraftResolve','mergeDraftValidate','mergeDraftCancel',
  'initialize','connect','checkout','checkoutDetached','commit','stage','unstage','applyHunks',
  'createBranch','trackBranch','renameBranch','deleteBranch','merge','rebase','cherryPick','revert',
  'undoCommit','reset','continueOperation','resolveConflict','discard','discardAll','stash','applyStash',
  'dropStash','dropAllStashes','createWorktree','cleanWorktree','createTag','deleteTag','fetch','pull','push',
  'sync','addRemote','removeRemote','changeRemote','deleteRemoteRef','pushTags','resumeTransfer','cancelTransfer',
])

export async function publishRepositoryChange(projectId, command) {
  if (!changesRepository.has(command.command)) return
  const scope = await resolveWorkspaceScope(projectId)
  const children = await Project.find({ 'gitWorkspace.logicalProjectId': scope.logicalProjectId,
    'gitWorkspace.state': 'ready' }, { _id: 1 }).lean().exec()
  const rooms = [scope.logicalProjectId, ...children.map(x => String(x._id))]
  // This is an invalidation only, never other branches' document contents or
  // identities. Clients fetch a fresh authorized snapshot, even after failure.
  await Promise.all(rooms.map(room => events.emitToRoom(room, 'nativeGitRepositoryChanged', {
    logicalProjectId: scope.logicalProjectId,
  })))
}
