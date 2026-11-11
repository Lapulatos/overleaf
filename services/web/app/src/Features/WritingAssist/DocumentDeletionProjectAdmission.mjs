import { randomUUID } from 'node:crypto'
import { validateDeletionBinding, DeletionReservationError } from './DocumentDeletionReservations.mjs'

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const id = /^[a-f0-9]{24}$/
const conflict = () => new DeletionReservationError(409, 'Project deletion admission is closed or changed')

// Internal persistence only: callers authorize and claim the accepted proposal
// BEFORE admission. Tickets contain identity/hash, not manuscript contents.
// Admission and closure update the same project document atomically. No TTL.
export function createProjectDeletionAdmission({ projects, objectId }) {
  function projectKey(projectId) {
    if (typeof projectId !== 'string' || !id.test(projectId)) {
      throw new DeletionReservationError(400, 'Invalid project deletion identity')
    }
    return objectId(projectId)
  }
  async function read(projectId) {
    const project = await projects.findOne({ _id: projectKey(projectId) }, {
      projection: { documentDeletionAdmissions: 1, documentDeletionTeardown: 1 },
      readPreference: 'primary',
    })
    if (!project) throw new DeletionReservationError(404, 'Project no longer exists')
    return project
  }
  function boundTicket(ticket, expected) {
    if (!ticket || !uuid.test(ticket.operationId) ||
        Object.entries(expected).some(([key, value]) => ticket[key] !== value)) throw conflict()
    return ticket
  }
  return {
    async admit(input) {
      const expected = validateDeletionBinding(input)
      const ticket = { ...expected, operationId: randomUUID(), admittedAt: new Date() }
      const field = `documentDeletionAdmissions.${input.docId}`
      const result = await projects.updateOne({
        _id: projectKey(input.projectId), documentDeletionTeardown: { $exists: false },
        [field]: { $exists: false },
      }, { $set: { [field]: ticket } })
      if (result.modifiedCount === 1) return ticket
      const project = await read(input.projectId)
      if (project.documentDeletionTeardown) throw conflict()
      return boundTicket(project.documentDeletionAdmissions?.[input.docId], expected)
    },
    // Recovery may read a pre-existing accepted ticket after closure. This never
    // admits new work, reopens the gate, or changes the operation identity.
    async readAccepted(input, operationId) {
      const expected = validateDeletionBinding(input)
      const project = await read(input.projectId)
      const ticket = boundTicket(project.documentDeletionAdmissions?.[input.docId], expected)
      if (ticket.operationId !== operationId) throw conflict()
      return ticket
    },
    async close(projectId, actorId) {
      if (typeof actorId !== 'string' || !id.test(actorId)) {
        throw new DeletionReservationError(400, 'Invalid project removal actor')
      }
      await projects.updateOne({
        _id: projectKey(projectId), documentDeletionTeardown: { $exists: false },
      }, { $set: { documentDeletionTeardown: { operationId: randomUUID(), actorId, startedAt: new Date() } } })
      const project = await read(projectId)
      const intent = project.documentDeletionTeardown
      if (!intent || !uuid.test(intent.operationId) || intent.actorId !== actorId) throw conflict()
      return { intent, admissions: Object.values(project.documentDeletionAdmissions || {}) }
    },
    // Called only after a matching terminal reservation/task settlement is proven.
    // Closing admission does not prevent already accepted operations from settling.
    async releaseAfterSettlement(input, operationId) {
      const expected = validateDeletionBinding(input)
      if (!uuid.test(operationId)) throw conflict()
      const field = `documentDeletionAdmissions.${input.docId}`
      const query = { _id: projectKey(input.projectId), [`${field}.operationId`]: operationId }
      for (const [key, value] of Object.entries(expected)) query[`${field}.${key}`] = value
      const result = await projects.updateOne(query, { $unset: { [field]: 1 } })
      if (result.modifiedCount !== 1) throw conflict()
    },
    read,
  }
}
