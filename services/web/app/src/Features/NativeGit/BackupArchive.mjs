import Path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, rename, readFile, lstat } from 'node:fs/promises'
import { assertStorageCapacity } from './StorageCapacity.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const refuse = message => Object.assign(Error(message), { status: 409 })
export function backupPath(value) {
  if (typeof value !== 'string' || !value || Path.isAbsolute(value) || /[\\\0\r\n]/.test(value) || value.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Unsafe backup path')
  return value
}

// The destination is a new private directory, never an existing user archive.
// A manifest is the publication marker; callers must not offer partial captures.
export class BackupArchive {
  constructor(directory, { maxBytes = 1024 * 1024 * 1024, maxFiles = 100000 } = {}) {
    Object.assign(this, { directory: Path.resolve(directory), maxBytes, maxFiles })
    this.entries = new Map(); this.bytes = 0
  }
  async begin() {
    await mkdir(Path.dirname(this.directory), { recursive: true, mode: 0o700 })
    await mkdir(this.directory, { mode: 0o700 })
    for (const path of [Path.dirname(this.directory), Path.dirname(Path.dirname(this.directory))]) {
      const folder = await open(path, 'r'); try { await folder.sync() } finally { await folder.close() }
    }
  }
  async add(name, bytes) {
    if (this.published) throw Error('Backup is already published')
    backupPath(name)
    if (name === 'manifest.json' || this.entries.has(name)) throw Error('Duplicate or reserved backup path')
    if (!Buffer.isBuffer(bytes)) throw Error('Backup entry must be bytes')
    if (this.bytes + bytes.length > this.maxBytes || this.entries.size >= this.maxFiles) throw Object.assign(Error('Backup exceeds configured export size limit'), { status: 413 })
    await assertStorageCapacity(this.directory, [new Map([[name, bytes]])])
    const destination = Path.join(this.directory, name)
    await mkdir(Path.dirname(destination), { recursive: true, mode: 0o700 })
    const handle = await open(destination, 'wx', 0o600)
    try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
    this.entries.set(name, { path: name, bytes: bytes.length, sha256: digest(bytes) }); this.bytes += bytes.length
  }
  async addFile(name, source) {
    const stat = await lstat(source)
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Backup source must be a regular file')
    if (stat.size + this.bytes > this.maxBytes) throw Object.assign(Error('Backup exceeds configured export size limit'), { status: 413 })
    // Opening without following links prevents a concurrent symlink replacement.
    const { constants } = await import('node:fs')
    const handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const current = await handle.stat()
      if (!current.isFile() || current.size + this.bytes > this.maxBytes) throw Error('Backup source changed during capture')
      await this.add(name, await handle.readFile())
    } finally { await handle.close() }
  }
  async publish(metadata, revalidate) {
    if (this.published) throw Error('Backup is already published')
    if (!await revalidate()) throw refuse('Project changed during backup capture. No completed backup was published; retry after collaborators finish saving.')
    for (const entry of this.entries.values()) {
      const bytes = await readFile(Path.join(this.directory, entry.path))
      if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) throw Error('Backup entry failed integrity verification')
    }
    const directories = new Set([this.directory])
    for (const entry of this.entries.values()) {
      let directory = Path.dirname(Path.join(this.directory, entry.path))
      while (directory !== this.directory) { directories.add(directory); directory = Path.dirname(directory) }
    }
    for (const directory of [...directories].sort((a,b) => b.length - a.length)) {
      const folder = await open(directory, 'r')
      try { await folder.sync() } finally { await folder.close() }
    }
    const manifest = { ...metadata, format: 'overleaf-git-collaboration-backup', version: 1,
       capturedAt: new Date().toISOString(), totalBytes: this.bytes,
      entries: [...this.entries.values()].sort((a,b) => a.path.localeCompare(b.path)) }
    const temporary = Path.join(this.directory, `${randomUUID()}.manifest.tmp`)
    const handle = await open(temporary, 'wx', 0o600)
    try { await handle.writeFile(JSON.stringify(manifest)); await handle.sync() } finally { await handle.close() }
    await rename(temporary, Path.join(this.directory, 'manifest.json'))
    const folder = await open(this.directory, 'r')
    try { await folder.sync() } finally { await folder.close() }
    this.published = true
    return manifest
  }
}
