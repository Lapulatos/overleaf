import { AgentError } from './WritingAssistErrors.mjs'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

function migrationRequired() {
  return new AgentError(503, 'Task expiration migration is required before applying reviewed changes')
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
    async claimApplication(id, proposalId) {
      await assertReady()
      // Keep the full before/after snapshot before the first edit/create write.
      // Deletions use their own admission and retry protocol below.
      const result = await collection.updateOne({
        _id: id, status: 'completed', proposals: { $elemMatch: {
          id: proposalId, mode: { $ne: 'delete-document' }, status: 'pending',
        } },
      }, { $set: { 'proposals.$.status': 'applying', applicationRetention: true }, $unset: { expiresAt: 1 } })
      return result.modifiedCount === 1
    },
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
      // All proposal kinds share one TTL. A second edit/create or deletion must
      // keep the whole task alive, regardless of which operation settled first.
      await collection.updateOne({ _id: id,
        $or: [{ deletionRetention: true }, { applicationRetention: true }],
        proposals: { $not: { $elemMatch: { status: { $in: ['applying', 'uncertain', 'closed-unconfirmed'] } } } },
      }, { $set: { expiresAt: new Date(Date.now() + RETENTION_MS) }, $unset: { deletionRetention: 1, applicationRetention: 1 } })
    },
  }
}

// Explicit maintenance operation, never run automatically on a user request.
// Run with task applications disabled before deploying the acceptance path.
export async function migrateDeletionTaskRetention(collection) {
  const indexes = await (await collection.listIndexes()).toArray()
  const old = indexes.filter(index => index.expireAfterSeconds !== undefined &&
    Object.keys(index.key).length === 1 && index.key.createdAt === 1 && index.expireAfterSeconds === RETENTION_MS / 1000)
  const unexpected = indexes.filter(index => index.expireAfterSeconds !== undefined && !old.includes(index) &&
    !(Object.keys(index.key).length === 1 && index.key.expiresAt === 1 && index.expireAfterSeconds === 0))
  if (unexpected.length) throw migrationRequired()
  // Disable the known TTL monitors before rewriting retention records. Pausing
  // application servers alone does not pause MongoDB's TTL deletion thread.
  // A failed migration intentionally leaves readiness false until rerun.
  for (const index of indexes.filter(index => index.expireAfterSeconds !== undefined)) {
    await collection.dropIndex(index.name)
  }
  // Protect previously interrupted applications before assigning any TTL.
  await collection.updateMany({ proposals: { $elemMatch: { status: { $in: ['applying', 'uncertain', 'closed-unconfirmed'] } } } },
    { $set: { applicationRetention: true }, $unset: { expiresAt: 1 } })
  await collection.updateMany({ expiresAt: { $exists: false }, createdAt: { $type: 'date' }, deletionRetention: { $ne: true }, applicationRetention: { $ne: true } },
    [{ $set: { expiresAt: { $add: ['$createdAt', RETENTION_MS] } } }])
  await collection.updateMany({ $or: [{ deletionRetention: true }, { applicationRetention: true }] }, { $unset: { expiresAt: 1 } })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await createDeletionTaskRetention(collection).assertReady()
}
