import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { assertStorageCapacity } from '../../app/src/Features/NativeGit/StorageCapacity.mjs'
import { writeWorktree, readWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
import { writeRecoverySnapshot } from '../../app/src/Features/NativeGit/RecoverySnapshots.mjs'
const files = new Map([['figures/a.pdf', Buffer.alloc(100)]])
const enough = { bsize: 4096, bavail: 10000, files: 10000, ffree: 10000 }
test('capacity uses available blocks and checks inode exhaustion and retained copies', async () => {
  for (const space of [{ ...enough, bavail: 0, bfree: 10000 }, { ...enough, ffree: 1 }]) {
    await assert.rejects(assertStorageCapacity('/fixture', [files], { inspect: async () => space, reserveBytes: 0 }), { status: 507 })
  }
  const single = await assertStorageCapacity('/fixture', [files], { inspect: async () => enough, reserveBytes: 0 })
  await assert.rejects(assertStorageCapacity('/fixture', [files, files, files], {
    inspect: async () => ({ ...enough, bavail: single.requiredBytes / enough.bsize }), reserveBytes: 0,
  }), { status: 507 })
})
test('missing snapshot directory uses existing ancestor; inspection failure fails closed', async () => {
  const seen = []
  await assertStorageCapacity('/root/new/snapshot', [files], { reserveBytes: 0, inspect: async path => {
    seen.push(path); if (path !== '/root') throw Object.assign(Error(), { code: 'ENOENT' }); return enough
  } })
  assert.deepEqual(seen, ['/root/new/snapshot', '/root/new', '/root'])
  await assert.rejects(assertStorageCapacity('/root', [files], { inspect: async () => { throw Error('unavailable') } }), /unavailable/)
})
test('low capacity refuses before deleting existing files or creating recovery destination', async t => {
  const root = await mkdtemp(Path.join(tmpdir(), 'storage-gate-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const before = new Map([['old.tex', Buffer.from('keep me')]])
  await writeWorktree(root, before)
  const original = process.env.NATIVE_GIT_MIN_FREE_BYTES
  process.env.NATIVE_GIT_MIN_FREE_BYTES = String(Number.MAX_SAFE_INTEGER)
  try {
    await assert.rejects(writeWorktree(root, files), { status: 507 })
    assert.deepEqual(await readWorktree(root), before)
    const destination = Path.join(root, 'recovery')
    await assert.rejects(writeRecoverySnapshot(destination, files), { status: 507 })
    await assert.rejects(access(destination), { code: 'ENOENT' })
  } finally {
    if (original === undefined) delete process.env.NATIVE_GIT_MIN_FREE_BYTES
    else process.env.NATIVE_GIT_MIN_FREE_BYTES = original
  }
})
