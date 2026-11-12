import Path from 'node:path'
import { mkdtemp, readFile, open, rename, rm, mkdir, link } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { simpleGit } from 'simple-git'
import { validateFiles, writeWorktree } from './WorktreeFiles.mjs'

const conflict = message => Object.assign(Error(message), { status: 409 })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function indexPath(repo) {
  return Path.resolve(repo.directory, (await repo.git.raw(['rev-parse', '--git-path', 'index'])).trim())
}
async function indexBytes(repo) {
  try { return await readFile(await indexPath(repo)) }
  catch (error) { if (error.code !== 'ENOENT') throw error; return Buffer.alloc(0) }
}
export async function inspectAutoCommitGit(repo) {
  const branch = (await repo.git.raw(['symbolic-ref', '--quiet', 'HEAD'])).trim()
  const head = await repo.head()
  const tree = (await repo.git.raw(['rev-parse', 'HEAD^{tree}'])).trim()
  const index = await indexBytes(repo)
  // Compare index semantics, including staged deletions, renames and conflicts.
  // Reading the index must not refresh it: fingerprints bind actual bytes.
  const staged = await repo.git.raw(['diff', '--cached', '--name-only', '--no-ext-diff', '--no-textconv', '-z', head, '--'])
  return { branch, head, tree, indexFingerprint: hash(index), manualIndex: staged.length > 0,
    operation: await repo.operation() }
}
function matches(actual, expected) {
  return ['branch', 'head', 'indexFingerprint'].every(key => actual[key] === expected[key])
}

// Caller MUST hold the repository operation lock and the prepared collaborative
// write barrier for the whole call. guard rechecks lease, authorization, epoch
// and saved document versions. This never copies files over live documents or
// the working tree. journal must durably record each checkpoint before returning.
export async function executeAutoCommitGit({ repo, expected, files, operationId, guard, journal,
  message = 'Automatic saved-document checkpoint' }) {
  if (!/^[a-f0-9-]{36}$/.test(operationId) || typeof guard !== 'function' || typeof journal !== 'function') throw Error('Invalid automatic commit context')
  if (typeof message !== 'string' || !message.trim() || message.includes('\0')) throw Error('Invalid commit message')
  validateFiles(files)
  // Copy bytes before asynchronous work; caller mutation cannot change a candidate.
  const frozen = new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]))
  const path = await indexPath(repo)
  const ownerPath = `${path}.auto-${operationId}`
  let lock
  try { lock = await open(ownerPath, 'wx', 0o600) }
  catch (error) { if (error.code === 'EEXIST') throw conflict('Automatic commit has retained lock ownership; reconcile before retry'); throw error }
  let temporary, published = false, keepLock = false, ownsLockPath = false
  try {
    await lock.sync()
    const initialFolder = await open(Path.dirname(path), 'r')
    try { await initialFolder.sync() } finally { await initialFolder.close() }
    const initialStat = await lock.stat()
    const starting = { directory: repo.directory, operationId, branch: expected.branch, head: expected.head,
      indexFingerprint: expected.indexFingerprint,
      lockIdentity: { dev: String(initialStat.dev), ino: String(initialStat.ino) }, state: 'starting' }
    // Publish durable ownership BEFORE a shared Git lock can exist.
    await journal(starting)
    try { await link(ownerPath, `${path}.lock`); ownsLockPath = true }
    catch (error) { if (error.code === 'EEXIST') throw conflict('Git index is in use'); throw error }
    const acquiredFolder = await open(Path.dirname(path), 'r')
    try { await acquiredFolder.sync() } finally { await acquiredFolder.close() }
    await guard()
    const before = await inspectAutoCommitGit(repo)
    if (!matches(before, expected) || before.manualIndex || before.operation) throw conflict('Branch or index changed, or manual work is pending')
    temporary = await mkdtemp(Path.join(tmpdir(), 'overleaf-auto-commit-'))
    const work = Path.join(temporary, 'work')
    // The private construction index is temporary plumbing, never a user index.
    await mkdir(work)
    await writeWorktree(work, frozen)
    const candidateIndex = Path.join(temporary, 'index')
    const gitDir = (await repo.git.raw(['rev-parse', '--absolute-git-dir'])).trim()
    const git = simpleGit({ ...repo.gitOptions, baseDir: work,
      allowEnvironment: [...repo.gitOptions.allowEnvironment, 'GIT_INDEX_FILE', 'GIT_WORK_TREE', 'GIT_DIR', 'GIT_OPTIONAL_LOCKS',
        'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL'] }).env({ ...repo.environment, GIT_DIR: gitDir,
      GIT_INDEX_FILE: candidateIndex, GIT_WORK_TREE: work, GIT_OPTIONAL_LOCKS: '0',
      GIT_AUTHOR_NAME: 'Overleaf Auto Commit', GIT_AUTHOR_EMAIL: 'auto-commit@overleaf.invalid',
      GIT_COMMITTER_NAME: 'Overleaf Auto Commit', GIT_COMMITTER_EMAIL: 'auto-commit@overleaf.invalid' })
    await git.raw(['read-tree', before.head])
    await git.raw(['add', '--all', '--', '.'])
    const tree = (await git.raw(['write-tree'])).trim()
    if (tree === before.tree) {
      await journal({ ...starting, state: 'cancelled' })
      return { operationId, commit: before.head, unchanged: true }
    }
    const commit = (await git.raw(['commit-tree', tree, '-p', before.head, '-m', message,
      '-m', `Overleaf-Auto-Operation: ${operationId}`])).trim()
    const nextIndex = await readFile(candidateIndex)
    await lock.writeFile(nextIndex)
    await lock.sync()
    // Persist enough information to reconcile ref publication / index installation
    // independently after a crash. The retained index.lock is owned by this task.
    const lockStat = await lock.stat()
    const checkpoint = { directory: repo.directory, lockIdentity: { dev: String(lockStat.dev), ino: String(lockStat.ino) }, operationId, branch: before.branch, head: before.head, commit, tree,
      indexFingerprint: before.indexFingerprint, nextIndexFingerprint: hash(nextIndex) }
    await journal({ ...checkpoint, state: 'prepared' })
    await guard()
    const current = await inspectAutoCommitGit(repo)
    if (!matches(current, before) || current.manualIndex || current.operation) throw conflict('Git state changed while preparing automatic commit')
    // From here an I/O error may be an acknowledged-or-not ref update. Retain
    // the lock and journal for explicit reconciliation; never blindly retry.
    keepLock = true
    await repo.git.raw(['update-ref', '-m', `overleaf-auto:${operationId}`, before.branch, commit, before.head])
    published = true
    await journal({ ...checkpoint, state: 'published' })
    await lock.close(); lock = null
    await rename(`${path}.lock`, path)
    keepLock = false
    ownsLockPath = false
    const folder = await open(Path.dirname(path), 'r')
    try { await folder.sync() } finally { await folder.close() }
    await journal({ ...checkpoint, state: 'complete' })
    return { operationId, commit }
  } catch (error) {
    if (keepLock || published) error.autoCommitOutcomeUnknown = true
    throw error
  } finally {
    if (lock) await lock.close()
    if (!keepLock && ownsLockPath) await rm(`${path}.lock`, { force: true })
    if (!keepLock) await rm(ownerPath, { force: true })
    if (temporary) await rm(temporary, { recursive: true, force: true })
  }
}
