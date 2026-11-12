import Path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { readdir, lstat, rename, rm, mkdir, open } from 'node:fs/promises'
import { taskId, CollaborationTaskStore } from './CollaborationTaskStore.mjs'
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const refuse = message => Object.assign(Error(message), { status: 409 })
const DAY = 86400000
async function syncDirectory(path) { const handle = await open(path, 'r'); try { await handle.sync() } finally { await handle.close() } }

// Only unpublished, unreferenced capture directories are eligible. Completed
// backups, restore destinations and live Git objects are never GC candidates.
export async function inspectPartialBackup(root, id, references, now = Date.now()) {
  taskId(id)
  const directory = Path.join(root, 'backups', id), entries = []
  let bytes = 0, latest = 0
  async function walk(path, relative = '') {
    const stat = await lstat(path)
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw refuse('Unsupported backup entry; retain it for inspection.')
    latest = Math.max(latest, stat.mtimeMs, stat.ctimeMs)
    entries.push([relative, stat.size, stat.mtimeMs, stat.ctimeMs, stat.ino, stat.isDirectory()])
    if (entries.length > 100001) throw refuse('Backup inventory exceeds cleanup limit.')
    if (stat.isFile()) { bytes += stat.size; return }
    for (const name of (await readdir(path)).sort()) await walk(Path.join(path, name), relative ? `${relative}/${name}` : name)
  }
  await walk(directory)
  const reason = entries.some(e => e[0] === 'manifest.json') ? 'Completed backup retained' :
    references.includes(id) ? 'Referenced by a restore attempt' :
      latest > now - DAY ? 'Capture is less than 24 hours old' : undefined
  return { id, bytes, files: entries.filter(e => !e[5]).length, eligible: !reason, reason,
    fingerprint: hash({ id, entries, references: [...references].sort() }) }
}

export class BackupRetention {
  constructor(c, authorize, now = Date.now) { this.now = now; this.c = c; this.authorize = authorize; this.receipts = new CollaborationTaskStore(Path.join(c.root, 'backup-cleanups')) }
  async references() {
    // Failed and completed restores remain references too. Cleanup must never
    // infer that a failed task no longer needs its source evidence.
    return (await new CollaborationTaskStore(Path.join(this.c.root, 'backup-restores')).list()).map(t => t.backupId)
  }
  async preview() {
    await this.authorize()
    return this.c.recoveryLock(async () => {
      await this.authorize()
      const references = await this.references()
      const names = await readdir(Path.join(this.c.root, 'backups')).catch(e => { if (e.code === 'ENOENT') return []; throw e })
      return { items: await Promise.all(names.map(id => inspectPartialBackup(this.c.root, id, references, this.now()))), receipts: await this.receipts.list() }
    })
  }
  async apply(id, fingerprint) {
    await this.authorize(); taskId(id)
    return this.c.recoveryLock(async () => {
      await this.authorize()
      let receipt = (await this.receipts.list()).find(r => r.backupId === id && r.fingerprint === fingerprint)
      if (receipt?.state === 'completed') return receipt
      if (receipt && !['prepared', 'quarantined'].includes(receipt.state)) throw refuse('Cleanup receipt needs inspection.')
      const source = Path.join(this.c.root, 'backups', id)
      let destination = receipt && Path.join(this.c.root, 'backup-cleanup-quarantine', receipt.id)
      const quarantined = destination && await lstat(destination).catch(e => { if (e.code === 'ENOENT') return null; throw e })
      if (!receipt || (receipt.state === 'prepared' && !quarantined)) {
        const candidate = await inspectPartialBackup(this.c.root, id, await this.references(), this.now())
        if (!candidate.eligible || candidate.fingerprint !== fingerprint) throw refuse('Cleanup preview changed or backup is protected. Refresh the inventory.')
        receipt ||= { id: randomUUID(), revision: 1, backupId: id, fingerprint, bytes: candidate.bytes, state: 'prepared', createdAt: new Date().toISOString() }
        await this.receipts.write(receipt)
        destination = Path.join(this.c.root, 'backup-cleanup-quarantine', receipt.id)
        await mkdir(Path.dirname(destination), { recursive: true, mode: 0o700 })
        await rename(source, destination)
        await syncDirectory(Path.dirname(source))
        await syncDirectory(Path.dirname(destination))
      }
      if (quarantined?.isSymbolicLink()) throw refuse('Unexpected quarantine link; manual inspection required.')
      receipt = { ...receipt, revision: receipt.revision + 1, state: 'quarantined' }
      await this.receipts.write(receipt)
      await rm(destination, { recursive: true, force: true })
      await syncDirectory(Path.dirname(destination))
      const result = { ...receipt, revision: receipt.revision + 1, state: 'completed' }
      await this.receipts.write(result)
      return result
    })
  }
}
