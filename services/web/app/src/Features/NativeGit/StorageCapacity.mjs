import Path from 'node:path'
import { statfs } from 'node:fs/promises'

const DEFAULT_RESERVE = 300 * 1024 * 1024
export const storageFailure = () => Object.assign(new Error('Insufficient storage for this operation. Existing recovery snapshots are retained. Free server storage and retry.'), { status: 507, code: 'ENOSPC' })

// A conservative admission check, not a reservation: another project can consume
// space afterwards. Durable journals still handle an actual mid-write ENOSPC.
export async function assertStorageCapacity(directory, collections, { inspect = statfs, reserveBytes = Number(process.env.NATIVE_GIT_MIN_FREE_BYTES ?? DEFAULT_RESERVE) } = {}) {
  if (!Number.isSafeInteger(reserveBytes) || reserveBytes < 0) throw new Error('Invalid server storage reserve')
  let location = Path.resolve(directory), space
  for (;;) {
    try { space = await inspect(location); break }
    catch (error) {
      if (error.code !== 'ENOENT' || Path.dirname(location) === location) throw error
      location = Path.dirname(location)
    }
  }
  const block = Number(space.bsize)
  if (!Number.isSafeInteger(block) || block < 1) throw new Error('Cannot determine server storage capacity')
  let bytes = reserveBytes, nodes = 32
  for (const files of collections) {
    const folders = new Set()
    for (const [name, value] of files) {
      if (!Buffer.isBuffer(value)) throw new Error('Storage estimate requires file bytes')
      bytes += Math.max(block, Math.ceil(value.length / block) * block)
      nodes += 2 // final file and atomic replacement temporary
      const parts = name.split('/')
      for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join('/'))
    }
    bytes += (folders.size + 1) * block
    nodes += folders.size + 1
  }
  // Some filesystems do not report inode limits (files=0). Use only reported limits.
  if (Number(space.bavail) * block < bytes || (Number(space.files) > 0 && Number(space.ffree) < nodes)) throw storageFailure()
  return { requiredBytes: bytes, requiredNodes: nodes }
}
