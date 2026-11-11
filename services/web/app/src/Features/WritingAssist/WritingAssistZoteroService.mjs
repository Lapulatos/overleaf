import { AgentError } from './WritingAssistAgentService.mjs'
import Encryption from './WritingAssistEncryption.mjs'
import { validateZoteroCredentials } from './WritingAssistZoteroClient.mjs'

export function createZoteroService({
  store,
  client,
  canWrite,
  encryptionKey,
}) {
  async function authorize(userId, projectId) {
    if (!(await canWrite(userId, projectId)))
      throw new AgentError(403, 'Project write access required')
  }
  function key() {
    const value = encryptionKey()
    if (
      typeof value !== 'string' ||
      Buffer.byteLength(value) < 32 ||
      value === 'dev-key-change-me'
    )
      throw new AgentError(
        503,
        'Zotero credential storage requires a server WRITING_ASSIST_ZOTERO_ENCRYPTION_KEY of at least 32 bytes'
      )
    return value
  }
  async function credentials(userId) {
    const stored = await store.get(userId)
    if (!stored) throw new AgentError(409, 'Connect your Zotero library first')
    try {
      return {
        libraryId: stored.libraryId,
        apiKey: Encryption.decrypt(stored.encryptedApiKey, key()),
      }
    } catch (error) {
      if (error instanceof AgentError) throw error
      throw new AgentError(
        503,
        'Stored Zotero credentials cannot be opened; reconnect your library'
      )
    }
  }
  return {
    async status(userId, projectId) {
      await authorize(userId, projectId)
      const stored = await store.get(userId)
      return {
        connected: Boolean(stored),
        libraryId: stored?.libraryId || null,
      }
    },
    async connect(userId, projectId, input) {
      await authorize(userId, projectId)
      const secret = key()
      const value = validateZoteroCredentials(input)
      // Verify actual read access before replacing an existing connection.
      await client.search(value, '', 0)
      await store.set(userId, {
        libraryId: value.libraryId,
        encryptedApiKey: Encryption.encrypt(value.apiKey, secret),
        updatedAt: new Date(),
      })
      return { connected: true, libraryId: value.libraryId }
    },
    async disconnect(userId, projectId) {
      await authorize(userId, projectId)
      await store.remove(userId)
      return { connected: false, libraryId: null }
    },
    async search(userId, projectId, query, start) {
      await authorize(userId, projectId)
      return client.search(await credentials(userId), query, start)
    },
    async lookup(userId, projectId, itemKey) {
      await authorize(userId, projectId)
      return client.lookup(await credentials(userId), itemKey)
    },
  }
}
