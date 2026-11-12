import test from 'node:test'
import assert from 'node:assert/strict'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, readFile, writeFile, access } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
import { writeWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
import { inspectAutoCommitGit, executeAutoCommitGit } from '../../app/src/Features/NativeGit/AutoCommitGit.mjs'
const files = text => new Map([['main.tex', Buffer.from(text)]])
async function fixture(t) {
  const directory = await mkdtemp(Path.join(tmpdir(), 'auto-commit-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const repo = await GitRepository.init(directory)
  await repo.author('Human', 'human@example.test')
  await writeWorktree(directory, files('base')); await repo.stage(['main.tex']); await repo.commit('base')
  const expected = await inspectAutoCommitGit(repo), records = []
  const options = { repo, expected, files: files('saved snapshot'), operationId: randomUUID(),
    guard: async () => {}, journal: async record => records.push(record) }
  return { repo, options, records, directory }
}
test('native commit uses saved snapshot, service author and leaves live worktree untouched', async t => {
  const f = await fixture(t)
  await writeFile(Path.join(f.directory, 'main.tex'), 'newer working bytes')
  const result = await executeAutoCommitGit(f.options)
  assert.equal(await f.repo.head(), result.commit)
  assert.equal(await f.repo.git.show(['HEAD:main.tex']), 'saved snapshot')
  assert.equal(await readFile(Path.join(f.directory, 'main.tex'), 'utf8'), 'newer working bytes')
  assert.equal((await f.repo.git.raw(['log', '-1', '--format=%an <%ae>'])).trim(), 'Overleaf Auto Commit <auto-commit@overleaf.invalid>')
  assert.deepEqual(f.records.map(r => r.state), ['starting', 'prepared', 'published', 'complete'])
  assert.equal((await inspectAutoCommitGit(f.repo)).manualIndex, false)
})
test('manual staging after inspection is retained and auto commit refused', async t => {
  const f = await fixture(t)
  await writeFile(Path.join(f.directory, 'main.tex'), 'manual staged')
  await f.repo.stage(['main.tex'])
  const index = await readFile(Path.join(f.directory, '.git/index'))
  await assert.rejects(executeAutoCommitGit(f.options), { status: 409 })
  assert.equal(await f.repo.head(), f.options.expected.head)
  assert.deepEqual(await readFile(Path.join(f.directory, '.git/index')), index)
  assert.equal(await f.repo.git.show([':main.tex']), 'manual staged')
})
test('document version guard failure does not publish prepared candidate', async t => {
  const f = await fixture(t); let calls = 0
  f.options.guard = async () => { if (++calls === 2) throw Error('document version advanced') }
  await assert.rejects(executeAutoCommitGit(f.options), /document version advanced/)
  assert.equal(await f.repo.head(), f.options.expected.head)
  assert.equal((await inspectAutoCommitGit(f.repo)).indexFingerprint, f.options.expected.indexFingerprint)
  await assert.rejects(access(Path.join(f.directory, '.git/index.lock')), { code: 'ENOENT' })
})
test('ref race refuses publication without replacing newer head', async t => {
  const f = await fixture(t)
  let external
  f.options.journal = async record => {
    if (record.state === 'prepared') {
      external = (await f.repo.git.raw(['commit-tree', f.options.expected.tree, '-p', f.options.expected.head, '-m', 'other commit'])).trim()
      await f.repo.git.raw(['update-ref', f.options.expected.branch, external, f.options.expected.head])
    }
  }
  await assert.rejects(executeAutoCommitGit(f.options), { status: 409 })
  assert.equal(await f.repo.head(), external)
})
test('failure after ref publication retains checkpoint and task-owned lock', async t => {
  const f = await fixture(t)
  f.options.journal = async record => { f.records.push(record); if (record.state === 'published') throw Error('journal unavailable') }
  await assert.rejects(executeAutoCommitGit(f.options), error => error.autoCommitOutcomeUnknown === true)
  assert.equal(await f.repo.head(), f.records.find(r => r.state === 'prepared').commit)
  await access(Path.join(f.directory, '.git/index.lock'))
  assert.equal((await inspectAutoCommitGit(f.repo)).indexFingerprint, f.options.expected.indexFingerprint)
  await assert.rejects(executeAutoCommitGit(f.options), { status: 409 })
})
test('unchanged snapshot creates no commit or journal', async t => {
  const f = await fixture(t); f.options.files = files('base')
  assert.equal((await executeAutoCommitGit(f.options)).unchanged, true)
  assert.equal(await f.repo.head(), f.options.expected.head); assert.deepEqual(f.records.map(r => r.state), ['starting', 'cancelled'])
})
test('native update-ref CAS rejects a competitor after final inspection', async t => {
  const f = await fixture(t), raw = f.repo.git.raw.bind(f.repo.git)
  let external
  f.repo.git.raw = async args => {
    if (args[0] === 'update-ref' && args[1] === '-m') {
      external = (await raw(['commit-tree', f.options.expected.tree, '-p', f.options.expected.head, '-m', 'racing commit'])).trim()
      await raw(['update-ref', f.options.expected.branch, external, f.options.expected.head])
    }
    return raw(args)
  }
  await assert.rejects(executeAutoCommitGit(f.options), error => error.autoCommitOutcomeUnknown === true)
  assert.equal(await f.repo.head(), external)
  assert.equal((await inspectAutoCommitGit(f.repo)).indexFingerprint, f.options.expected.indexFingerprint)
  await access(Path.join(f.directory, '.git/index.lock'))
})
test('a new lock acquired after index installation is not removed by cleanup', async t => {
  const f = await fixture(t), lockPath = Path.join(f.directory, '.git/index.lock')
  f.options.journal = async record => {
    if (record.state === 'complete') await writeFile(lockPath, 'another operation', { flag: 'wx' })
  }
  await executeAutoCommitGit(f.options)
  assert.equal(await readFile(lockPath, 'utf8'), 'another operation')
})
test('existing external index lock is preserved', async t => {
  const f = await fixture(t), lockPath = Path.join(f.directory, '.git/index.lock')
  await writeFile(lockPath, 'manual lock', { flag: 'wx' })
  await assert.rejects(executeAutoCommitGit(f.options), { status: 409 })
  assert.equal(await readFile(lockPath, 'utf8'), 'manual lock')
  assert.equal(await f.repo.head(), f.options.expected.head)
})

import { CollaborationTaskStore } from '../../app/src/Features/NativeGit/CollaborationTaskStore.mjs'
import { autoCommitJournal, inspectAutoCommitRecovery, recoverAutoCommitGit } from '../../app/src/Features/NativeGit/AutoCommitRecovery.mjs'
async function interrupted(t) {
  const f = await fixture(t)
  const store = new CollaborationTaskStore(Path.join(f.directory, '.git', 'auto-tasks'))
  const journal = autoCommitJournal({ store, workspaceId: 'workspace-a', ownerId: 'owner' })
  f.options.journal = async checkpoint => {
    if (checkpoint.state === 'published') throw Error('process interrupted after ref update')
    await journal.write(checkpoint)
  }
  await assert.rejects(executeAutoCommitGit(f.options), /process interrupted/)
  // Re-open durable store rather than retaining an in-memory checkpoint.
  const reopened = autoCommitJournal({ store: new CollaborationTaskStore(store.directory), workspaceId: 'workspace-a', ownerId: 'owner' })
  return { ...f, journal: reopened, record: await reopened.read(f.options.operationId), store }
}
test('durable recovered publication installs index, keeps newer worktree and is repeatable', async t => {
  const f = await interrupted(t)
  await writeFile(Path.join(f.directory, 'main.tex'), 'new collaborative bytes')
  const preview = await inspectAutoCommitRecovery(f.repo, f.record)
  assert.equal(preview.action, 'install-index')
  const record = await recoverAutoCommitGit({ repo: f.repo, record: f.record, fingerprint: preview.fingerprint, guard: async () => {}, journal: f.journal.write })
  assert.equal(record.state, 'complete')
  assert.equal((await inspectAutoCommitGit(f.repo)).manualIndex, false)
  assert.equal(await readFile(Path.join(f.directory, 'main.tex'), 'utf8'), 'new collaborative bytes')
  const next = await inspectAutoCommitRecovery(f.repo, record)
  const again = await recoverAutoCommitGit({ repo: f.repo, record, fingerprint: next.fingerprint, guard: async () => {}, journal: f.journal.write })
  assert.equal(again.revision, record.revision)
})
test('recovery refuses substituted lock and leaves foreign contents untouched', async t => {
  const f = await interrupted(t)
  const preview = await inspectAutoCommitRecovery(f.repo, f.record)
  await writeFile(Path.join(f.directory, '.git/index.lock'), 'foreign lock contents')
  assert.equal((await inspectAutoCommitRecovery(f.repo, f.record)).action, null)
  await assert.rejects(recoverAutoCommitGit({ repo: f.repo, record: f.record, fingerprint: preview.fingerprint, guard: async () => {}, journal: f.journal.write }), { status: 409 })
  assert.equal(await readFile(Path.join(f.directory, '.git/index.lock'), 'utf8'), 'foreign lock contents')
})
test('journal refuses cross-workspace reads and candidate identity substitution', async t => {
  const f = await interrupted(t)
  const other = autoCommitJournal({ store: f.store, workspaceId: 'workspace-b', ownerId: 'owner' })
  await assert.rejects(other.read(f.record.id), { status: 409 })
  await assert.rejects(f.journal.write({ ...f.record, commit: 'a'.repeat(40) }), { status: 409 })
  assert.equal((await f.journal.read(f.record.id)).commit, f.record.commit)
})
test('unpublished candidate cancellation leaves branch and index unchanged', async t => {
  const f = await fixture(t)
  const journal = autoCommitJournal({ store: new CollaborationTaskStore(Path.join(f.directory, '.git', 'tasks')), workspaceId: 'a', ownerId: 'owner' })
  f.options.journal = async checkpoint => { await journal.write(checkpoint); throw Error('stop before publication') }
  await assert.rejects(executeAutoCommitGit(f.options), /stop before publication/)
  const record = await journal.read(f.options.operationId)
  const preview = await inspectAutoCommitRecovery(f.repo, record)
  assert.equal(preview.action, 'cancel')
  const recovered = await recoverAutoCommitGit({ repo: f.repo, record, fingerprint: preview.fingerprint, guard: async () => {}, journal: journal.write })
  assert.equal(recovered.state, 'cancelled')
  assert.equal(await f.repo.head(), f.options.expected.head)
  assert.equal((await inspectAutoCommitGit(f.repo)).indexFingerprint, f.options.expected.indexFingerprint)
})
test('publication recovery refuses a newer head', async t => {
  const f = await interrupted(t)
  const newer = (await f.repo.git.raw(['commit-tree', f.record.tree, '-p', f.record.commit, '-m', 'later head'])).trim()
  await f.repo.git.raw(['update-ref', f.record.branch, newer, f.record.commit])
  const preview = await inspectAutoCommitRecovery(f.repo, f.record)
  assert.equal(preview.action, null)
  await assert.rejects(recoverAutoCommitGit({ repo: f.repo, record: f.record, fingerprint: preview.fingerprint, guard: async () => {}, journal: f.journal.write }), { status: 409 })
  assert.equal(await f.repo.head(), newer)
})
test('terminal journal states cannot authorize index mutation again', async t => {
  const f = await interrupted(t)
  assert.equal((await inspectAutoCommitRecovery(f.repo, { ...f.record, state: 'cancelled' })).action, null)
  assert.equal((await inspectAutoCommitRecovery(f.repo, { ...f.record, state: 'complete' })).action, null)
  await access(Path.join(f.directory, '.git/index.lock'))
})

import { autoCommitScheduleId, settleAutoCommitSchedule } from '../../app/src/Features/NativeGit/AutoCommitSchedule.mjs'
test('real persisted Git recovery settles exact schedule and remains disabled after reload', async t => {
  const f = await interrupted(t)
  const schedule = { id: autoCommitScheduleId, kind: 'auto-commit-schedule', ownerId: 'owner', revision: 4,
    enabled: true, state: 'paused', operationId: f.record.operationId, intervalMs: 60000, nextAt: 0 }
  await f.store.write(schedule)
  const settle = { store: f.store, withLock: fn => fn(), authorize: async () => {},
    readOutcome: f.journal.read, workspaceId: 'workspace-a', ownerId: 'owner', operationId: f.record.operationId, revision: 4 }
  await assert.rejects(settleAutoCommitSchedule(settle), { status: 409 })
  const preview = await inspectAutoCommitRecovery(f.repo, f.record)
  await recoverAutoCommitGit({ repo: f.repo, record: f.record, fingerprint: preview.fingerprint, guard: async () => {}, journal: f.journal.write })
  await settleAutoCommitSchedule(settle)
  const reloaded = await new CollaborationTaskStore(f.store.directory).read(autoCommitScheduleId)
  assert.equal(reloaded.enabled, false); assert.equal(reloaded.operationId, null)
  assert.equal(reloaded.lastSettlement.commit, await f.repo.head())
  assert.equal((await inspectAutoCommitGit(f.repo)).manualIndex, false)
  assert.equal((await settleAutoCommitSchedule(settle)).revision, reloaded.revision)
})

import { spawn } from 'node:child_process'
import { once } from 'node:events'
test('SIGKILL after shared lock acquisition recovers persisted startup ownership', { timeout: 20000 }, async t => {
  const f = await fixture(t)
  const moduleUrl = name => new URL(`../../app/src/Features/NativeGit/${name}.mjs`, import.meta.url).href
  const storePath = Path.join(f.directory, '.git', 'startup-tasks')
  const source = `
    import { GitRepository } from ${JSON.stringify(moduleUrl('GitRepository'))};
    import { executeAutoCommitGit, inspectAutoCommitGit } from ${JSON.stringify(moduleUrl('AutoCommitGit'))};
    import { autoCommitJournal } from ${JSON.stringify(moduleUrl('AutoCommitRecovery'))};
    import { CollaborationTaskStore } from ${JSON.stringify(moduleUrl('CollaborationTaskStore'))};
    const repo = new GitRepository(${JSON.stringify(f.directory)});
    const journal = autoCommitJournal({ store: new CollaborationTaskStore(${JSON.stringify(storePath)}), workspaceId: 'a', ownerId: 'owner' });
    await executeAutoCommitGit({ repo, expected: await inspectAutoCommitGit(repo),
      files: new Map([['main.tex', Buffer.from('candidate')]]), operationId: ${JSON.stringify(f.options.operationId)},
      journal: journal.write, guard: async () => {
        process.send('lock-acquired');
        setInterval(() => {}, 1000);
        await new Promise(() => {});
      } });
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
  let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes })
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') })
  const exit = once(child, 'exit')
  const handshake = await Promise.race([once(child, 'message'), exit.then(() => { throw Error(`Child exited before lock acquisition: ${stderr}`) })])
  assert.equal(handshake[0], 'lock-acquired')
  child.kill('SIGKILL')
  assert.deepEqual(await exit, [null, 'SIGKILL'])
  const journal = autoCommitJournal({ store: new CollaborationTaskStore(storePath), workspaceId: 'a', ownerId: 'owner' })
  const record = await journal.read(f.options.operationId)
  assert.equal(record.state, 'starting')
  const preview = await inspectAutoCommitRecovery(f.repo, record)
  assert.equal(preview.action, 'cancel'); assert.ok(preview.lock)
  const result = await recoverAutoCommitGit({ repo: f.repo, record, fingerprint: preview.fingerprint, guard: async () => {}, journal: journal.write })
  assert.equal(result.state, 'cancelled')
  assert.equal(await f.repo.head(), f.options.expected.head)
  assert.equal((await inspectAutoCommitGit(f.repo)).indexFingerprint, f.options.expected.indexFingerprint)
  await assert.rejects(access(Path.join(f.directory, '.git/index.lock')), { code: 'ENOENT' })
  await assert.rejects(access(Path.join(f.directory, `.git/index.auto-${f.options.operationId}`)), { code: 'ENOENT' })
})
