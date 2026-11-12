import Path from 'node:path'
import { AutoSyncSchedule } from './AutoSyncSchedule.mjs'
import { CollaborationTaskStore } from './CollaborationTaskStore.mjs'
import { discoverRemote } from './RemoteDiscovery.mjs'
import { MergeDraftService } from './MergeDraftService.mjs'
import { MergeApplicationService } from './MergeApplicationService.mjs'

export const pendingMerge = (tasks, workspaceId) => tasks.some(task => task.kind === 'merge' && task.workspaceId === workspaceId &&
  !['resolved', 'cancelled', 'superseded'].includes(task.state))
const refuse = message => Object.assign(Error(message), { status: 409 })
export function createAutoSync({ c, workspaceId, ownerId, authorize, author, withLock }) {
  const root = Path.join(c.root, 'auto-sync', workspaceId)
  const merges = new CollaborationTaskStore(Path.join(c.root, 'collaboration-tasks'))
  const blocked = async () => pendingMerge(await merges.list(), workspaceId)
  const target = (remote, branch) => c.withLock(async () => {
    await authorize()
    const binding = await c.store.read(), repo = await c.workspace.current(binding)
    if (binding.pending || !binding.branch) throw refuse('Workspace is not ready')
    await repo.git.raw(['check-ref-format', `refs/heads/${branch}`])
    return { workspaceBranch: binding.branch, fetchUrl: await repo.remoteUrl(remote), pushUrl: await repo.remoteUrl(remote, true) }
  })
  const verify = async (repo, policy) => {
    await authorize()
    const binding = await c.store.read()
    if (binding.pending || binding.mutationTaskId || binding.branch !== policy.workspaceBranch ||
        await repo.remoteUrl(policy.remote) !== policy.fetchUrl || await repo.remoteUrl(policy.remote, true) !== policy.pushUrl) throw refuse('Automatic sync target changed')
  }
  const drafts = async () => new MergeDraftService({ workspace: c.workspace, repository: c.repository, store: merges,
    logicalProjectId: c.logicalProjectId, workspaceId, actorId: ownerId, authorize, readEpoch: () => c.epoch.read(), author: await author() })
  return new AutoSyncSchedule({ ownerId, workspaceId, withLock, authorize,
    store: new CollaborationTaskStore(Path.join(root, 'schedule')), tasks: new CollaborationTaskStore(Path.join(root, 'tasks')),
    target, blocked,
    discover: (policy, run) => c.workspace.readHistory(async repo => {
      await verify(repo, policy)
      return discoverRemote({ repo, store: new CollaborationTaskStore(Path.join(c.root, 'remote-discovery', 'tasks')),
        credentials: c.credentials, remote: policy.remote, operationId: run.id, userId: ownerId, authorize })
    }),
    inspect: policy => c.workspace.run(async repo => {
      await verify(repo, policy)
      const status = await repo.status(), head = await repo.head()
      const remoteHead = (await repo.branches()).find(b => b.ref === `refs/remotes/${policy.remote}/${policy.branch}`)?.commit || null
      const ancestor = async (a, b) => (await repo.git.raw(['rev-list', '--count', a, `^${b}`])).trim() === '0'
      return { head, remoteHead, dirty: status.files.length > 0, manualIndex: status.files.some(file => file.index !== ' ' && file.index !== '?'),
        blocked: !!status.operation || await blocked(), remoteIsAncestor: !!remoteHead && await ancestor(remoteHead, head),
        localIsAncestor: !!remoteHead && await ancestor(head, remoteHead) }
    }),
    prepare: async (policy, run, remoteHead) => (await drafts()).prepare({ operationId: run.mergeId,
      ref: `refs/remotes/${policy.remote}/${policy.branch}`, expectedSourceOid: remoteHead }),
    apply: async (policy, run, task) => {
      const service = await drafts()
      const claimed = await service.claim(task.id, task.revision, run.sessionId)
      return new MergeApplicationService({ drafts: service, readEpoch: () => c.epoch.read(), advanceEpoch: expected => c.epoch.advance(expected), author: await author() })
        .apply(task.id, { revision: claimed.revision, sessionId: run.sessionId, generation: claimed.leaseGeneration, fastForwardOnly: true })
    },
    mergeTask: id => merges.read(id),
    remoteHead: policy => c.workspace.readHistory(async repo => {
      await verify(repo, policy)
      const credential = await c.credentials.read(policy.pushUrl)
      return repo.withRemoteCredentials(policy.pushUrl, credential, async client => {
        const ref = `refs/heads/${policy.branch}`
        const lines = await client.git.raw(['ls-remote', '--refs', policy.pushUrl, ref])
        await authorize()
        return lines.trim().split('\n').map(line => line.split(/\s+/)).find(parts => parts[1] === ref)?.[0] || null
      })
    }),
    push: (policy, run) => c.workspace.run(async repo => {
      await verify(repo, policy)
      const status = await repo.status()
      if (await blocked() || status.files.length || status.operation || await repo.head() !== run.candidate) throw refuse('Workspace changed before push')
      const credential = await c.credentials.read(policy.pushUrl)
      await authorize()
      // Explicit immutable OID refspec, no force, no remote push configuration.
      return repo.withRemoteCredentials(policy.pushUrl, credential, client => client.git.raw(['push', '--porcelain', policy.pushUrl, `${run.candidate}:refs/heads/${policy.branch}`]))
    }),
  })
}
