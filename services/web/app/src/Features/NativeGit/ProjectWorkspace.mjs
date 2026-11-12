import { remoteWebLinks } from './RemoteWebLinks.mjs'
import { readWorktree, writeWorktree, fileChanges } from './WorktreeFiles.mjs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import Path from 'node:path'

// The store keeps only the editor's worktree binding and a pending file transfer,
// never Git refs, commits or diffs. Git remains the sole version-control backend.
// All entrypoints run under the supplied per-project lock.
export class ProjectWorkspace {
  constructor({ repository, project, store, withLock, transferRoot }) {
    this.repository = repository
    this.project = project
    this.store = store
    this.withLock = withLock
    this.transferRoot = transferRoot && Path.resolve(transferRoot)
  }

  async current(binding) {
    return this.repository.openWorktree(binding.directory)
  }

  async synchronize(binding) {
    if (binding.mutationTaskId) throw Object.assign(new Error('A collaboration mutation requires recovery'), { status: 409 })
    if (binding.pending) throw Object.assign(new Error('A branch switch is still being applied'), { status: 409 })
    const repository = await this.current(binding)
    const snapshot = await this.project.read()
    await writeWorktree(repository.directory, snapshot.files)
    return { repository, snapshot }
  }

  async inspect() {
    return this.withLock(async () => {
      const binding = await this.store.read()
      if (binding.mutationTaskId) return { switching: true, branch: binding.branch, mutationTaskId: binding.mutationTaskId }
      if (binding.pending) return { switching: true, branch: binding.branch }
      const { repository } = await this.synchronize(binding)
      return { switching: false, status: await repository.status(), branches: await repository.branches(), tags: await repository.tagRefs(), graph: await repository.graph(), webRemotes: remoteWebLinks(await repository.remotes()) }
    })
  }

  // Historical objects do not depend on the live editor or working tree.
  async readHistory(action) {
    return this.withLock(async () => {
      const binding = await this.store.read()
      return action(await this.current(binding))
    })
  }

  // Stage/commit are ordinary native Git operations after exporting the editor.
  // Snapshot export does NOT stage or commit other selected/unselected files.
  async run(action) {
    return this.withLock(async () => {
      const binding = await this.store.read()
      const { repository } = await this.synchronize(binding)
      return action(repository)
    })
  }

  // Commands such as merge/stash/reset modify the current worktree. Save only
  // the editor transfer's before-image, then let native Git perform the command.
  // Even a failed merge must import its conflict markers and native index state.
  async mutate(action) {
    return this.withLock(async () => {
      if (!this.transferRoot) throw new Error('File transfer storage is not configured')
      const binding = await this.store.read()
      const { repository, snapshot } = await this.synchronize(binding)
      await mkdir(this.transferRoot, { recursive: true, mode: 0o700 })
      const beforeDirectory = await mkdtemp(Path.join(this.transferRoot, 'transfer-'))
      try {
        await writeWorktree(beforeDirectory, snapshot.files)
      } catch (error) {
        await rm(beforeDirectory, { recursive: true, force: true })
        throw error
      }
      // A failed acknowledgement may follow a successful durable write. Keep
      // the snapshot if begin fails; deleting it would break crash recovery.
      await this.store.begin({ directory: repository.directory, branch: binding.branch, beforeDirectory })
      let result, commandError
      try { result = await action(repository) } catch (error) { commandError = error }
      // Do not retry a Git command on recovery: it may already have committed.
      // Pending state survives any failure here and blocks stale editor export.
      try {
        await this.finishTransfer(await this.store.read())
      } catch (error) {
        if (commandError) error.cause = commandError
        throw error
      }
      if (commandError) {
        const status = await repository.status()
        if (status.conflicted.length) {
          throw Object.assign(new Error(`Git found conflicts in ${status.conflicted.length} file(s). Resolve them in Merge Changes, then continue or abort the operation.`, { cause: commandError }),
            { status: 409, code: 'GIT_CONFLICT' })
        }
        throw commandError
      }
      return result
    })
  }

  async switchBranch(name) {
    return this.switchTo(() => this.repository.branchWorktree(name))
  }
  async checkoutDetached(ref) {
    return this.switchTo(() => this.repository.detachedWorktree(ref))
  }

  async switchTo(selectWorktree) {
    return this.withLock(async () => {
      const binding = await this.store.read()
      const { repository: previous, snapshot } = await this.synchronize(binding)
      const target = await selectWorktree()
      if (target.directory === previous.directory) return { status: await target.status() }
      const targetFiles = await readWorktree(target.directory)
      const status = await target.status()
      const next = { directory: target.directory, branch: status.detached ? null : status.branch }
      // Persist BEFORE touching the collaborative project. On retry, do not
      // export a partially switched project back onto the previous worktree.
      await this.store.begin({ ...next, previousDirectory: previous.directory })
      await this.project.apply(fileChanges(snapshot.files, targetFiles), snapshot)
      await this.store.finish(next)
      return { status }
    })
  }

  async cancelSwitch() {
    return this.withLock(async () => {
      const binding = await this.store.read()
      if (!binding.pending) return
      if (binding.pending.beforeDirectory) {
        throw Object.assign(new Error('Resume the file transfer before undoing the native Git operation'), { status: 409 })
      }
      const previous = await this.repository.openWorktree(binding.pending.previousDirectory)
      const target = await this.repository.openWorktree(binding.pending.directory)
      const [before, after, live] = await Promise.all([
        readWorktree(previous.directory), readWorktree(target.directory), this.project.read(),
      ])
      // Roll back only bytes written by this transfer. Keep newer collaborator
      // content, then export it onto the original branch's unfinished worktree.
      const restore = fileChanges(before, after)
        .filter(change => same(live.files.get(change.path), change.after))
        .map(change => ({ path: change.path, before: change.after, after: change.before }))
      await this.project.apply(restore, live)
      await writeWorktree(previous.directory, (await this.project.read()).files)
      await this.store.finish({ directory: previous.directory, branch: binding.branch })
    })
  }

  async resumeSwitch() {
    return this.withLock(async () => {
      const binding = await this.store.read()
      if (!binding.pending) return { status: await (await this.current(binding)).status() }
      return this.finishTransfer(binding)
    })
  }

  async finishTransfer(binding) {
    const { directory, previousDirectory, beforeDirectory } = binding.pending
    const target = await this.repository.openWorktree(directory)
    if (beforeDirectory && (!this.transferRoot || Path.dirname(beforeDirectory) !== Path.resolve(this.transferRoot))) {
      throw new Error('Invalid file transfer snapshot')
    }
    const source = beforeDirectory || (await this.repository.openWorktree(previousDirectory)).directory
    const [before, after, live] = await Promise.all([
      readWorktree(source), readWorktree(target.directory), this.project.read(),
    ])
    // Idempotently resume only our own before/after bytes. A third value is a
    // newer user edit and must never be overwritten by a delayed retry.
    const changes = fileChanges(before, after)
    for (const { path, before: old, after: next } of changes) {
      const actual = live.files.get(path)
      if (!same(actual, old) && !same(actual, next)) {
        throw Object.assign(new Error(`File changed during branch switch: ${path}`), { status: 409 })
      }
    }
    await this.project.apply(changes.filter(change => !same(live.files.get(change.path), change.after)), live)
    const status = await target.status()
    await this.store.finish({ directory, branch: status.detached ? null : status.branch })
    if (beforeDirectory) await rm(beforeDirectory, { recursive: true, force: true })
    return { status }
  }
}

function same(a, b) { return a === undefined ? b === undefined : b !== undefined && a.equals(b) }
