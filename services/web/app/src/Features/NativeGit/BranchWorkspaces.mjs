import { readWorktree } from './WorktreeFiles.mjs'
import { mkdir } from 'node:fs/promises'
import Path from 'node:path'
import { randomBytes } from 'node:crypto'

// The caller's repository lock serializes allocation; database uniqueness is a
// second line of defence. Only completed workspaces are visible to editor users.
export async function enterBranchWorkspace(source, branch, { find, create, ready, context }) {
  return source.withLock(async () => {
    const original = await source.defaultStore.read()
    if (original.pending) throw Object.assign(new Error('Finish the default workspace transfer first'), { status: 409 })
    if (original.branch === branch) return navigation(source.logicalProjectId, source.logicalProjectId, branch)
    const targetRepository = await source.repository.branchWorktree(branch)
    let storage = await find(source.logicalProjectId, branch)
    if (storage?.gitWorkspace.state === 'archived') {
      throw Object.assign(new Error('Restore the archived workspace before entering it'), { status: 409 })
    }
    if (!storage) {
      // Reject ambiguous imports before allocating a collaborative project.
      await readWorktree(targetRepository.directory)
      const status = await targetRepository.status()
      if (status.files.length) throw Object.assign(new Error('The branch worktree has uncommitted files; preserve them before creating its collaborative workspace'), { status: 409 })
      const id = randomBytes(12).toString('hex')
      storage = await create(source.logicalProjectId, id, branch, { commit: await targetRepository.head() })
    }
    const id = String(storage._id)
    if (storage.gitWorkspace.state !== 'ready') {
      const target = await context(id)
      let binding
      try { binding = await target.store.read() } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (!binding) {
        const snapshot = await target.project.read()
        if (snapshot.files.size) throw Object.assign(new Error('Incomplete workspace contains data; recovery required'), { status: 409 })
        const beforeDirectory = Path.join(target.transferRoot, 'initial')
        await mkdir(beforeDirectory, { recursive: true, mode: 0o700 })
        await target.store.write({ directory: targetRepository.directory, branch,
          pending: { directory: targetRepository.directory, branch, beforeDirectory } })
        binding = await target.store.read()
      }
      // Already under the shared repository lock; do not acquire it twice.
      if (binding.pending) await target.workspace.finishTransfer(binding)
      await ready(id)
    }
    return navigation(source.logicalProjectId, id, branch)
  })
}

function navigation(logicalProjectId, workspaceId, branch) {
  return { logicalProjectId, workspaceId, branch,
    url: workspaceId === logicalProjectId ? `/project/${logicalProjectId}` : `/project/${logicalProjectId}/workspace/${workspaceId}` }
}
