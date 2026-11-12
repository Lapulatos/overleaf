import test from 'node:test'
import assert from 'node:assert/strict'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { ProjectWorkspace } from '../../app/src/Features/NativeGit/ProjectWorkspace.mjs'
import { WorkspaceStore } from '../../app/src/Features/NativeGit/WorkspaceStore.mjs'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { createAutoSync } from '../../app/src/Features/NativeGit/AutoSyncRuntime.mjs'
import { writeWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
async function fixture(t) {
 const root = await mkdtemp(Path.join(tmpdir(), 'auto-sync-'))
 t.after(() => rm(root, { recursive: true, force: true }))
 const options = { allowLocalRemotes: true, worktreeRoot: Path.join(root, 'trees') }
 const external = await GitRepository.init(Path.join(root, 'external'), options)
 const identity = { name: 'Fixture', email: 'fixture@example.test' }
 await external.author(identity.name, identity.email)
 await writeFile(Path.join(external.directory, 'main.tex'), 'base\n'); await external.stage(['main.tex']); await external.commit('base')
 const remote = Path.join(root, 'remote.git')
 await external.git.raw(['clone', '--bare', external.directory, remote]); await external.addRemote('origin', remote)
 await mkdir(Path.join(root, 'repo'))
 const repo = new GitRepository(Path.join(root, 'repo'), options); await repo.clone(remote); await repo.author(identity.name, identity.email)
 const files = new Map([['main.tex', Buffer.from('base\n')]])
 let version = 1, epoch = 1, allowed = true
 const project = { read: async () => ({ files: new Map(files), folders: new Map(), entries: new Map([...files.keys()].map(path => [path, { docId: path, version }])) }) }
 project.transaction = async (action, settings) => {
  assert.equal(settings.prepare, true); assert.equal(settings.epoch, epoch)
  return action({ read: project.read, assertActive: async () => assert.ok(allowed), advanceEpoch: async () => ++epoch,
   apply: async (changes, before, callback) => {
    for (const [step, change] of changes.entries()) {
     await callback({ phase: 'before', step, path: change.path })
     if (change.after) files.set(change.path, change.after); else files.delete(change.path)
     version++; await callback({ phase: 'after', step, path: change.path })
    }
   } })
 }
 const store = new WorkspaceStore(Path.join(root, 'binding')); await store.initialize({ directory: repo.directory, branch: 'main' })
 let gitQueue = Promise.resolve(), scheduleQueue = Promise.resolve()
 const gitLock = fn => { const result = gitQueue.then(fn); gitQueue = result.catch(() => {}); return result }
 const scheduleLock = fn => { const result = scheduleQueue.then(fn); scheduleQueue = result.catch(() => {}); return result }
 const workspace = new ProjectWorkspace({ repository: repo, project, store, withLock: gitLock })
 const c = { root, logicalProjectId: 'logical', store, repository: repo, workspace, withLock: gitLock, credentials: { read: async () => null }, epoch: { read: async () => epoch } }
 const service = createAutoSync({ c, workspaceId: 'workspace', ownerId: 'a'.repeat(24), authorize: async () => { if (!allowed) throw Object.assign(Error('revoked'), { status: 403 }) }, author: async () => identity, withLock: scheduleLock })
 const configure = async (extra = {}) => service.configure({ enabled: true, pull: true, push: false, remote: 'origin', branch: 'main', intervalMs: 60000, revision: (await service.status()).revision, ...extra })
 const advance = async (text = 'incoming\n') => { await writeFile(Path.join(external.directory, 'main.tex'), text); await external.stage(['main.tex']); await external.commit('incoming'); await external.git.raw(['push', 'origin', 'main']); return external.head() }
 const local = async (text = 'local\n') => { files.set('main.tex', Buffer.from(text)); version++; await writeWorktree(repo.directory, files); await repo.stage(['main.tex']); await repo.commit('local'); return repo.head() }
 return { service, configure, advance, local, files, repo, external, remote, root, store, revoke: () => { allowed = false } }
}
test('automatic clean pull fast-forwards exact remote commit through prepared documents once', async t => {
 const f = await fixture(t), incoming = await f.advance()
 await f.configure()
 const results = await Promise.all([f.service.runDue(), f.service.runDue()])
 assert.equal(results.filter(Boolean).length, 1)
 assert.equal(results.find(Boolean).state, 'scheduled')
 assert.equal(await f.repo.head(), incoming)
 assert.equal(f.files.get('main.tex').toString(), 'incoming\n')
 assert.equal((await f.store.read()).mutationTaskId, undefined)
})
test('automatic push publishes exact committed candidate without creating a merge', async t => {
 const f = await fixture(t), candidate = await f.local()
 await f.configure({ pull: false, push: true })
 assert.equal((await f.service.runDue()).state, 'scheduled')
 assert.equal((await f.external.git.raw(['ls-remote', f.remote, 'refs/heads/main'])).split(/\s/)[0], candidate)
 assert.equal(await f.repo.head(), candidate)
})
test('uncommitted text is preserved while automatic pull waits', async t => {
 const f = await fixture(t), before = await f.repo.head(); await f.advance()
 f.files.set('main.tex', Buffer.from('unsaved local choice\n'))
 await f.configure()
 assert.equal((await f.service.runDue()).reason, 'waiting-for-commit')
 assert.equal(await f.repo.head(), before)
 assert.equal(f.files.get('main.tex').toString(), 'unsaved local choice\n')
})
test('divergence creates shared conflict and pauses without changing live text or pushing', async t => {
 const f = await fixture(t); await f.advance(); const before = await f.local()
 await f.configure({ push: true })
 const result = await f.service.runDue()
 assert.equal(result.reason, 'merge-review-required'); assert.ok(result.mergeId)
 const task = await new CollaborationTaskStore(Path.join(f.root, 'collaboration-tasks')).read(result.mergeId)
 assert.equal(task.state, 'conflicted')
 assert.equal(await f.repo.head(), before); assert.equal(f.files.get('main.tex').toString(), 'local\n')
 assert.equal(await f.service.runDue(), null)
})
test('lost push response pauses then read-only reconciliation confirms exactly one commit', async t => {
 const f = await fixture(t), candidate = await f.local(); await f.configure({ pull: false, push: true })
 const push = f.service.push
 f.service.push = async (...args) => { await push(...args); throw Error('response lost') }
 const failed = await f.service.runDue()
 assert.equal(failed.reason, 'outcome-unknown'); assert.ok(failed.operationId)
 assert.equal((await f.external.git.raw(['ls-remote', f.remote, 'refs/heads/main'])).split(/\s/)[0], candidate)
 assert.equal(await f.service.runDue(), null)
 const settled = await f.service.reconcile(failed.revision)
 assert.equal(settled.enabled, false); assert.equal(settled.operationId, null)
 assert.equal(await f.repo.head(), candidate)
})
test('changed remote binding pauses before discovery and stale settings cannot replace it', async t => {
 const f = await fixture(t); const first = await f.configure()
 await assert.rejects(f.service.configure({ revision: 0 }), { status: 409 })
 await f.repo.git.raw(['remote', 'set-url', 'origin', Path.join(f.root, 'other.git')])
 assert.equal((await f.service.runDue()).reason, 'target-changed')
 assert.equal((await f.service.status()).operationId, null)
})
test('revoked owner causes paused schedule without Git changes', async t => {
 const f = await fixture(t), before = await f.repo.head(); await f.configure(); f.revoke()
 assert.equal((await f.service.runDue()).reason, 'permission-revoked'); assert.equal(await f.repo.head(), before)
})

test('push transport failure requires explicit same-candidate retry, not a timer retry', async t => {
 const f = await fixture(t), candidate = await f.local(); await f.configure({ pull: false, push: true })
 const push = f.service.push; f.service.push = async () => { throw Error('connection failed before dispatch') }
 const failed = await f.service.runDue()
 assert.equal(failed.reason, 'outcome-unknown')
 assert.equal(await f.service.runDue(), null)
 await assert.rejects(f.service.reconcile(failed.revision), /does not match/)
 f.service.push = push
 const settled = await f.service.reconcile(failed.revision, true)
 assert.equal(settled.enabled, false)
 assert.equal((await f.external.git.raw(['ls-remote', f.remote, 'refs/heads/main'])).split(/\s/)[0], candidate)
})


test('failed preparation with no retained task can be reconciled without applying files', async t => {
 const f = await fixture(t), before = await f.repo.head(); await f.advance(); await f.configure()
 f.service.prepare = async () => { throw Error('failure before task persistence') }
 const failed = await f.service.runDue()
 assert.equal(failed.reason, 'outcome-unknown')
 const settled = await f.service.reconcile(failed.revision)
 assert.equal(settled.enabled, false); assert.equal(settled.operationId, null)
 assert.equal(await f.repo.head(), before); assert.equal(f.files.get('main.tex').toString(), 'base\n')
})


test('waiting sync resumes after a checkpoint without reconfiguring the schedule', async t => {
 const f = await fixture(t); let now = Date.now(); f.service.now = () => now
 f.files.set('main.tex', Buffer.from('edited\n')); await f.configure({ push: true })
 const waiting = await f.service.runDue()
 assert.equal(waiting.state, 'waiting'); assert.equal(waiting.operationId, null)
 assert.equal(await f.service.runDue(), null)
 const candidate = await f.local('edited\n'); now += 60001
 assert.equal((await f.service.runDue()).state, 'scheduled')
 assert.equal((await f.external.git.raw(['ls-remote', f.remote, 'refs/heads/main'])).split(/\s/)[0], candidate)
})
test('manual staging still pauses rather than automatically continuing', async t => {
 const f = await fixture(t)
 f.files.set('main.tex', Buffer.from('manual\n')); await writeWorktree(f.repo.directory, f.files); await f.repo.stage(['main.tex'])
 await f.configure({ push: true })
 const result = await f.service.runDue()
 assert.equal(result.state, 'paused'); assert.equal(result.reason, 'working-changes')
 assert.equal(await f.service.runDue(), null)
})
test('discovery reconciliation retains the original receipt and does not apply files', async t => {
 const f = await fixture(t), before = await f.repo.head(); await f.advance(); await f.configure()
 const discover = f.service.discover; let receipt
 f.service.discover = async (policy, run) => { receipt = run.id; await discover(policy, run); throw Error('receipt response lost') }
 const failed = await f.service.runDue(); assert.equal(failed.reason, 'outcome-unknown')
 f.service.discover = async (policy, run) => { assert.equal(run.id, receipt); return discover(policy, run) }
 const settled = await f.service.reconcile(failed.revision)
 assert.equal(settled.enabled, false); assert.equal(settled.operationId, null)
 const saved = await new CollaborationTaskStore(Path.join(f.root, 'remote-discovery', 'tasks')).read(receipt)
 assert.equal(saved.state, 'fetched'); assert.equal(saved.changes[0].change, 'advanced')
 assert.equal(await f.repo.head(), before); assert.equal(f.files.get('main.tex').toString(), 'base\n')
})
