import Path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { readdir, readFile, rename, open } from 'node:fs/promises'
import { BackupArchive } from './BackupArchive.mjs'
import { verifyBackup } from './BackupDownload.mjs'
import { taskId } from './CollaborationTaskStore.mjs'
const ownerId = value => {
  if (!/^[a-f0-9]{24}$/.test(value)) throw Object.assign(Error('Invalid recovery owner'), { status: 400 })
  return value
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

// Kept outside every project directory. Paths are rooted by the authenticated
// owner, never by an owner supplied in the request or by current project access.
export class RecoveryVault {
  constructor(storageRoot, actorId) {
    this.storageRoot = storageRoot; this.actorId = ownerId(String(actorId))
    this.root = Path.join(storageRoot, 'recovery-vault', this.actorId)
  }
  async resolve(id) {
    taskId(id)
    const directory = Path.join(this.root, id)
    let manifest
    try { manifest = JSON.parse(await readFile(Path.join(directory, 'manifest.json'))) }
    catch (e) { if (e.code === 'ENOENT') throw Object.assign(Error('Retained backup not found'), { status: 404 }); throw e }
    if (manifest.id !== id || manifest.retainedBy !== this.actorId) throw Object.assign(Error('Retained backup ownership mismatch'), { status: 403 })
    return { directory, manifest }
  }
  summary(manifest) {
    return { id: manifest.id, projectId: manifest.projectId, capturedAt: manifest.sourceCapturedAt,
      retainedAt: manifest.capturedAt, workspaces: manifest.workspaces.length, bytes: manifest.totalBytes,
      url: `/git-recovery/${manifest.id}` }
  }
  async list() {
    const names = await readdir(this.root).catch(e => { if (e.code === 'ENOENT') return []; throw e })
    const result = []
    for (const id of names.filter(n => /^[a-f0-9-]{36}$/.test(n))) result.push(this.summary((await this.resolve(id)).manifest))
    return result.sort((a,b) => b.retainedAt.localeCompare(a.retainedAt))
  }
  async retain(backup, reauthorize) {
    await reauthorize(); await verifyBackup(backup)
    const sourceHash = digest(backup.manifest), id = taskId(backup.manifest.id)
    try {
      const existing = await this.resolve(id)
      if (existing.manifest.sourceManifestHash !== sourceHash) throw Object.assign(Error('Retained backup identity changed'), { status: 409 })
      await verifyBackup(existing); return this.summary(existing.manifest)
    } catch (e) { if (e.status !== 404) throw e }
    const directory = Path.join(this.root, `.pending-${randomUUID()}`), archive = new BackupArchive(directory)
    await archive.begin()
    for (const entry of backup.manifest.entries) await archive.addFile(entry.path, Path.join(backup.directory, entry.path))
    const manifest = await archive.publish({ ...backup.manifest, retainedBy: this.actorId,
      sourceCapturedAt: backup.manifest.capturedAt, sourceManifestHash: sourceHash }, async () => {
      await reauthorize()
      return backup.manifest.entries.every(entry => {
        const copied = archive.entries.get(entry.path)
        return copied?.sha256 === entry.sha256 && copied?.bytes === entry.bytes
      }) && digest(JSON.parse(await readFile(Path.join(backup.directory, 'manifest.json')))) === sourceHash
    })
    await rename(directory, Path.join(this.root, id))
    const folder = await open(this.root, 'r'); try { await folder.sync() } finally { await folder.close() }
    return this.summary(manifest)
  }
}
