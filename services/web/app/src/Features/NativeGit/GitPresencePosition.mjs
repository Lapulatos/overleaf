import { readWorktree, fileChanges } from './WorktreeFiles.mjs'

// Caller holds repository lock and has revalidated named project membership.
// This read never exports documents, stages changes or checks out a revision.
export async function readGitPresencePosition({ workspace, epoch, logicalProjectId,
  workspaceId, userId, displayName, viewedCommit = null }) {
  if (viewedCommit !== null && (typeof viewedCommit !== 'string' || !/^[a-f0-9]{40,64}$/.test(viewedCommit))) {
    throw Object.assign(new Error('Invalid history viewing position'), { status: 400 })
  }
  const binding = await workspace.store.read()
  if (binding.pending || binding.mutationTaskId) throw Object.assign(new Error('Workspace contents are being recovered'), { status: 409 })
  const currentEpoch = await epoch.read()
  const repository = await workspace.current(binding)
  const status = await repository.status()
  if (!status.detached && status.branch !== binding.branch) throw Object.assign(new Error('Workspace branch changed'), { status: 409 })
  const branches = await repository.branches()
  const head = status.detached ? await repository.head() : branches.find(branch => branch.ref === `refs/heads/${status.branch}`)?.commit || null
  const viewed = viewedCommit === null ? null : await repository.resolve(viewedCommit)
  const live = await workspace.project.read()
  const disk = await readWorktree(repository.directory)
  if (await epoch.read() !== currentEpoch) throw Object.assign(new Error('Workspace version changed'), { status: 409 })
  return { logicalProjectId, workspaceId, userId, displayName,
    epoch: currentEpoch, branch: status.branch || '', head,
    dirty: status.files.length > 0 || fileChanges(disk, live.files).length > 0,
    viewedCommit: viewed }
}
