import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { connectRepository } from '../../app/src/Features/NativeGit/ConnectRepository.mjs'
import { WorkspaceStore } from '../../app/src/Features/NativeGit/WorkspaceStore.mjs'
import { ProjectWorkspace } from '../../app/src/Features/NativeGit/ProjectWorkspace.mjs'
import { writeWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
const files = values => new Map(Object.entries(values).map(([name, text]) => [name, Buffer.from(text)]))
async function fixture(t) {
  const root = await mkdtemp(Path.join(tmpdir(), 'git-connect-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const source = await GitRepository.init(Path.join(root, 'source'), {}, 'main')
  await source.author('Remote Author', 'remote@example.test')
  await writeWorktree(source.directory, files({ 'paper.tex': 'Remote paper\n', 'remote-only.tex': 'Remote appendix\n' }))
  await source.stage(['paper.tex', 'remote-only.tex'])
  const head = await source.commit('Remote manuscript')
  const projectRoot = Path.join(root, 'project')
  await mkdir(Path.join(projectRoot, 'repository'), { recursive: true })
  const repository = new GitRepository(Path.join(projectRoot, 'repository'), { allowLocalRemotes: true, worktreeRoot: Path.join(projectRoot, 'worktrees') })
  const store = new WorkspaceStore(Path.join(projectRoot, 'binding'))
  const projectFiles = files({ 'paper.tex': 'Unfinished project paper\n', 'local-only.tex': 'My appendix\n' })
  const project = { read: async () => ({ files: new Map(projectFiles) }), apply: async () => { throw new Error('Connect must not overwrite editor files') } }
  const context = { root: projectRoot, repository, store, withLock: action => action(), credentials: { read: async () => null } }
  return { context, source, head, projectFiles, workspace: new ProjectWorkspace({ ...context, project }) }
}

test('connect clones real history and retains all current project bytes as uncommitted changes', async t => {
  const { context, source, head, projectFiles, workspace } = await fixture(t)
  await connectRepository(context, { url: source.directory, branch: 'main' })
  const result = await workspace.inspect()
  assert.equal(await context.repository.head(), head)
  assert.equal(result.status.branch, 'main')
  assert.equal(result.graph[0].subject, 'Remote manuscript')
  assert.equal(result.graph[0].author, 'Remote Author')
  assert.deepEqual(result.status.files.map(file => file.path).sort(), ['local-only.tex', 'paper.tex', 'remote-only.tex'])
  assert.equal(await readFile(Path.join(context.repository.directory, 'paper.tex'), 'utf8'), 'Unfinished project paper\n')
  assert.equal(projectFiles.get('paper.tex').toString(), 'Unfinished project paper\n')
  assert.equal(await context.repository.show('HEAD', 'paper.tex'), 'Remote paper\n')
  await assert.rejects(connectRepository(context, { url: source.directory }), /already has/)
})

test('connect resumes after clone installation acknowledgement failure without discarding the repository', async t => {
  const { context, source, head, workspace } = await fixture(t)
  const initialize = context.store.initialize.bind(context.store)
  context.store.initialize = async () => { throw new Error('Binding unavailable') }
  await assert.rejects(connectRepository(context, { url: source.directory }), /Binding unavailable/)
  assert.equal(await context.repository.head(), head)
  context.store.initialize = initialize
  await connectRepository(context, { url: source.directory })
  assert.equal((await workspace.inspect()).status.branch, 'main')
})

test('failed clone leaves editor unbound and allows retry', async t => {
  const { context, source } = await fixture(t)
  await assert.rejects(connectRepository(context, { url: source.directory, branch: 'missing-branch' }))
  await assert.rejects(context.store.read(), { code: 'ENOENT' })
  await connectRepository(context, { url: source.directory, branch: 'main' })
  assert.equal((await context.store.read()).branch, 'main')
})
