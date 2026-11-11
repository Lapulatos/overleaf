const { createHash } = require('node:crypto')
const { callbackifyAll } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')
const RedisWrapper = require('@overleaf/redis-wrapper')
const { StringFileData } = require('overleaf-editor-core')
const { db, ObjectId } = require('./mongodb')
const LockManager = require('./LockManager')
const RedisManager = require('./RedisManager')
const DocumentManager = require('./DocumentManager')
const PersistenceManager = require('./PersistenceManager')
const { createDocumentDeletionFence } = require('./DocumentDeletionFence')

const client = RedisWrapper.createClient(Settings.redis.documentupdater)
const fence = createDocumentDeletionFence(client, Settings.redis.documentupdater.key_schema)
const reservations = db.documentDeletionReservations

function conflict(message) {
  return Object.assign(new Error(message), { status: 409 })
}

async function checkDeletionCache(projectId, docId, operationId, inspectOnly) {
    if (![projectId, docId].every(id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) ||
        typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
      throw conflict('Invalid deletion cleanup identity')
    }
    const lock = await LockManager.promises.getLock(docId)
    try {
      return await fence.withOperation(docId, async () => {
        const row = await reservations.findOne({ _id: `${projectId}:${docId}`, projectId, docId, operationId }, { readPreference: 'primary' })
        const project = await db.projects.findOne({ _id: new ObjectId(projectId) }, {
          projection: { [`deletionReceipts.${operationId}`]: 1, rootFolder: 1 }, readPreference: 'primary',
        })
        const receipt = project?.deletionReceipts?.[operationId]
        const containsDoc = folder => (folder.docs || []).some(doc => String(doc._id) === docId) ||
          (folder.folders || []).some(containsDoc)
        const meta = await db.docs.findOne({ _id: new ObjectId(docId), project_id: new ObjectId(projectId) }, {
          projection: { deleted: 1 }, readPreference: 'primary',
        })
        if (!row || row.source !== undefined || !['committing', 'committed'].includes(row.state) ||
            !receipt || receipt.operationId !== operationId || receipt.docId !== docId ||
            receipt.path !== row.path || receipt.userId !== row.userId ||
            receipt.expectedVersion !== row.expectedVersion || receipt.baseHash !== row.baseHash ||
            !Number.isSafeInteger(receipt.projectVersion) || receipt.projectVersion < 1 ||
            typeof receipt.projectHistoryId !== 'string' || !receipt.projectHistoryId ||
            receipt.historyConfirmed?.projectStructureVersion !== `${receipt.projectVersion}.0` ||
            receipt.historyConfirmed?.projectHistoryId !== receipt.projectHistoryId ||
            !Number.isSafeInteger(receipt.historyConfirmed?.version) || receipt.historyConfirmed.version < 0 ||
            (project.rootFolder || []).some(containsDoc) || meta?.deleted !== true) {
          throw conflict('Deletion cleanup prerequisites are not confirmed')
        }
        return false
      }, async () => {
        if (inspectOnly) {
          const cacheCleared = await fence.inspectClearedCache({ projectId, docId, operationId })
          return { projectId, docId, operationId, cacheCleared }
        }
        await fence.retainForCleanup({ projectId, docId, operationId })
        // Native cache eviction only. Never flush a deleted document back to storage.
        await RedisManager.promises.removeDocFromMemory(projectId, docId)
        // Native getDoc maps a missing version key to zero. Check raw key
        // absence atomically instead of treating that normalized value as data.
        await fence.reserveMissingCache({ projectId, docId, operationId })
        return { projectId, docId, operationId, cacheCleared: true }
      })
    } finally {
      await LockManager.promises.releaseLock(docId, lock)
    }
}

