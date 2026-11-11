import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { readWorktree, writeWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
import { ProjectWorkspace } from '../../app/src/Features/NativeGit/ProjectWorkspace.mjs'
import { WorkspaceStore } from '../../app/src/Features/NativeGit/WorkspaceStore.mjs'
import { executeGitCommand } from '../../app/src/Features/NativeGit/GitCommands.mjs'
import { generateCommitMessage } from '../../app/src/Features/NativeGit/CommitMessage.mjs'

const files = object => new Map(Object.entries(object).map(([path, content]) => [path, Buffer.from(content)]))
async function fixture(t) {
  const root = await mkdtemp(Path.join(tmpdir(), 'overleaf-project-worktree-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repository = await GitRepository.init(Path.join(root, 'repo'), { worktreeRoot: Path.join(root, 'worktrees') }, 'repo-test')
  await repository.author('Project Author', 'project@example.test')
  await writeWorktree(repository.directory, files({ 'frontmatter.tex': 'Old title\n', 'methods.tex': 'Old methods\n', 'image.pdf': [0, 255, 10, 13] }))
  await repository.stage(['frontmatter.tex', 'methods.tex', 'image.pdf'])
  const initial = await repository.commit('Original manuscript')
  await repository.createBranch('B')
  let binding = { directory: repository.directory, branch: 'repo-test' }
  const project = {
    files: await readWorktree(repository.directory),
    read: async () => ({ files: new Map(project.files) }),
    apply: async changes => {
      for (const change of changes) {
        if (change.after) project.files.set(change.path, change.after)
        else project.files.delete(change.path)
      }
    },
  }
  const store = { read: async () => structuredClone(binding),
    begin: async pending => { binding.pending = pending },
    finish: async next => { binding = next } }
  // Test harness serializes actions as the runtime project lock will.
  let queue = Promise.resolve()
  const withLock = action => {
    const result = queue.then(action)
    queue = result.catch(() => {})
    return result
  }
  const workspace = new ProjectWorkspace({ repository, project, store, withLock, transferRoot: Path.join(root, 'transfers') })
  return { root, repository, project, store, workspace, initial }
}

test('project bridge commits B files, shows old content on repo-test, and restores each dirty branch', async t => {
  const f = await fixture(t)
  await f.workspace.switchBranch('B')
  f.project.files.set('frontmatter.tex', Buffer.from('Committed B title\n'))
  f.project.files.set('methods.tex', Buffer.from('Uncommitted B methods\n'))
  const commit = await f.workspace.run(async repo => { await repo.stage(['frontmatter.tex']); return repo.commit('B title') })
  const bState = await f.workspace.inspect()
  assert.deepEqual(bState.status.files.map(file => file.path), ['methods.tex'])
  assert.equal(bState.graph[0].hash, commit)
  await f.workspace.switchBranch('repo-test')
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Old title\n')
  assert.deepEqual((await f.workspace.inspect()).status.files, [])
  assert.equal(await f.repository.head(), f.initial)
  f.project.files.set('frontmatter.tex', Buffer.from('Uncommitted old branch title\n'))
  await f.workspace.switchBranch('B')
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Committed B title\n')
  assert.equal(f.project.files.get('methods.tex').toString(), 'Uncommitted B methods\n')
  await f.workspace.switchBranch('repo-test')
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Uncommitted old branch title\n')
})

test('interrupted project transfer never exports mixed files into the old branch, and resumes idempotently', async t => {
  const f = await fixture(t)
  const b = await f.repository.branchWorktree('B')
  await writeWorktree(b.directory, files({ 'frontmatter.tex': 'B title', 'new.tex': 'B new file', 'image.pdf': [255, 0, 13] }))
  const originalApply = f.project.apply
  f.project.apply = async changes => {
    await originalApply(changes.slice(0, 1))
    throw new Error('Simulated transport loss')
  }
  await assert.rejects(f.workspace.switchBranch('B'), /transport loss/)
  assert.equal((await f.store.read()).branch, 'repo-test')
  assert.equal((await f.workspace.inspect()).switching, true)
  await assert.rejects(f.workspace.run(repo => repo.commit('must not run')), /still being applied/)
  assert.equal(await readFile(Path.join(f.repository.directory, 'frontmatter.tex'), 'utf8'), 'Old title\n')
  f.project.apply = originalApply
  await f.workspace.resumeSwitch()
  assert.equal((await f.store.read()).branch, 'B')
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'B title')
  assert.equal(f.project.files.has('methods.tex'), false)
  assert.equal(f.project.files.get('new.tex').toString(), 'B new file')
  assert.deepEqual(f.project.files.get('image.pdf'), Buffer.from([255, 0, 13]))
  await f.workspace.resumeSwitch()
  assert.equal((await f.workspace.inspect()).status.branch, 'B')
})

test('resuming an interrupted switch refuses to overwrite a newer collaborator value', async t => {
  const f = await fixture(t)
  const b = await f.repository.branchWorktree('B')
  await writeFile(Path.join(b.directory, 'frontmatter.tex'), 'B title\n')
  f.project.apply = async () => { throw new Error('Connection lost') }
  await assert.rejects(f.workspace.switchBranch('B'))
  f.project.files.set('frontmatter.tex', Buffer.from('Collaborator newer title\n'))
  await assert.rejects(f.workspace.resumeSwitch(), /File changed during branch switch/)
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Collaborator newer title\n')
  assert.equal((await f.workspace.inspect()).switching, true)
})

test('export preserves staged index, ignored files and binary bytes; supports file/folder transitions', async t => {
  const f = await fixture(t)
  await writeWorktree(f.repository.directory, files({ '.gitignore': '*.aux\n', 'scratch.aux': 'ignored', 'folder/one.tex': 'first', 'image.pdf': [255, 0, 10] }))
  await f.repository.stage(['folder/one.tex'])
  await writeWorktree(f.repository.directory, files({ '.gitignore': '*.aux\n', 'scratch.aux': 'changed ignored', 'folder/one.tex': 'second', 'image.pdf': [255, 1, 10] }))
  assert.match(await f.repository.diff({ staged: true }), /first/)
  assert.match(await f.repository.diff(), /second/)
  assert.equal((await f.repository.status()).files.some(file => file.path === 'scratch.aux'), false)
  assert.deepEqual((await readWorktree(f.repository.directory)).get('image.pdf'), Buffer.from([255, 1, 10]))
  await writeWorktree(f.repository.directory, files({ folder: 'now a file' }))
  assert.equal(await readFile(Path.join(f.repository.directory, 'folder'), 'utf8'), 'now a file')
  await writeWorktree(f.repository.directory, files({ 'folder/child.tex': 'a directory again' }))
  assert.equal(await readFile(Path.join(f.repository.directory, 'folder/child.tex'), 'utf8'), 'a directory again')
})

test('invalid paths, nested .git and symlinks are rejected before replacing any file', async t => {
  const f = await fixture(t)
  const metadata = await readFile(Path.join(f.repository.directory, '.git/HEAD'), 'utf8')
  for (const path of ['../outside', '.git/config', 'nested/.git/config', '/absolute']) {
    await assert.rejects(writeWorktree(f.repository.directory, files({ [path]: 'bad' })))
  }
  await assert.rejects(writeWorktree(f.repository.directory, files({ a: 'file', 'a/b': 'collision' })))
  await symlink('/tmp', Path.join(f.repository.directory, 'outside'))
  await assert.rejects(writeWorktree(f.repository.directory, files({ 'frontmatter.tex': 'bad update' })), /symbolic link/)
  assert.equal(await readFile(Path.join(f.repository.directory, '.git/HEAD'), 'utf8'), metadata)
  assert.equal(await readFile(Path.join(f.repository.directory, 'frontmatter.tex'), 'utf8'), 'Old title\n')
})

test('canceling an interrupted transfer restores old branch and retains later collaborator edits', async t => {
  const f = await fixture(t)
  const b = await f.repository.branchWorktree('B')
  await writeFile(Path.join(b.directory, 'frontmatter.tex'), 'B title\n')
  await writeFile(Path.join(b.directory, 'methods.tex'), 'B methods\n')
  const apply = f.project.apply
  f.project.apply = async changes => { await apply(changes.slice(0, 1)); throw new Error('Lost connection') }
  await assert.rejects(f.workspace.switchBranch('B'))
  f.project.files.set('methods.tex', Buffer.from('New collaborator methods\n'))
  f.project.apply = apply
  await f.workspace.cancelSwitch()
  assert.equal((await f.store.read()).branch, 'repo-test')
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Old title\n')
  assert.equal(f.project.files.get('methods.tex').toString(), 'New collaborator methods\n')
  assert.equal(await readFile(Path.join(f.repository.directory, 'methods.tex'), 'utf8'), 'New collaborator methods\n')
  assert.deepEqual((await f.workspace.inspect()).status.files.map(file => file.path), ['methods.tex'])
  assert.equal(await readFile(Path.join(b.directory, 'frontmatter.tex'), 'utf8'), 'B title\n')
})

test('native stash and pop update editor files and preserve the native staged index', async t => {
  const f = await fixture(t)
  f.project.files.set('frontmatter.tex', Buffer.from('Staged title\n'))
  f.project.files.set('new.tex', Buffer.from('Untracked work\n'))
  await f.workspace.run(repo => repo.stage(['frontmatter.tex']))
  await f.workspace.mutate(repo => repo.stash('Draft', { mode: 'include-untracked' }))
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Old title\n')
  assert.equal(f.project.files.has('new.tex'), false)
  assert.deepEqual((await f.workspace.inspect()).status.files, [])
  await f.workspace.mutate(repo => repo.applyStash(0, { pop: true }))
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Staged title\n')
  assert.equal(f.project.files.get('new.tex').toString(), 'Untracked work\n')
  assert.match(await f.repository.diff({ staged: true }), /Staged title/)
  assert.equal((await f.store.read()).pending, undefined)
})

test('interrupted import after native reset resumes without rerunning Git or exporting stale editor files', async t => {
  const f = await fixture(t)
  f.project.files.set('frontmatter.tex', Buffer.from('New committed title\n'))
  await f.workspace.run(async repo => { await repo.stage(['frontmatter.tex']); await repo.commit('New title') })
  const apply = f.project.apply
  f.project.apply = async () => { throw new Error('Editor unavailable') }
  let commands = 0
  await assert.rejects(f.workspace.mutate(async repo => { commands++; await repo.reset(f.initial, 'hard') }), /Editor unavailable/)
  assert.equal(await f.repository.head(), f.initial)
  assert.equal((await f.workspace.inspect()).switching, true)
  await assert.rejects(f.workspace.cancelSwitch(), /Resume the file transfer/)
  f.project.apply = apply
  await f.workspace.resumeSwitch()
  assert.equal(commands, 1)
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Old title\n')
  assert.deepEqual((await f.workspace.inspect()).status.files, [])
})

test('native merge conflicts are imported into editor and native abort restores editor content', async t => {
  const f = await fixture(t)
  const b = await f.repository.branchWorktree('B')
  await writeFile(Path.join(b.directory, 'frontmatter.tex'), 'B title\n')
  await b.stage(['frontmatter.tex'])
  await b.commit('B title')
  f.project.files.set('frontmatter.tex', Buffer.from('Main title\n'))
  await f.workspace.run(async repo => { await repo.stage(['frontmatter.tex']); await repo.commit('Main title') })
  await assert.rejects(f.workspace.mutate(repo => repo.merge('B')), error => error.status === 409 && error.code === 'GIT_CONFLICT')
  assert.match(f.project.files.get('frontmatter.tex').toString(), /<<<<<<< HEAD/)
  assert.deepEqual((await f.workspace.inspect()).status.conflicted, ['frontmatter.tex'])
  assert.equal((await f.store.read()).pending, undefined)
  await f.workspace.mutate(repo => repo.continueOperation('merge', 'abort'))
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Main title\n')
  assert.deepEqual((await f.workspace.inspect()).status.files, [])
})

test('a new process can resume a persisted native-operation transfer without invoking the Git command again', async t => {
  const f = await fixture(t)
  const storePath = Path.join(f.root, 'binding')
  const store = new WorkspaceStore(storePath)
  await store.initialize(await f.store.read())
  const workspace = new ProjectWorkspace({ repository: f.repository, project: f.project, store,
    withLock: fn => fn(), transferRoot: Path.join(f.root, 'transfers') })
  f.project.files.set('frontmatter.tex', Buffer.from('Draft title\n'))
  const apply = f.project.apply
  f.project.apply = async () => { throw new Error('Process interrupted') }
  await assert.rejects(workspace.mutate(repo => repo.stash('Saved draft')), /Process interrupted/)
  assert.equal((await f.repository.stashes()).length, 1)
  const restartedStore = new WorkspaceStore(storePath)
  assert.ok((await restartedStore.read()).pending.beforeDirectory)
  f.project.apply = apply
  const restarted = new ProjectWorkspace({ repository: f.repository, project: f.project, store: restartedStore,
    withLock: fn => fn(), transferRoot: Path.join(f.root, 'transfers') })
  await restarted.resumeSwitch()
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Old title\n')
  assert.equal((await restartedStore.read()).pending, undefined)
  assert.equal((await f.repository.stashes()).length, 1)
  await restarted.mutate(repo => repo.applyStash(0, { pop: true }))
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Draft title\n')
})

test('command adapter uses the requesting author and native index, refs, diffs and branch checkout', async t => {
  const f = await fixture(t)
  const execute = command => executeGitCommand(f.workspace, command, { name: 'Request Author', email: 'request@example.test' })
  await execute({ command: 'createBranch', name: 'new-branch' })
  await execute({ command: 'checkout', name: 'new-branch' })
  f.project.files.set('frontmatter.tex', Buffer.from('Selected title\n'))
  f.project.files.set('methods.tex', Buffer.from('Unselected methods\n'))
  await execute({ command: 'stage', paths: ['frontmatter.tex'] })
  const hash = await execute({ command: 'commit', message: 'Update title' })
  const graph = await execute({ command: 'graph' })
  assert.equal(graph[0].hash, hash)
  assert.equal(graph[0].author, 'Request Author')
  assert.equal(graph[0].email, 'request@example.test')
  assert.equal(await execute({ command: 'show', ref: hash, path: 'methods.tex' }), 'Old methods\n')
  assert.match(await execute({ command: 'diff' }), /Unselected methods/)
  await execute({ command: 'checkout', name: 'repo-test' })
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'Old title\n')
  await assert.rejects(execute({ command: 'raw', args: ['reset', '--hard'] }))
  await assert.rejects(execute({ command: 'commit', message: 'bad', config: ['core.hooksPath=/tmp'] }))
})

test('AI commit message receives staged content and native diff, excluding unstaged and unselected edits', async t => {
  const f = await fixture(t)
  f.project.files.set('frontmatter.tex', Buffer.from('Selected title\n'))
  await f.workspace.run(repo => repo.stage(['frontmatter.tex']))
  f.project.files.set('frontmatter.tex', Buffer.from('Later unstaged title\n'))
  f.project.files.set('methods.tex', Buffer.from('Unselected secret methods\n'))
  const result = await generateCommitMessage(f.workspace, async input => {
    const context = JSON.parse(input.userMessage)
    assert.equal(context.files.length, 1)
    assert.equal(context.files[0].content, 'Selected title\n')
    assert.match(context.diff, /-Old title/)
    assert.match(context.diff, /\+Selected title/)
    assert.doesNotMatch(input.userMessage, /Later unstaged|Unselected secret/)
    return JSON.stringify({ result: 'Update manuscript title' })
  })
  assert.equal(result, 'Update manuscript title')
  assert.equal(await f.repository.head(), f.initial)
  assert.match(await f.repository.diff(), /Later unstaged/)
})

test('AI result is rejected if the staged native tree changes while generating', async t => {
  const f = await fixture(t)
  f.project.files.set('frontmatter.tex', Buffer.from('First title\n'))
  await f.workspace.run(repo => repo.stage(['frontmatter.tex']))
  await assert.rejects(generateCommitMessage(f.workspace, async () => {
    f.project.files.set('frontmatter.tex', Buffer.from('Second title\n'))
    await f.workspace.run(repo => repo.stage(['frontmatter.tex']))
    return JSON.stringify({ result: 'Describe first title' })
  }), /Staged changes changed/)
})

test('native diff displays untracked additions and the root commit without a fabricated parent', async t => {
  const f = await fixture(t)
  f.project.files.set('new.tex', Buffer.from('New manuscript section\n'))
  const diff = await executeGitCommand(f.workspace, { command: 'fileDiff', path: 'new.tex' })
  assert.match(diff, /new file mode/)
  assert.match(diff, /\+New manuscript section/)
  const root = await executeGitCommand(f.workspace, { command: 'commitDiff', ref: f.initial })
  assert.match(root, /\+Old title/)
})

test('resolving native conflict imports chosen file into the editor and keeps merge continuation separate', async t => {
  const f = await fixture(t)
  const b = await f.repository.branchWorktree('B')
  await writeFile(Path.join(b.directory, 'frontmatter.tex'), 'B title\n')
  await b.stage(['frontmatter.tex']); await b.commit('B title')
  f.project.files.set('frontmatter.tex', Buffer.from('Main title\n'))
  await f.workspace.run(async repo => { await repo.stage(['frontmatter.tex']); await repo.commit('Main title') })
  await assert.rejects(f.workspace.mutate(repo => repo.merge('B')), error => error.status === 409 && error.code === 'GIT_CONFLICT')
  const details = await f.workspace.run(repo => repo.conflictDetails('frontmatter.tex'))
  await f.workspace.mutate(repo => repo.resolveConflict('frontmatter.tex', details.fingerprint, 'incoming'))
  assert.equal(f.project.files.get('frontmatter.tex').toString(), 'B title\n')
  const resolved = await f.workspace.inspect()
  assert.deepEqual(resolved.status.conflicted, [])
  assert.equal(resolved.status.operation, 'merge')
  assert.equal((await f.store.read()).pending, undefined)
  await f.workspace.mutate(repo => repo.continueOperation('merge', 'continue'))
  assert.equal((await f.workspace.inspect()).status.operation, null)
})

test('inspection exposes sanitized provider metadata from actual native remote configuration', async t => {
  const f = await fixture(t)
  await f.repository.git.addRemote('origin', 'https://user:secret@gitee.com/team/project.git?token=secret')
  const snapshot = await f.workspace.inspect()
  assert.deepEqual(snapshot.webRemotes, [{ name: 'origin', provider: 'Gitee', commitBaseUrl: 'https://gitee.com/team/project/commit/' }])
  assert.equal(JSON.stringify(snapshot).includes('secret'), false)
})


test('historical file reads do not export or alter unsaved editor content', async t => {
  const f = await fixture(t)
  const ref = (await f.repository.git.raw(['rev-parse', 'HEAD'])).trim()
  f.project.read = async () => { throw new Error('History must not export the live project') }
  const before = await readWorktree(f.repository.directory)
  for (const command of ['commitFiles', 'commitDiff', 'commitFileDiff']) {
    const result = await executeGitCommand(f.workspace, { command, ref, ...(command === 'commitFileDiff' ? { path: 'frontmatter.tex' } : {}) })
    assert.ok(result)
  }
  assert.deepEqual(await readWorktree(f.repository.directory), before)
})

test('commit previews preserve binary bytes and the exact parent/new versions', async t => {
  const f = await fixture(t)
  const first = Buffer.from([137, 80, 78, 71, 0, 255, 12])
  const second = Buffer.from([137, 80, 78, 71, 0, 128, 13])
  await writeFile(Path.join(f.repository.directory, 'figure.png'), first)
  await f.repository.stage(['figure.png']); await f.repository.commit('Add figure')
  const added = (await f.repository.git.raw(['rev-parse', 'HEAD'])).trim()
  await writeFile(Path.join(f.repository.directory, 'figure.png'), second)
  await f.repository.stage(['figure.png']); await f.repository.commit('Change figure')
  const changed = (await f.repository.git.raw(['rev-parse', 'HEAD'])).trim()
  f.project.read = async () => { throw new Error('Do not read the current editor') }
  const old = await executeGitCommand(f.workspace, { command: 'commitFilePreview', ref: added, path: 'figure.png' })
  assert.equal(old.before, null)
  assert.deepEqual(Buffer.from(old.after.base64, 'base64'), first)
  const next = await executeGitCommand(f.workspace, { command: 'commitFilePreview', ref: changed, path: 'figure.png' })
  assert.deepEqual(Buffer.from(next.before.base64, 'base64'), first)
  assert.deepEqual(Buffer.from(next.after.base64, 'base64'), second)
  const pdf = await executeGitCommand(f.workspace, { command: 'commitFilePreview', ref: added + '^', path: 'image.pdf' })
  assert.equal(pdf.after.mime, 'application/pdf')
  assert.deepEqual(Buffer.from(pdf.after.base64, 'base64'), Buffer.from([0, 255, 10, 13]))
})


test('working and staged previews distinguish HEAD, index and current bytes, including untracked files', async t => {
  const f = await fixture(t)
  const staged = Buffer.from('%PDF-1.4 staged')
  const working = Buffer.from('%PDF-1.4 working')
  await writeFile(Path.join(f.repository.directory, 'image.pdf'), staged)
  await f.repository.stage(['image.pdf'])
  f.project.files.set('image.pdf', working)
  f.project.files.set('new.pdf', working)
  const read = (path, staged) => executeGitCommand(f.workspace, { command: 'filePreview', path, staged })
  const pending = await read('image.pdf', false)
  assert.deepEqual(Buffer.from(pending.before.base64, 'base64'), staged)
  assert.deepEqual(Buffer.from(pending.after.base64, 'base64'), working)
  const index = await read('image.pdf', true)
  assert.deepEqual(Buffer.from(index.before.base64, 'base64'), Buffer.from([0,255,10,13]))
  assert.deepEqual(Buffer.from(index.after.base64, 'base64'), staged)
  const added = await read('new.pdf', false)
  assert.equal(added.before, null)
  assert.deepEqual(Buffer.from(added.after.base64, 'base64'), working)
})
