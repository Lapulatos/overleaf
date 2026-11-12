import { assertStorageCapacity } from './StorageCapacity.mjs'
import { constants } from 'node:fs'
import { mkdir, open, readdir } from 'node:fs/promises'
import Path from 'node:path'
import { createHash } from 'node:crypto'
import { readWorktree, writeWorktree } from './WorktreeFiles.mjs'

export function fileManifest(files) {
  return [...files].map(([path, bytes]) => ({ path, hash: createHash('sha256').update(bytes).digest('hex') }))
    .sort((a, b) => a.path.localeCompare(b.path))
}
async function syncDirectories(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Recovery snapshot contains a symbolic link')
    if (entry.isDirectory()) await syncDirectories(Path.join(directory, entry.name))
  }
  const handle = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW)
  try { await handle.sync() } finally { await handle.close() }
}
export async function writeRecoverySnapshot(directory, files) {
  await assertStorageCapacity(directory, [files])
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeWorktree(directory, files) // Each file is fsynced before rename.
  await syncDirectories(directory) // Persist renamed files and nested directories.
  for (const path of [Path.dirname(directory), Path.dirname(Path.dirname(directory))]) {
    const parent = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    try { await parent.sync() } finally { await parent.close() }
  }
  return fileManifest(files)
}
export async function readRecoverySnapshot(directory, expectedManifest) {
  const files = await readWorktree(directory)
  if (JSON.stringify(fileManifest(files)) !== JSON.stringify(expectedManifest)) {
    throw Object.assign(new Error('Recovery snapshot changed; retained files require inspection'), { status: 409 })
  }
  return files
}
