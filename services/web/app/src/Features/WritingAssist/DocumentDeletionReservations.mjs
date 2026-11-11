import { randomUUID } from 'node:crypto'
import { validateProjectPath } from '@overleaf/validation-tools/project-input.mjs'

export class DeletionReservationError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const bindingKeys = [
  'projectId', 'docId', 'userId', 'taskId', 'proposalId',
  'expectedVersion', 'baseHash', 'path',
]
const states = ['preparing', 'fenced', 'committing', 'committed']

function binding(input) {
  for (const key of ['projectId', 'docId', 'userId']) {
    if (typeof input[key] !== 'string' || !/^[a-f0-9]{24}$/.test(input[key])) {
      throw new DeletionReservationError(400, 'Invalid deletion identity')
    }
  }
  if (input.source !== undefined) throw new DeletionReservationError(400, 'Invalid deletion source')
  for (const key of ['taskId', 'proposalId']) {
    if (typeof input[key] !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input[key])) {
      throw new DeletionReservationError(400, 'Invalid deletion proposal')
    }
  }
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 ||
      typeof input.baseHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.baseHash)) {
    throw new DeletionReservationError(400, 'Invalid deletion snapshot')
  }
  try {
    validateProjectPath(input.path)
  } catch {
    throw new DeletionReservationError(400, 'Invalid deletion path')
  }
  return Object.fromEntries(bindingKeys.map(key => [key, input[key]]))
}

export { binding as validateDeletionBinding }

// Internal storage primitive only. The caller must authorize acceptance and
// persist denial with markFenced before the final Redis version/content CAS.
// Only after that CAS succeeds may the coordinator call markCommitting.
// This store alone does not establish a write fence or authorize deletion.
export function createDocumentDeletionReservations(collection) {
  async function readBound(input, allowMissing = false) {
    const expected = binding(input)
    const row = await collection.findOne({
      _id: `${expected.projectId}:${expected.docId}`,
    })
    if (!row && allowMissing) return null
    if (!row || row.source !== undefined || bindingKeys.some(key => row[key] !== expected[key]) ||
        !states.includes(row.state)) {
      throw new DeletionReservationError(409, 'Deletion reservation conflicts')
    }
    return row
  }

  async function advance(input, operationId, from, to) {
    const row = await readBound(input)
    if (row.operationId !== operationId) {
      throw new DeletionReservationError(409, 'Deletion operation conflicts')
    }
    // Repeated acknowledgement may observe a later completed stage.
    if (states.indexOf(row.state) >= states.indexOf(to)) return row
    if (row.state !== from) {
      throw new DeletionReservationError(409, 'Deletion stage conflicts')
    }
    await collection.updateOne(
      { _id: row._id, operationId, state: from },
      { $set: { state: to, updatedAt: new Date() } }
    )
    const updated = await readBound(input)
    if (updated.operationId !== operationId ||
        !(states.indexOf(updated.state) >= states.indexOf(to))) {
      throw new DeletionReservationError(409, 'Deletion stage conflicts')
    }
    return updated
  }

  return {
    // A caller holding a persisted admission ticket supplies its operationId.
    // The ID alone is not authorization; callers must verify that ticket first.
    async begin(input, { operationId } = {}) {
      const expected = binding(input)
      if (operationId !== undefined && (typeof operationId !== 'string' ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId))) {
        throw new DeletionReservationError(400, 'Invalid admitted deletion operation')
      }
      const now = new Date()
      try {
        await collection.updateOne(
          { _id: `${expected.projectId}:${expected.docId}` },
          { $setOnInsert: {
            ...expected, operationId: operationId ?? randomUUID(), state: 'preparing',
            createdAt: now, updatedAt: now,
          } },
          { upsert: true }
        )
      } catch (error) {
        // Concurrent inserts converge only if the stored binding is identical.
        if (error.code !== 11000) throw error
      }
      const row = await readBound(expected)
      if (operationId !== undefined && row.operationId !== operationId) {
        throw new DeletionReservationError(409, 'Admitted deletion operation conflicts')
      }
      return row
    },
    read: input => readBound(input),
    find: input => readBound(input, true),
    markFenced: (input, operationId) => advance(input, operationId, 'preparing', 'fenced'),
    markCommitting: (input, operationId) => advance(input, operationId, 'fenced', 'committing'),
    markCommitted: (input, operationId) => advance(input, operationId, 'committing', 'committed'),
    async releasePreparing(input, operationId) {
      const expected = binding(input)
      const result = await collection.deleteOne({
        _id: `${expected.projectId}:${expected.docId}`,
        ...expected,
        operationId,
        state: 'preparing',
      })
      return result.deletedCount === 1
    },
  }
}
