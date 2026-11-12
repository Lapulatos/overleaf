import Path from 'node:path'
import { readFile, lstat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import archiver from 'archiver'
import { backupPath } from './BackupArchive.mjs'

export async function verifyBackup({ directory, manifest }) {
  // Check the complete archive before sending headers. Published directories are
  // immutable; only manifest-listed entries can be included in the download.
  for (const entry of manifest.entries) {
    const source = Path.join(directory, backupPath(entry.path))
    if (!(await lstat(source)).isFile()) throw Error('Invalid backup entry')
    const bytes = await readFile(source)
    if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Object.assign(Error('Backup integrity check failed. Create a new backup.'), { status: 409 })
  }
}

export async function downloadBackup(res, backup) {
  await verifyBackup(backup)
  const { directory, manifest } = backup
  res.type('application/zip')
  res.attachment(`paper-backup-${manifest.id}.zip`)
  const zip = archiver('zip', { zlib: { level: 1 } })
  zip.on('error', error => res.destroy(error))
  zip.on('warning', error => res.destroy(error))
  res.on('close', () => zip.abort())
  zip.pipe(res)
  zip.append(JSON.stringify(manifest), { name: 'manifest.json' })
  for (const entry of manifest.entries) zip.file(Path.join(directory, entry.path), { name: entry.path })
  await zip.finalize()
}
