import Path from 'node:path'
import { constants } from 'node:fs'
import { open, rename, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { inspectAutoCommitGit } from './AutoCommitGit.mjs'
import { taskId } from './CollaborationTaskStore.mjs'
const refuse = message => Object.assign(Error(message), { status: 409 })
const digest = value => createHash('sha256').update(value).digest('hex')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Caller owns the workspace repository lock. Each instance is scoped by trusted
// server context, never by browser-supplied workspace or actor metadata.
export function autoCommitJournal({ store, workspaceId, ownerId }) {
  async function read(id) {
    const record = await store.read(taskId(id))
    if (record.kind !== 'automatic-commit' || record.workspaceId !== workspaceId || record.ownerId !== ownerId) throw refuse('Automatic commit belongs to another scope')
    return record
  }
  return { read, async write(checkpoint) {
    const id = taskId(checkpoint.operationId)
    let prior
    try { prior = await read(id) } catch (error) { if (error.code !== 'ENOENT') throw error }
    const identity = value => [value.directory, value.branch, value.head, value.commit, value.tree, value.indexFingerprint, value.nextIndexFingerprint, value.lockIdentity]
    const baseIdentity = value => [value.directory, value.branch, value.head, value.indexFingerprint, ...(prior?.state === 'requested' ? [] : [value.lockIdentity])]
    if (prior && (!same(baseIdentity(prior), baseIdentity(checkpoint)) || (!['requested', 'starting'].includes(prior.state) && !same(identity(prior), identity(checkpoint))))) throw refuse('Automatic commit identity changed')
    const transitions = { requested: ['starting', 'cancelled'], starting: ['prepared', 'cancelled'], prepared: ['prepared', 'published', 'complete', 'cancelled'], published: ['published', 'complete'], complete: ['complete'], cancelled: ['cancelled'] }
    if ((!prior && !['requested', 'starting'].includes(checkpoint.state)) || (prior && !transitions[prior.state]?.includes(checkpoint.state))) throw refuse('Invalid automatic commit transition')
    const record = { ...checkpoint, id, kind: 'automatic-commit', workspaceId, ownerId, revision: (prior?.revision || 0) + 1 }
    await store.write(record)
    return record
  } }
}
async function lockInfo(path) {
  let handle
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > 64 * 1024 * 1024) throw refuse('Unexpected Git index lock')
    return { dev: String(stat.dev), ino: String(stat.ino), fingerprint: digest(await handle.readFile()) }
  } finally { await handle.close() }
}
export async function inspectAutoCommitRecovery(repo, record) {
  const indexPath = Path.resolve(repo.directory, (await repo.git.raw(['rev-parse', '--git-path', 'index'])).trim())
  const current = await inspectAutoCommitGit(repo), lock = await lockInfo(`${indexPath}.lock`)
  const ownerPath = `${indexPath}.auto-${taskId(record.operationId)}`
  const owner = await lockInfo(ownerPath)
  const owned = lock && owner && lock.dev === owner.dev && lock.ino === owner.ino &&
    lock.dev === record.lockIdentity?.dev && lock.ino === record.lockIdentity?.ino &&
    (record.state === 'starting' || lock.fingerprint === record.nextIndexFingerprint)
  let action = null
  if (repo.directory === record.directory && current.branch === record.branch && !current.operation) {
    if (current.head === record.commit && current.indexFingerprint === record.nextIndexFingerprint && !lock) action = 'complete'
    else if (current.head === record.commit && current.indexFingerprint === record.indexFingerprint && owned) action = 'install-index'
    else if (current.head === record.head && current.indexFingerprint === record.indexFingerprint && (!lock || owned) && record.state !== 'published' && record.state !== 'complete') action = 'cancel'
  }
  if (record.state === 'cancelled' && action !== 'cancel') action = null
  if (record.state === 'complete' && action !== 'complete') action = null
  // Fingerprint binds the durable task revision as well as live state. A stale
  // preview cannot authorize work after another recovery or manual Git action.
  const fingerprint = digest(JSON.stringify({ record, current, lock, owner }))
  return { fingerprint, action, indexPath, ownerPath, current, lock, owner }
}

// Must run under the shared repository lock, after the prior executor is no
// longer active. guard must check lease and authorization before each mutation.
export async function recoverAutoCommitGit({ repo, record, fingerprint, guard, journal }) {
  await guard()
  const preview = await inspectAutoCommitRecovery(repo, record)
  if (preview.fingerprint !== fingerprint || !preview.action) throw refuse('Recovery preview changed or Git state requires manual reconciliation')
  if (record.state === 'cancelled' && preview.action === 'cancel' && !preview.owner) return record
  if (record.state === 'complete' && preview.action === 'complete' && !preview.owner) return record
  await guard()
  // Guard itself may await remote authorization; revalidate after that wait.
  const current = await inspectAutoCommitRecovery(repo, record)
  if (current.fingerprint !== fingerprint) throw refuse('Git state changed during recovery')
  if (preview.action === 'install-index') await rename(`${preview.indexPath}.lock`, preview.indexPath)
  if (preview.action === 'cancel' && preview.lock) await unlink(`${preview.indexPath}.lock`)
  if (preview.owner && preview.owner.dev === record.lockIdentity?.dev && preview.owner.ino === record.lockIdentity?.ino) await unlink(preview.ownerPath)
  const folder = await open(Path.dirname(preview.indexPath), constants.O_RDONLY)
  try { await folder.sync() } finally { await folder.close() }
  // Never move HEAD during recovery: finish a proven publication or cancel an
  // unpublished candidate. Unknown/newer heads and foreign staging stay intact.
  return journal({ ...record, state: preview.action === 'cancel' ? 'cancelled' : 'complete' })
}
