const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

function migrationRequired() {
  return Object.assign(new Error('Task expiration migration is required before reviewed deletion'), { status: 503 })
}

export function createDeletionTaskRetention(collection) {
  async function assertReady() {
    const indexes = await (await collection.listIndexes()).toArray()
    const ttl = indexes.filter(index => index.expireAfterSeconds !== undefined)
    if (ttl.length !== 1 || ttl[0].expireAfterSeconds !== 0 ||
        Object.keys(ttl[0].key).length !== 1 || ttl[0].key.expiresAt !== 1) throw migrationRequired()
  }
  return {
    assertReady,
    async claim(id, proposalId, retry = false) {
      await assertReady()
      const result = await collection.updateOne({
        _id: id, status: 'completed', proposals: { $elemMatch: {
          id: proposalId, mode: 'delete-document', status: retry ? 'uncertain' : 'pending',
        } },
      }, { $set: { 'proposals.$.status': 'applying', deletionRetention: true }, $unset: { expiresAt: 1 } })
      return result.modifiedCount === 1
    },
    async holdApplying(id, proposalId) {
      await assertReady()
      const result = await collection.updateOne({ _id: id, status: 'completed',
        proposals: { $elemMatch: { id: proposalId, mode: 'delete-document', status: 'applying' } },
      }, { $set: { deletionRetention: true }, $unset: { expiresAt: 1 } })
      return result.matchedCount === 1
    },
    async releaseCompleted(id) {
      // A concurrently accepted second deletion also keeps the whole task alive.
      await collection.updateOne({ _id: id, deletionRetention: true,
        proposals: { $not: { $elemMatch: { mode: 'delete-document', status: { $in: ['applying', 'uncertain'] } } } },
      }, { $set: { expiresAt: new Date(Date.now() + RETENTION_MS) }, $unset: { deletionRetention: 1 } })
    },
  }
}

// Explicit maintenance operation, never run automatically on a user request.
// Run with reviewed deletion disabled before deploying its acceptance path.
export async function migrateDeletionTaskRetention(collection) {
  const indexes = await (await collection.listIndexes()).toArray()
  const old = indexes.filter(index => index.expireAfterSeconds !== undefined &&
    Object.keys(index.key).length === 1 && index.key.createdAt === 1 && index.expireAfterSeconds === RETENTION_MS / 1000)
  const unexpected = indexes.filter(index => index.expireAfterSeconds !== undefined && !old.includes(index) &&
    !(Object.keys(index.key).length === 1 && index.key.expiresAt === 1 && index.expireAfterSeconds === 0))
  if (unexpected.length) throw migrationRequired()
  await collection.updateMany({ expiresAt: { $exists: false }, createdAt: { $type: 'date' }, deletionRetention: { $ne: true } },
    [{ $set: { expiresAt: { $add: ['$createdAt', RETENTION_MS] } } }])
  await collection.updateMany({ deletionRetention: true }, { $unset: { expiresAt: 1 } })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  for (const index of old) await collection.dropIndex(index.name)
  await createDeletionTaskRetention(collection).assertReady()
}
