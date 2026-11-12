import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, access, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { BackupArchive } from '../../app/src/Features/NativeGit/BackupArchive.mjs'
async function fixture(t, options) {
  const root = await mkdtemp(Path.join(tmpdir(), 'paper-backup-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const archive = new BackupArchive(Path.join(root, 'capture'), options); await archive.begin()
  return { archive, root }
}
test('only verified and revalidated captures publish a complete manifest', async t => {
  const { archive } = await fixture(t)
  await archive.add('workspaces/a/main.tex', Buffer.from('paper'))
  await archive.add('git/refs.json', Buffer.from('{}'))
  const manifest = await archive.publish({ projectId: 'fixture' }, async () => true)
  await assert.rejects(archive.add('late', Buffer.from('edit')), /already published/)
  await assert.rejects(archive.publish({}, async () => true), /already published/)
  assert.equal(manifest.entries.length, 2); assert.equal(manifest.totalBytes, 7)
  assert.deepEqual(JSON.parse(await readFile(Path.join(archive.directory, 'manifest.json'))), manifest)
})
test('changed source or corrupted capture cannot be downloaded as a complete backup', async t => {
  const { archive } = await fixture(t)
  await archive.add('main.tex', Buffer.from('paper'))
  await assert.rejects(archive.publish({}, async () => false), { status: 409 })
  await assert.rejects(access(Path.join(archive.directory, 'manifest.json')), { code: 'ENOENT' })
  await writeFile(Path.join(archive.directory, 'main.tex'), 'tampered')
  await assert.rejects(archive.publish({}, async () => true), /integrity/)
  await assert.rejects(access(Path.join(archive.directory, 'manifest.json')), { code: 'ENOENT' })
})
test('unsafe paths, duplicate entries, symlinks and size overflow fail closed', async t => {
  const { archive, root } = await fixture(t, { maxBytes: 5 })
  for (const path of ['../escape', '/absolute', 'a/../b', 'a\\b', 'manifest.json']) await assert.rejects(archive.add(path, Buffer.from('x')))
  await archive.add('safe', Buffer.from('12345'))
  await assert.rejects(archive.add('safe', Buffer.from('x')), /Duplicate/)
  await assert.rejects(archive.add('extra', Buffer.from('x')), { status: 413 })
  await symlink(Path.join(archive.directory, 'safe'), Path.join(root, 'link'))
  await assert.rejects(archive.addFile('link', Path.join(root, 'link')), /regular file/)
})
