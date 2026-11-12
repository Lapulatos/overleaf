import { assertStorageCapacity, storageFailure } from './StorageCapacity.mjs'
import Path from 'node:path'
import { constants } from 'node:fs'
import { open, readdir, lstat, mkdir, rename, unlink, rmdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const MAX_BYTES = 256 * 1024 * 1024
const MAX_FILES = 20000

export function projectPath(path) {
  if (typeof path !== 'string' || !path || Path.isAbsolute(path) || /[\0\r\n\\]/.test(path) ||
      path.split('/').some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git')) {
    throw new Error('Invalid project file path')
  }
  return path
}

export function validateFiles(files) {
  if (!(files instanceof Map) || files.size > MAX_FILES) throw new Error('Invalid project file collection')
  let total = 0
  const portablePaths = new Map()
  for (const [path, content] of files) {
    projectPath(path)
    if (!Buffer.isBuffer(content)) throw new Error('Project file content must be bytes')
    total += content.length
    if (total > MAX_BYTES) throw new Error('Project exceeds Git workspace size limit')
    const parts = path.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('/')
      const key = prefix.normalize('NFC').toLowerCase()
      const existing = portablePaths.get(key)
      if (existing && existing !== prefix) {
        throw Object.assign(new Error(`Conflicting project paths: ${existing} and ${prefix}. Rename one path so names differ beyond letter case or Unicode normalization before importing or applying Git changes.`), { status: 409, code: 'PROJECT_PATH_COLLISION' })
      }
      portablePaths.set(key, prefix)
    }
    for (let i = 1; i < parts.length; i++) {
      if (files.has(parts.slice(0, i).join('/'))) throw new Error('A project path is both a file and a folder')
    }
  }
  return files
}

// Preserve all bytes, including binary assets and ignored files. Git decides
// which files belong in Changes; the project adapter must not silently omit any.
export async function readWorktree(directory) {
  const files = new Map()
  let size = 0
  async function visit(relative = '') {
    for (const entry of await readdir(Path.join(directory, relative), { withFileTypes: true })) {
      if (!relative && entry.name === '.git') continue
      const path = projectPath(relative ? `${relative}/${entry.name}` : entry.name)
      if (entry.isSymbolicLink()) throw new Error(`Overleaf cannot edit a symbolic link: ${path}`)
      if (entry.isDirectory()) { await visit(path); continue }
      if (!entry.isFile()) throw new Error(`Unsupported project file: ${path}`)
      const handle = await open(Path.join(directory, path), constants.O_RDONLY | constants.O_NOFOLLOW)
      try {
        const stat = await handle.stat()
        if (!stat.isFile() || stat.size + size > MAX_BYTES || files.size >= MAX_FILES) throw new Error('Project exceeds Git workspace size limit')
        const content = await handle.readFile()
        size += content.length
        if (size > MAX_BYTES) throw new Error('Project exceeds Git workspace size limit')
        files.set(path, content)
      } finally { await handle.close() }
    }
  }
  await visit()
  return validateFiles(files)
}

export function fileChanges(before, after) {
  validateFiles(before)
  validateFiles(after)
  return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap(path => {
    const previous = before.get(path), next = after.get(path)
    if (previous && next && previous.equals(next)) return []
    return [{ path, before: previous, after: next }]
  })
}

// Caller owns the project's operation lock. This never updates the Git index,
// creates commits, changes refs or touches .git metadata.
export async function writeWorktree(directory, files) {
  validateFiles(files)
  const before = await readWorktree(directory)
  const changes = fileChanges(before, files)
  const writes = new Map(changes.filter(change => change.after).map(change => [change.path, change.after]))
  if (writes.size) await assertStorageCapacity(directory, [writes])
  // Remove old files first to support file <-> folder renames using Git's normal
  // working-tree semantics. Their source still exists in the live project.
  for (const change of changes) {
    if (!change.after) await unlink(Path.join(directory, change.path))
  }
  for (const change of changes) {
    if (!change.after) continue
    const destination = Path.join(directory, change.path)
    // Empty leftover directories are not Git files. Never remove a nonempty one.
    const stat = await lstat(destination).catch(error => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (stat?.isDirectory()) await removeEmptyDirectories(destination)
    await mkdir(Path.dirname(destination), { recursive: true })
    const temporary = `${destination}.native-git-${randomUUID()}`
    const handle = await open(temporary, 'wx', stat?.isFile() ? stat.mode : 0o600)
    try {
      try {
        await handle.writeFile(change.after)
        await handle.sync()
      } finally { await handle.close() }
      await rename(temporary, destination)
    } catch (error) { await unlink(temporary).catch(() => {}); throw error.code === 'ENOSPC' || error.code === 'EDQUOT' ? storageFailure() : error }
  }
}

async function removeEmptyDirectories(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) throw new Error('Cannot replace a nonempty directory')
    await removeEmptyDirectories(Path.join(directory, entry.name))
  }
  await rmdir(directory)
}
