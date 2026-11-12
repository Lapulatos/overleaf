import { createHash } from 'node:crypto'
import { taskId } from './CollaborationTaskStore.mjs'

// Caller holds the shared repository lock. Discovery reads no editor files and
// never checks out, merges, stages, or changes local branch refs.
export async function discoverRemote({ repo, store, credentials, remote, operationId, userId, authorize }) {
  const id = taskId(operationId)
  if (typeof userId !== 'string' || !/^[a-f0-9]{24}$/.test(userId)) {
    throw Object.assign(new Error('Invalid discovery owner'), { status: 400 })
  }
  await authorize()
  const url = await repo.remoteUrl(remote)
  const prefix = `refs/remotes/${remote}/`
  const refs = async () => Object.fromEntries((await repo.branches())
    .filter(branch => branch.ref.startsWith(prefix)).map(branch => [branch.ref, branch.commit]))
  let task
  try { task = await store.read(id) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (task && task.ownerId !== userId) {
    throw Object.assign(new Error('Discovery task belongs to another account'), { status: 403 })
  }
  if (task && (task.kind !== 'remote-discovery' || task.remote !== remote || task.url !== url)) {
    throw Object.assign(new Error('Remote discovery request no longer matches its original target'), { status: 409 })
  }
  if (task?.state === 'fetched') return task
  if (!task) {
    task = { id, revision: 1, kind: 'remote-discovery', ownerId: userId, remote, url, state: 'fetching',
      before: await refs(), createdAt: new Date().toISOString() }
    await store.write(task)
  }
  // Retain old remote tips before pruning/rewrites so an upstream force push or
  // deleted branch cannot make the previous project-visible objects unreachable.
  for (const [ref, oid] of Object.entries(task.before)) {
    if (!ref.startsWith(prefix) || !/^[a-f0-9]{40,64}$/.test(oid)) throw Error('Invalid saved remote snapshot')
    const key = createHash('sha256').update(ref).digest('hex')
    await repo.git.raw(['update-ref', `refs/overleaf/remote-snapshots/${id}/${key}`, oid])
  }
  await authorize()
  if (await repo.remoteUrl(remote) !== url) throw Object.assign(new Error('Remote URL changed'), { status: 409 })
  const credential = await credentials.read(url)
  // An explicit refmap forbids repository fetch configuration from redirecting
  // discovery into refs/heads. Tags and submodules are separate import policies.
  await repo.withRemoteCredentials(url, credential, client => client.git.raw([
    'fetch', '--prune', '--no-tags', '--no-write-fetch-head', '--no-recurse-submodules', '--refmap=',
    remote, `+refs/heads/*:${prefix}*`,
  ]))
  await authorize()
  const after = await refs()
  const changes = []
  for (const ref of new Set([...Object.keys(task.before), ...Object.keys(after)])) {
    const before = task.before[ref] || null, next = after[ref] || null
    if (before === next) continue
    let change = !before ? 'created' : !next ? 'deleted' : 'rewritten'
    if (before && next) {
      const excluded = (await repo.git.raw(['rev-list', '--count', before, `^${next}`])).trim()
      if (excluded === '0') change = 'advanced'
    }
    changes.push({ ref, before, after: next, change })
  }
  task = { ...task, revision: task.revision + 1, state: 'fetched', after, changes,
    fetchedAt: new Date().toISOString(), applied: false }
  await store.write(task)
  return task
}