// Internal only: Web must create the reservation after explicit acceptance and
// authorization. Private routes are feature-gated. Preparation never deletes.
const DocumentDeletionManager = {
  
  async cleanup(projectId, docId, operationId) {
    return checkDeletionCache(projectId, docId, operationId, false)
  },
  async inspect(projectId, docId, operationId) {
    return checkDeletionCache(projectId, docId, operationId, true)
  },

  async prepare(projectId, docId, operationId) {
    if (![projectId, docId].every(id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) ||
        typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
      throw Object.assign(new Error('Invalid deletion identity'), { status: 400 })
    }
    const identity = { _id: `${projectId}:${docId}`, projectId, docId, operationId }
    async function read() {
      const row = await reservations.findOne(identity, { readPreference: 'primary' })
      if (!row || !['preparing', 'fenced', 'committing', 'committed'].includes(row.state)) {
        throw conflict('Deletion reservation conflicts')
      }
      return row
    }
    const lock = await LockManager.promises.getLock(docId)
    try {
      let row
      // This is a narrowly bound recovery operation, not a generic write bypass.
      // Capture the Redis generation before reading the durable receipt.
      return await fence.withOperation(docId, async () => { row = await read(); return false }, async () => {
        if (['committing', 'committed'].includes(row.state)) return row
        let snapshot
        let missingCache = false
        if (row.state === 'preparing') {
          const UpdateManager = require('./UpdateManager')
          await UpdateManager.promises.processOutstandingUpdates(projectId, docId)
          snapshot = await DocumentManager.promises.getDoc(projectId, docId)
        } else {
          // Never replay pending writes or reload document content through a fence.
          snapshot = await RedisManager.promises.getDoc(projectId, docId)
        }
        if (row.state === 'fenced' && snapshot.lines == null && (snapshot.version == null || snapshot.version === 0)) {
          const proof = await PersistenceManager.promises.getDeletionRecoverySnapshot(projectId, docId, operationId)
          if (proof?.projectId !== projectId || proof?.docId !== docId || proof?.operationId !== operationId ||
              proof?.version !== row.expectedVersion || proof?.pathname !== row.path || proof?.baseHash !== row.baseHash) {
            throw conflict('Invalid deletion recovery snapshot proof')
          }
          const current = await read()
          if (current.state !== 'fenced' ||
              ['expectedVersion', 'baseHash', 'path', 'taskId', 'proposalId', 'userId'].some(key => current[key] !== row[key])) throw conflict('Deletion recovery changed')
          await fence.reserveMissingCache({ projectId, docId, operationId })
          missingCache = true
        }
        if (!missingCache) {
          const lines = snapshot.lines == null ? null : Array.isArray(snapshot.lines)
            ? snapshot.lines : StringFileData.fromRaw(snapshot.lines).getLines()
          if (snapshot.version !== row.expectedVersion || typeof snapshot.pathname !== 'string' || snapshot.pathname.replace(/^\//, '') !== row.path ||
              !Array.isArray(lines) || !lines.every(line => typeof line === 'string') ||
              createHash('sha256').update(lines.join('\n')).digest('hex') !== row.baseHash) {
            if (row.state === 'preparing') {
              await reservations.deleteOne({ ...identity, state: 'preparing' })
            }
            throw conflict('Document changed or recovery snapshot unavailable')
          }
          if (row.state === 'preparing') {
            await DocumentManager.promises.flushDocIfLoaded(projectId, docId)
            await reservations.updateOne({ ...identity, state: 'preparing' }, {
              $set: { state: 'fenced', updatedAt: new Date() },
            })
            row = await read()
            if (['committing', 'committed'].includes(row.state)) return row
            if (row.state !== 'fenced') throw conflict('Deletion stage conflicts')
          }
          await fence.reserve({ projectId, docId, operationId,
            expectedVersion: row.expectedVersion, expectedPath: snapshot.pathname,
            serializedLines: JSON.stringify(snapshot.lines) })
        }
        await reservations.updateOne({ ...identity, state: 'fenced' }, {
          $set: { state: 'committing', updatedAt: new Date() },
        })
        row = await read()
        if (!['committing', 'committed'].includes(row.state)) throw conflict('Deletion stage conflicts')
        return row
      })
    } finally {
      await LockManager.promises.releaseLock(docId, lock)
    }
  },
}
module.exports = { ...callbackifyAll(DocumentDeletionManager), promises: DocumentDeletionManager }
