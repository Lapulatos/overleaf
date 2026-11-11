import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, rename, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import Path from 'node:path'
import AccessTokenEncryptor from '@overleaf/access-token-encryptor'

export function createCredentialEncryptor(key) {
  return key ? new AccessTokenEncryptor({ cipherLabel: 'nativegit-v3', cipherPasswords: { 'nativegit-v3': key } }).promises : undefined
}

// Only encrypted account credentials live here. Git owns repository state.
// The caller binds this directory to an authorized project and session user.
export class RemoteCredentials {
  constructor(directory, encryptor) {
    this.directory = directory
    this.encryptor = encryptor
  }
  file(url) { return Path.join(this.directory, createHash('sha256').update(url).digest('hex') + '.json') }
  async read(url) {
    let handle
    try {
      handle = await open(this.file(url), constants.O_RDONLY | constants.O_NOFOLLOW)
      if ((await handle.stat()).size > 65536) throw new Error('Invalid credential record')
      const record = JSON.parse(await handle.readFile('utf8'))
      if (!this.encryptor) throw Object.assign(new Error('Git credential encryption is not configured'), { status: 503 })
      const value = await this.encryptor.decryptToJson(record.encrypted)
      if (value.url !== url) throw new Error('Credential repository mismatch')
      return value
    } catch (error) { if (error.code === 'ENOENT') return null; throw error }
    finally { await handle?.close() }
  }
  async save(url, username, token) {
    if (!this.encryptor) throw Object.assign(new Error('Git credential encryption is not configured'), { status: 503 })
    if (!username || !token || /[\r\n\0:]/.test(username) || /[\r\n\0]/.test(token)) throw Object.assign(new Error('Invalid repository credentials'), { status: 400 })
    const encrypted = await this.encryptor.encryptJson({ url, username, token })
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const temporary = Path.join(this.directory, randomUUID() + '.tmp')
    try {
      const file = await open(temporary, 'wx', 0o600)
      try { await file.writeFile(JSON.stringify({ encrypted })); await file.sync() } finally { await file.close() }
      await rename(temporary, this.file(url))
    } finally { await rm(temporary, { force: true }) }
  }
  async remove(url) { await rm(this.file(url), { force: true }) }
}
