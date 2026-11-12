import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { WorkspaceStore } from '../../app/src/Features/NativeGit/WorkspaceStore.mjs'
import { ProjectWorkspace } from '../../app/src/Features/NativeGit/ProjectWorkspace.mjs'
import { writeWorktree, readWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { MergeDraftService } from '../../app/src/Features/NativeGit/MergeDraftService.mjs'

async function fixture(t, conflict = true) {
  const root = await mkdtemp(Path.join(tmpdir(), 'merge-draft-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repository = await GitRepository.init(Path.join(root, 'repo'), { worktreeRoot: Path.join(root, 'trees') }, 'main')
  await repository.author('Fixture', 'fixture@example.test')
  const files = new Map([['main.tex', Buffer.from('base\n')]])
  await writeWorktree(repository.directory, files)
  await repository.stage(['main.tex']); await repository.commit('base')
  await repository.createBranch('source')
  const source = await repository.branchWorktree('source')
  await writeWorktree(source.directory, new Map([['main.tex', Buffer.from('incoming\n')]]))
  await source.stage(['main.tex']); await source.commit('incoming')
  if (conflict) {
    files.set('main.tex', Buffer.from('local\n'))
    await writeWorktree(repository.directory, files)
    await repository.stage(['main.tex']); await repository.commit('local')
  }
  let version = 1, time = 1000
  const project = {
    read: async () => ({ files: new Map(files), folders: new Map([['', 'root-folder']]),
      entries: new Map([['main.tex', { docId: 'doc-main', version }]]) }),
    apply: async () => { throw new Error('Live project must never be written during draft preparation/resolution') },
  }
  const store = new WorkspaceStore(Path.join(root, 'binding'))
  await store.initialize({ directory: repository.directory, branch: 'main' })
  let queue = Promise.resolve()
  const withLock = action => { const result = queue.then(action); queue = result.catch(() => {}); return result }
  const workspace = new ProjectWorkspace({ repository, project, store, withLock })
  const tasks = new CollaborationTaskStore(Path.join(root, 'tasks'))
  const service = actorId => new MergeDraftService({ workspace, repository, store: tasks,
    logicalProjectId: 'project', workspaceId: 'workspace', actorId, clock: () => time, leaseMs: 100 })
  return { repository, source, files, tasks, service, workspace,
    tick: () => { time += 101 }, editUndo: () => { version += 2 } }
}

test('real Git conflicts stay in a durable isolated draft; retries reuse task and live HEAD/index/bytes remain intact', async t => {
  const f = await fixture(t), service = f.service('A'), operationId = randomUUID()
  const head = await f.repository.head(), index = await f.repository.git.raw(['write-tree'])
  const task = await service.prepare({ operationId, ref: 'source' })
  assert.equal(task.state, 'conflicted')
  assert.deepEqual(task.remainingPaths, ['main.tex'])
  assert.deepEqual(await service.prepare({ operationId, ref: 'source' }), task)
  assert.equal((await f.tasks.list()).length, 1)
  assert.equal(await f.repository.head(), head)
  assert.equal(await f.repository.git.raw(['write-tree']), index)
  assert.equal((await readWorktree(f.repository.directory)).get('main.tex').toString(), 'local\n')
  assert.deepEqual((await f.repository.status()).conflicted, [])
  assert.match((await readWorktree(task.directory)).get('main.tex').toString(), /<<<<<<< /)
  await assert.rejects(service.prepare({ operationId, ref: 'main' }), /different request/)
  await assert.rejects(f.service('B').prepare({ operationId, ref: 'source' }), /different request/)
})

test('two resolvers cannot share a lease; expiration fences stale actor and resolution only changes draft', async t => {
  const f = await fixture(t), a = f.service('A'), b = f.service('B')
  let task = await a.prepare({ operationId: randomUUID(), ref: 'source' })
  const sa = randomUUID(), sb = randomUUID()
  task = await a.claim(task.id, task.revision, sa)
  await assert.rejects(b.claim(task.id, task.revision, sb), /Another session/)
  const old = task
  f.tick()
  task = await b.claim(task.id, task.revision, sb)
  assert.equal(task.leaseGeneration, old.leaseGeneration + 1)
  const details = await b.conflict(task.id, 'main.tex')
  await assert.rejects(a.resolve(task.id, { revision: task.revision, sessionId: sa,
    generation: old.leaseGeneration, path: 'main.tex', fingerprint: details.fingerprint, choice: 'incoming' }), /lease expired/)
  task = await b.resolve(task.id, { revision: task.revision, sessionId: sb,
    generation: task.leaseGeneration, path: 'main.tex', fingerprint: details.fingerprint, choice: 'edited', text: 'resolved\n' })
  assert.equal(task.state, 'ready-to-apply')
  assert.deepEqual(task.remainingPaths, [])
  assert.equal((await readWorktree(task.directory)).get('main.tex').toString(), 'resolved\n')
  assert.equal(f.files.get('main.tex').toString(), 'local\n')
  assert.equal((await a.validateTarget(task.id)).state, 'ready-to-apply')
})

for (const change of ['edit-undo', 'source-advance', 'source-delete', 'index']) {
  test(`stale preview detects ${change} and durably preserves superseded draft`, async t => {
    const f = await fixture(t, false), service = f.service('A')
    const task = await service.prepare({ operationId: randomUUID(), ref: 'source' })
    assert.equal(task.state, 'ready-to-apply')
    if (change === 'edit-undo') f.editUndo()
    if (change === 'source-advance') {
      await writeWorktree(f.source.directory, new Map([['main.tex', Buffer.from('newer source\n')]]))
      await f.source.stage(['main.tex']); await f.source.commit('new source')
    }
    if (change === 'source-delete') await f.repository.git.raw(['update-ref', '-d', 'refs/heads/source'])
    if (change === 'index') {
      await writeWorktree(f.repository.directory, new Map([['main.tex', Buffer.from('staged edit\n')]]))
      await f.repository.stage(['main.tex'])
    }
    await assert.rejects(service.validateTarget(task.id), /stale/)
    assert.equal((await f.tasks.read(task.id)).state, 'superseded')
    assert.equal((await readWorktree(task.directory)).get('main.tex').toString(), 'incoming\n')
  })
}

test('dirty target refuses preparation; task IDs cannot escape storage and another workspace cannot read a task', async t => {
  const f = await fixture(t), service = f.service('A')
  f.files.set('main.tex', Buffer.from('unsaved paper\n'))
  await assert.rejects(service.prepare({ operationId: randomUUID(), ref: 'source' }), /target workspace changes/)
  assert.equal((await f.tasks.list()).length, 0)
  await assert.rejects(f.tasks.read('../escape'), /Invalid collaboration task identity/)
  f.files.set('main.tex', Buffer.from('local\n'))
  const task = await service.prepare({ operationId: randomUUID(), ref: 'source' })
  service.workspaceId = 'another-workspace'
  await assert.rejects(service.scoped(task.id), { status: 403 })
})

test('cancellation retains the draft, releases the lease and public listings omit filesystem/manifests', async t => {
  const f = await fixture(t), service = f.service('A'), sessionId = randomUUID()
  let task = await service.prepare({ operationId: randomUUID(), ref: 'source' })
  const directory = task.directory
  task = await service.claim(task.id, task.revision, sessionId)
  await assert.rejects(service.cancel(task.id, { revision: task.revision - 1, sessionId, generation: task.leaseGeneration }), /changed/)
  task = await service.cancel(task.id, { revision: task.revision, sessionId, generation: task.leaseGeneration })
  assert.equal(task.state, 'cancelled')
  assert.equal(task.lease, null)
  assert.equal((await readWorktree(directory)).size, 1)
  const [view] = await service.list()
  assert.equal(view.id, task.id)
  assert.equal('directory' in view, false)
  assert.equal('baseline' in view, false)
  await assert.rejects(service.claim(task.id, task.revision, sessionId), /current state/)
})

test('interrupted native resolution becomes recovery-required rather than retrying an ambiguous Git write', async t => {
  const f = await fixture(t), service = f.service('A'), sessionId = randomUUID()
  let task = await service.prepare({ operationId: randomUUID(), ref: 'source' })
  task = await service.claim(task.id, task.revision, sessionId)
  const details = await service.conflict(task.id, 'main.tex')
  const open = f.repository.openWorktree.bind(f.repository)
  f.repository.openWorktree = async dir => {
    const repo = await open(dir)
    const resolve = repo.resolveConflict.bind(repo)
    repo.resolveConflict = async (...args) => { await resolve(...args); throw new Error('injected lost acknowledgement') }
    return repo
  }
  await assert.rejects(service.resolve(task.id, { revision: task.revision, sessionId, generation: task.leaseGeneration,
    path: 'main.tex', fingerprint: details.fingerprint, choice: 'incoming' }), /injected/)
  const recovered = await f.tasks.read(task.id)
  assert.equal(recovered.state, 'recovery-required')
  assert.equal(recovered.resolvingPath, 'main.tex')
  await assert.rejects(service.claim(task.id, recovered.revision, sessionId), /current state/)
  assert.equal(f.files.get('main.tex').toString(), 'local\n')
  assert.equal((await readWorktree(task.directory)).get('main.tex').toString(), 'incoming\n')
})

async function applicationFixture(t) {
  const { MergeApplicationService } = await import('../../app/src/Features/NativeGit/MergeApplicationService.mjs')
  const f = await fixture(t, false)
  await writeWorktree(f.source.directory, new Map([['main.tex', Buffer.from('incoming\n')], ['second.tex', Buffer.from('second\n')]]))
  await f.source.stage(['second.tex']); await f.source.commit('second file')
  let epoch = 1, crashAt = null
  const preparations = []
  const drafts = f.service('A')
  drafts.readEpoch = async () => epoch
  const task = await drafts.prepare({ operationId: randomUUID(), ref: 'source' })
  const sessionId = randomUUID()
  const claimed = await drafts.claim(task.id, task.revision, sessionId)
  const read = f.workspace.project.read
  f.workspace.project.transaction = async (action, options) => {
    assert.equal(options.prepare, true)
    if (options.epoch !== epoch) throw new Error('Workspace changed before prepared admission')
    preparations.push(options.epoch)
    const result = await action({ read, assertActive: async () => {}, advanceEpoch: async () => {
      if (crashAt === 'epoch') throw new Error('injected epoch failure')
      return ++epoch
    }, apply: async (changes, expected, onStep) => {
      for (const [step, change] of changes.entries()) {
        await onStep({ phase: 'before', step, path: change.path })
        if (change.after) f.files.set(change.path, change.after)
        else f.files.delete(change.path)
        f.editUndo()
        if (crashAt === 'first-write') throw new Error('injected after document write')
        await onStep({ phase: 'after', step, path: change.path })
        if (crashAt === 'after-first' && step === 0) throw new Error('injected after checkpoint')
      }
    } })
    if (crashAt === 'final-lease') throw new Error('injected final lease check')
    return result
  }
  const application = new MergeApplicationService({ drafts, readEpoch: async () => epoch,
    advanceEpoch: async expected => {
      assert.equal(expected, epoch)
      if (crashAt === 'epoch') throw new Error('injected epoch failure')
      epoch++
    }, author: { name: 'Fixture', email: 'fixture@example.test' } })
  return { ...f, drafts, application, preparations, task: claimed,
    recovery: async () => {
      const { MergeRecoveryService } = await import('../../app/src/Features/NativeGit/MergeRecoveryService.mjs')
      return new MergeRecoveryService({ drafts, readEpoch: async () => epoch,
        advanceEpoch: async expected => { assert.equal(epoch, expected); epoch++ } })
    },
    apply: () => application.apply(task.id, { revision: claimed.revision, sessionId, generation: claimed.leaseGeneration }),
    crash: where => { crashAt = where }, advanceEpoch: () => { epoch++ }, epoch: () => epoch }
}

test('merge application journals native commit and document transfer, then clears the pending export block', async t => {
  const f = await applicationFixture(t), result = await f.apply()
  assert.equal(result.state, 'resolved')
  assert.equal(result.application.phase, 'complete')
  assert.equal(await f.repository.head(), result.resolutionCommit)
  assert.equal((await f.repository.git.raw(['write-tree'])).trim(), result.application.tree)
  assert.equal(f.files.get('main.tex').toString(), 'incoming\n')
  assert.equal(f.files.get('second.tex').toString(), 'second\n')
  assert.equal(f.epoch(), 2)
  assert.equal((await f.workspace.store.read()).mutationTaskId, undefined)
  assert.deepEqual((await f.repository.status()).files, [])
  assert.equal((await readWorktree(Path.join(result.application.directory, 'before'))).get('main.tex').toString(), 'base\n')
})

for (const where of ['first-write', 'epoch', 'final-lease']) {
  test(`application interruption at ${where} retains journal/snapshots and refuses ordinary export`, async t => {
    const f = await applicationFixture(t)
    f.crash(where)
    await assert.rejects(f.apply(), /injected/)
    const task = await f.tasks.read(f.task.id)
    assert.equal(task.state, 'recovery-required')
    assert.equal((await f.workspace.store.read()).mutationTaskId, task.id)
    await assert.rejects(f.workspace.run(() => {}), /requires recovery/)
    assert.equal((await f.workspace.inspect()).mutationTaskId, task.id)
    f.files.set('main.tex', Buffer.from('newer collaborator content'))
    await assert.rejects(f.apply(), /changed/)
    assert.equal(f.files.get('main.tex').toString(), 'newer collaborator content')
    assert.equal((await readWorktree(Path.join(task.application.directory, 'before'))).get('main.tex').toString(), 'base\n')
    assert.equal((await readWorktree(Path.join(task.application.directory, 'after'))).get('second.tex').toString(), 'second\n')
  })
}

test('epoch changed after preview prevents all document writes and ref updates', async t => {
  const f = await applicationFixture(t), head = await f.repository.head()
  f.advanceEpoch()
  await assert.rejects(f.apply(), /Workspace changed/)
  assert.equal(f.files.get('main.tex').toString(), 'base\n')
  assert.equal(f.files.has('second.tex'), false)
  assert.equal(await f.repository.head(), head)
  assert.equal((await f.workspace.store.read()).mutationTaskId, undefined)
})

test('a competing target ref update is not overwritten and the applied documents remain recoverable', async t => {
  const f = await applicationFixture(t)
  const competing = await f.source.head()
  const open = f.repository.openWorktree.bind(f.repository)
  f.repository.openWorktree = async directory => {
    const repo = await open(directory)
    if (directory === f.repository.directory) {
      const raw = repo.git.raw.bind(repo.git)
      repo.git.raw = async args => {
        if (args[0] === 'update-ref') await raw(['update-ref', 'refs/heads/main', competing])
        return raw(args)
      }
    }
    return repo
  }
  await assert.rejects(f.apply(), /cannot lock ref/)
  const task = await f.tasks.read(f.task.id)
  assert.equal(task.state, 'recovery-required')
  assert.equal(task.application.phase, 'epoch-advanced')
  assert.equal(await f.repository.head(), competing)
  assert.equal((await f.workspace.store.read()).mutationTaskId, task.id)
  assert.equal(f.files.get('second.tex').toString(), 'second\n')
})

for (const where of ['after-first', 'epoch', 'final-lease']) {
  test(`recovery resumes ${where} without a new commit or duplicate epoch and is idempotent`, async t => {
    const f = await applicationFixture(t)
    f.crash(where)
    await assert.rejects(f.apply(), /injected/)
    const stopped = await f.tasks.read(f.task.id), expectedCommit = stopped.application.commit
    f.crash(null)
    const recovery = await f.recovery(), preview = await recovery.preview(f.task.id)
    assert.equal(preview.canResume, true)
    const request = { revision: preview.task.revision, fingerprint: preview.fingerprint, mode: 'resume', operationId: randomUUID() }
    const task = await recovery.recover(f.task.id, request)
    assert.equal(task.state, 'resolved')
    assert.equal(await f.repository.head(), expectedCommit)
    assert.equal(f.epoch(), 2)
    assert.deepEqual(f.preparations, [1, where === 'final-lease' ? 2 : 1])
    assert.equal((await f.workspace.store.read()).mutationTaskId, undefined)
    assert.deepEqual(await recovery.recover(f.task.id, request), task)
    assert.equal(f.files.get('second.tex').toString(), 'second\n')
    await assert.rejects(recovery.recover(f.task.id, { ...request, mode: 'preserve-current' }), /another request/)
  })
}

test('unknown partial write cannot auto-resume; explicit preserve-current keeps later edits, index and recovery draft', async t => {
  const f = await applicationFixture(t), head = await f.repository.head()
  f.crash('first-write')
  await assert.rejects(f.apply(), /injected/)
  f.crash(null)
  f.files.set('main.tex', Buffer.from('collaborator wrote after crash'))
  const recovery = await f.recovery()
  let preview = await recovery.preview(f.task.id)
  assert.equal(preview.canResume, false)
  await assert.rejects(recovery.recover(f.task.id, { revision: preview.task.revision, fingerprint: preview.fingerprint,
    mode: 'resume', operationId: randomUUID() }), /risk overwriting/)
  preview = await recovery.preview(f.task.id)
  const index = await f.repository.git.raw(['write-tree'])
  const task = await recovery.recover(f.task.id, { revision: preview.task.revision, fingerprint: preview.fingerprint,
    mode: 'preserve-current', operationId: randomUUID() })
  assert.equal(task.state, 'cancelled')
  assert.equal(task.resolutionCommit, null)
  assert.equal(await f.repository.head(), head)
  assert.equal(await f.repository.git.raw(['write-tree']), index)
  assert.equal(f.files.get('main.tex').toString(), 'collaborator wrote after crash')
  assert.equal((await readWorktree(f.repository.directory)).get('main.tex').toString(), 'collaborator wrote after crash')
  assert.equal((await f.workspace.store.read()).mutationTaskId, undefined)
  assert.equal((await readWorktree(Path.join(task.application.directory, 'after'))).get('second.tex').toString(), 'second\n')
  assert.equal((await readWorktree(task.application.documents)).get('main.tex').toString(), 'collaborator wrote after crash')
})

test('stale recovery fingerprint and modified recovery snapshot cannot overwrite current documents', async t => {
  const f = await applicationFixture(t)
  f.crash('epoch'); await assert.rejects(f.apply(), /injected/); f.crash(null)
  const recovery = await f.recovery(), preview = await recovery.preview(f.task.id)
  f.editUndo()
  await assert.rejects(recovery.recover(f.task.id, { revision: preview.task.revision, fingerprint: preview.fingerprint,
    mode: 'preserve-current', operationId: randomUUID() }), /preview is stale/)
  const fresh = await recovery.preview(f.task.id)
  assert.equal(fresh.canResume, false)
  assert.equal(f.files.get('main.tex').toString(), 'incoming\n')
})

test('recovery rejects corrupt after snapshot even when documents match the saved checkpoint', async t => {
  const f = await applicationFixture(t)
  f.crash('epoch'); await assert.rejects(f.apply(), /injected/); f.crash(null)
  const recovery = await f.recovery(), preview = await recovery.preview(f.task.id)
  const task = await f.tasks.read(f.task.id)
  await writeWorktree(Path.join(task.application.directory, 'after'), new Map([['main.tex', Buffer.from('tampered')]]))
  await assert.rejects(recovery.recover(f.task.id, { revision: preview.task.revision, fingerprint: preview.fingerprint,
    mode: 'resume', operationId: randomUUID() }), /snapshot changed/)
  assert.equal(f.files.get('main.tex').toString(), 'incoming\n')
  assert.equal((await f.workspace.store.read()).mutationTaskId, task.id)
})

for (const newerEdit of [false, true]) {
 test(`session recovery linked to interrupted merge preserves checkpoint checks (newer edit: ${newerEdit})`, async t => {
  const { pendingMergeForSessionRecovery, linkSessionRecoveryToMerge } = await import('../../app/src/Features/NativeGit/MergeSessionRecovery.mjs')
  const f=await applicationFixture(t)
  f.crash('final-lease');await assert.rejects(f.apply(),/injected/);f.crash(null)
  const stopped=await f.tasks.read(f.task.id)
  const binding=await f.workspace.store.read()
  const task=await pendingMergeForSessionRecovery(f.tasks,binding,stopped.workspaceId,stopped.logicalProjectId)
  await assert.rejects(pendingMergeForSessionRecovery(f.tasks,binding,'wrong-workspace',stopped.logicalProjectId),/ownership/)
  f.advanceEpoch()
  const recovery=await f.recovery()
  assert.equal((await recovery.preview(f.task.id)).canResume,false)
  const sessionRecovery={id:randomUUID(),epoch:2,nextEpoch:3}
  await linkSessionRecoveryToMerge(f.tasks,task,sessionRecovery)
  const linked=await f.tasks.read(f.task.id)
  assert.equal(linked.workspaceEpoch,task.workspaceEpoch)
  assert.deepEqual(linked.application,task.application)
  await linkSessionRecoveryToMerge(f.tasks,linked,sessionRecovery)
  assert.equal((await f.tasks.read(f.task.id)).revision,linked.revision)
  if(newerEdit){f.files.set('main.tex',Buffer.from('newer collaborator text'));f.editUndo()}
  const preview=await recovery.preview(f.task.id)
  assert.equal(preview.canResume,!newerEdit)
  const request={revision:preview.task.revision,fingerprint:preview.fingerprint,mode:'resume',operationId:randomUUID()}
  if(newerEdit){
   await assert.rejects(recovery.recover(f.task.id,request),/risk overwriting/)
   assert.equal(f.files.get('main.tex').toString(),'newer collaborator text')
  }else{
   const result=await recovery.recover(f.task.id,request)
   assert.equal(result.state,'resolved');assert.equal(f.epoch(),3)
   assert.equal(await f.repository.head(),stopped.application.commit)
  }
 })
}

test('review pins displayed source commit and rejects stale selection before exporting editor content', async t => {
 const f = await fixture(t, false), service = f.service('A'), displayed = await f.source.head()
 await f.source.git.raw(['commit', '--allow-empty', '-m', 'new remote tip'])
 const head = await f.repository.head(), index = await f.repository.git.raw(['write-tree'])
 f.files.set('main.tex', Buffer.from('unsaved-to-git editor content\n'))
 await assert.rejects(service.prepare({ operationId: randomUUID(), ref: 'source', expectedSourceOid: displayed }), /displayed remote commit changed/)
 assert.equal((await f.tasks.list()).length, 0)
 assert.equal(await f.repository.head(), head); assert.equal(await f.repository.git.raw(['write-tree']), index)
 assert.equal((await readWorktree(f.repository.directory)).get('main.tex').toString(), 'base\n')
 assert.equal(f.files.get('main.tex').toString(), 'unsaved-to-git editor content\n')
})
test('pinned source preparation binds retry identity and source advancement invalidates review', async t => {
 const f = await fixture(t, false), service = f.service('A'), expectedSourceOid = await f.source.head()
 const request = { operationId: randomUUID(), ref: 'source', expectedSourceOid }
 const task = await service.prepare(request)
 assert.equal(task.remoteOid, expectedSourceOid)
 assert.deepEqual(await service.prepare(request), task)
 await assert.rejects(service.prepare({ ...request, expectedSourceOid: await f.repository.head() }), /different request/)
 await f.source.git.raw(['commit', '--allow-empty', '-m', 'remote advanced after review'])
 await assert.rejects(service.validateTarget(task.id), /stale/)
 assert.equal((await f.tasks.read(task.id)).state, 'superseded')
})

test('same merge recovery request settles a completed transaction after release failure', async t => {
  const f = await applicationFixture(t)
  f.crash('epoch')
  await assert.rejects(f.apply(), /injected/)
  f.crash(null)
  const recovery = await f.recovery(), preview = await recovery.preview(f.task.id)
  const request = { revision: preview.task.revision, fingerprint: preview.fingerprint, mode: 'resume', operationId: randomUUID() }
  const finish = f.workspace.store.finishMutation.bind(f.workspace.store)
  f.workspace.store.finishMutation = async () => { throw Error('release unavailable') }
  await assert.rejects(recovery.recover(f.task.id, request), /release unavailable/)
  const head = await f.repository.head(), epoch = f.epoch(), preparations = f.preparations.length
  f.workspace.store.finishMutation = finish
  const result = await recovery.recover(f.task.id, request)
  assert.equal(result.state, 'resolved')
  assert.equal(await f.repository.head(), head)
  assert.equal(f.epoch(), epoch)
  assert.equal(f.preparations.length, preparations)
  assert.equal((await f.workspace.store.read()).mutationTaskId, undefined)
  assert.deepEqual(await recovery.recover(f.task.id, request), result)
})

test('insufficient transfer storage leaves document bytes, branch HEAD and task unapplied', async t => {
  const f = await applicationFixture(t)
  const head = await f.repository.head(), files = new Map(f.files)
  const original = process.env.NATIVE_GIT_MIN_FREE_BYTES
  process.env.NATIVE_GIT_MIN_FREE_BYTES = String(Number.MAX_SAFE_INTEGER)
  try {
    await assert.rejects(f.apply(), { status: 507 })
    assert.deepEqual(f.files, files)
    assert.equal(await f.repository.head(), head)
    assert.equal(f.epoch(), 1)
    assert.equal((await f.tasks.read(f.task.id)).state, 'ready-to-apply')
    assert.equal((await f.workspace.store.read()).mutationTaskId, undefined)
  } finally {
    if (original === undefined) delete process.env.NATIVE_GIT_MIN_FREE_BYTES
    else process.env.NATIVE_GIT_MIN_FREE_BYTES = original
  }
  assert.equal((await f.apply()).state, 'resolved')
})
