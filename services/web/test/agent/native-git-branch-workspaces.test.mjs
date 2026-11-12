import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { WorkspaceStore } from '../../app/src/Features/NativeGit/WorkspaceStore.mjs'
import { ProjectWorkspace } from '../../app/src/Features/NativeGit/ProjectWorkspace.mjs'
import { writeWorktree, readWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
import { enterBranchWorkspace } from '../../app/src/Features/NativeGit/BranchWorkspaces.mjs'
import { workspaceIdentity, inheritedWorkspaceAccess } from '../../app/src/Features/NativeGit/WorkspaceIdentity.mjs'

const parent = '111111111111111111111111'
const child = '222222222222222222222222'
const data = text => new Map([['main.tex', Buffer.from(text)]])

test('workspace permission inheritance excludes token access and stale members', () => {
  const storage = { _id: child, owner_ref: 'former-owner', collaberator_refs: ['removed'],
    gitWorkspace: { logicalProjectId: parent, branch: 'B', state: 'ready', epoch: 1 } }
  const project = { _id: parent, owner_ref: 'owner', collaberator_refs: ['A', 'B'],
    publicAccesLevel: 'tokenBased', tokenAccessReadAndWrite_refs: ['outsider'], tokens: { readAndWrite: 'secret' } }
  const access = inheritedWorkspaceAccess(storage, project)
  assert.deepEqual(access.collaberator_refs, ['A', 'B'])
  assert.equal(access.owner_ref, 'owner')
  assert.equal(access.publicAccesLevel, 'private')
  assert.deepEqual(access.tokenAccessReadAndWrite_refs, [])
  assert.deepEqual(access.tokens, {})
  project.collaberator_refs = ['A']
  assert.deepEqual(inheritedWorkspaceAccess(storage, project).collaberator_refs, ['A'])
  for (const state of ['preparing', 'failed', 'archived']) {
    assert.throws(() => inheritedWorkspaceAccess({ ...storage, gitWorkspace: { ...storage.gitWorkspace, state } }, project))
  }
  assert.throws(() => inheritedWorkspaceAccess(storage, { ...project, _id: child }))
  assert.throws(() => inheritedWorkspaceAccess(storage, { ...project, gitWorkspace: { logicalProjectId: child } }))
  assert.throws(() => inheritedWorkspaceAccess(storage, null))
  assert.throws(() => workspaceIdentity({ _id: child, gitWorkspace: { logicalProjectId: child } }))
  assert.equal(workspaceIdentity({ _id: parent, gitWorkspaceEnabled: true }).enabled, true)
})

async function fixture(t) {
  const root = await mkdtemp(Path.join(tmpdir(), 'branch-workspace-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repository = await GitRepository.init(Path.join(root, 'repo'), { worktreeRoot: Path.join(root, 'trees') }, 'main')
  await repository.author('Fixture', 'fixture@example.test')
  await writeWorktree(repository.directory, data('committed base'))
  await repository.stage(['main.tex'])
  await repository.commit('base')
  await repository.createBranch('B')
  const defaultStore = new WorkspaceStore(Path.join(root, 'binding'))
  await defaultStore.initialize({ directory: repository.directory, branch: 'main' })
  let queue = Promise.resolve()
  const withLock = action => { const result = queue.then(action); queue = result.catch(() => {}); return result }
  const records = new Map(), contexts = new Map()
  const source = { logicalProjectId: parent, root, repository, defaultStore, withLock }
  let interrupt = false
  const hooks = {
    find: async (_, branch) => [...records.values()].find(x => x.gitWorkspace.branch === branch),
    create: async (_, id, branch) => {
      const record = { _id: id, gitWorkspace: { logicalProjectId: parent, branch, state: 'preparing' } }
      records.set(id, record)
      return record
    },
    ready: async id => { records.get(id).gitWorkspace.state = 'ready' },
    context: async id => {
      if (!contexts.has(id)) {
        const store = new WorkspaceStore(Path.join(root, 'bindings', id))
        const project = { files: new Map(), read: async () => ({ files: new Map(project.files) }),
          apply: async changes => {
            for (const change of changes) {
              if (change.after) project.files.set(change.path, change.after)
              else project.files.delete(change.path)
            }
            if (interrupt) { interrupt = false; throw new Error('injected crash after import') }
          } }
        const transferRoot = Path.join(root, 'transfers', id)
        contexts.set(id, { store, project, transferRoot,
          workspace: new ProjectWorkspace({ repository, store, project, transferRoot, withLock }) })
      }
      return contexts.get(id)
    },
  }
  return { source, hooks, records, contexts, crash: () => { interrupt = true } }
}

test('concurrent A/B/C entering one branch reuse one workspace and leave default dirty bytes untouched', async t => {
  const f = await fixture(t)
  await writeWorktree(f.source.repository.directory, data('A unsaved main edits'))
  const results = await Promise.all(['A', 'B', 'C'].map(() => enterBranchWorkspace(f.source, 'B', f.hooks)))
  assert.equal(new Set(results.map(x => x.workspaceId)).size, 1)
  assert.equal(f.records.size, 1)
  assert.equal((await readWorktree(f.source.repository.directory)).get('main.tex').toString(), 'A unsaved main edits')
  const workspace = f.contexts.get(results[0].workspaceId)
  assert.equal(workspace.project.files.get('main.tex').toString(), 'committed base')
  workspace.project.files.set('main.tex', Buffer.from('B collaborative edit'))
  await enterBranchWorkspace(f.source, 'B', f.hooks)
  assert.equal(workspace.project.files.get('main.tex').toString(), 'B collaborative edit')
  assert.deepEqual(await f.source.defaultStore.read(), { directory: f.source.repository.directory, branch: 'main' })
  assert.equal((await enterBranchWorkspace(f.source, 'main', f.hooks)).workspaceId, parent)
})

test('interrupted initialization resumes the same identity without duplicating or replacing edited bytes', async t => {
  const f = await fixture(t)
  f.crash()
  await assert.rejects(enterBranchWorkspace(f.source, 'B', f.hooks), /injected crash/)
  assert.equal(f.records.size, 1)
  const record = [...f.records.values()][0]
  assert.equal(record.gitWorkspace.state, 'preparing')
  const target = f.contexts.get(record._id)
  target.project.files.set('main.tex', Buffer.from('newer recovered data'))
  await assert.rejects(enterBranchWorkspace(f.source, 'B', f.hooks), /File changed/)
  assert.equal(target.project.files.get('main.tex').toString(), 'newer recovered data')
  // Simulate recovery restoring the transaction's already-applied after image.
  target.project.files.set('main.tex', Buffer.from('committed base'))
  const result = await enterBranchWorkspace(f.source, 'B', f.hooks)
  assert.equal(result.workspaceId, record._id)
  assert.equal(record.gitWorkspace.state, 'ready')
})

test('legacy dirty target worktree is refused without importing or discarding it', async t => {
  const f = await fixture(t)
  const branch = await f.source.repository.branchWorktree('B')
  await writeWorktree(branch.directory, data('legacy shell edits'))
  await assert.rejects(enterBranchWorkspace(f.source, 'B', f.hooks), /uncommitted files/)
  assert.equal(f.records.size, 0)
  assert.equal((await readWorktree(branch.directory)).get('main.tex').toString(), 'legacy shell edits')
})

test('workspace origin is the target branch commit, not the active source head', async t => {
  const f = await fixture(t), base = await f.source.repository.head()
  await writeWorktree(f.source.repository.directory, data('newer main commit'))
  await f.source.repository.stage(['main.tex']); await f.source.repository.commit('advance main')
  const create = f.hooks.create; let origin
  f.hooks.create = async (...args) => { origin = args[3]; return create(...args) }
  await enterBranchWorkspace(f.source, 'B', f.hooks)
  assert.equal(origin.commit, base)
  assert.notEqual(origin.commit, await f.source.repository.head())
})


test('ambiguous directory names refuse workspace allocation without changing default contents', async t => {
  const f = await fixture(t)
  const target = await f.source.repository.branchWorktree('B')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(Path.join(target.directory, 'Figures'))
  await mkdir(Path.join(target.directory, 'figures')).catch(error => { if (error.code !== 'EEXIST') throw error })
  await writeFile(Path.join(target.directory, 'Figures/a.png'), 'first')
  await writeFile(Path.join(target.directory, 'figures/b.png'), 'second')
  const names = await (await import('node:fs/promises')).readdir(target.directory)
  if (!(names.includes('Figures') && names.includes('figures'))) { t.skip('Requires case-sensitive filesystem; run in project Linux container'); return }
  await assert.rejects(enterBranchWorkspace(f.source, 'B', f.hooks), { code: 'PROJECT_PATH_COLLISION' })
  assert.equal(f.records.size, 0)
  assert.equal((await readWorktree(f.source.repository.directory)).get('main.tex').toString(), 'committed base')
})
