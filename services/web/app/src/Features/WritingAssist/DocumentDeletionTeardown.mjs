import { createHash } from 'node:crypto'
import { validateProjectPath } from '@overleaf/validation-tools/project-input.mjs'

function blocked(message) {
  return Object.assign(new Error(message), { status: 409, code: 'DELETION_TEARDOWN_BLOCKED' })
}

const bindingKeys = ['projectId', 'docId', 'userId', 'taskId', 'proposalId', 'expectedVersion', 'baseHash', 'path']

// Internal project-deletion orchestration, never a public task endpoint.
// The caller must authorize deleting the WHOLE project. resumeExisting must use
// this caller's project lock and must never allocate a replacement operation.
export function createDeletionTeardown({
  withProjectLock, authorizeTeardown, closeAdmission, assertDrained, listReservations, readReservation,
  readTask, claimRetry, holdApplying, resumeExisting, resumeAdmitted, settle,
}) {
  return (projectId, actorId) => withProjectLock(projectId, async () => {
    await authorizeTeardown(projectId, actorId)
    if (closeAdmission) await closeAdmission(projectId, actorId)
    const rows = await listReservations(projectId)
    let completed = 0
    let conflicts = 0
    for (const row of rows) {
      if (row.projectId !== projectId || !['admitted', 'preparing', 'fenced', 'committing', 'committed'].includes(row.state)) {
        throw blocked('Unexpected project deletion reservation')
      }
      validateProjectPath(row.path)
      // Retired integrations may have historical receipts; never resume their work.
      if (row.source !== undefined) {
        const current = await readReservation(projectId, row.docId)
        if (row.state !== 'committed' || current?.state !== 'committed' || current.operationId !== row.operationId) {
          throw blocked('An unfinished legacy deletion requires recovery before project removal')
        }
        continue
      }
      const task = await readTask(row.taskId)
      if (row.state === 'committed' && !task) continue
      const proposal = task?.proposals?.find(item => item.id === row.proposalId)
      const allowedStatuses = row.state === 'committed' ? ['applying', 'uncertain', 'accepted'] : row.state === 'admitted' ? ['applying', 'uncertain', 'conflict'] : ['applying', 'uncertain']
      if (task?.projectId !== projectId || task.userId !== row.userId || task.status !== 'completed' ||
          proposal?.mode !== 'delete-document' || !allowedStatuses.includes(proposal.status) ||
          proposal.docId !== row.docId || proposal.path !== row.path || proposal.version !== row.expectedVersion ||
          typeof proposal.before !== 'string' || createHash('sha256').update(proposal.before).digest('hex') !== row.baseHash) {
        throw blocked('Accepted deletion snapshot is unavailable or changed')
      }
      const current = await readReservation(projectId, row.docId)
      if ((row.state !== 'admitted' && !current) ||
          (current && (current.operationId !== row.operationId || bindingKeys.some(key => current[key] !== row[key])))) {
        throw blocked('Deletion operation changed during project teardown')
      }
      if (row.state === 'admitted' && proposal.status === 'conflict') {
        if (current) throw blocked('Conflicted deletion still has an execution record')
        await authorizeTeardown(projectId, actorId)
        await settle(row.taskId, row.proposalId, 'conflict')
        conflicts++
        continue
      }
      if (row.state === 'committed' && proposal.status === 'accepted') {
        // A prior worker may have persisted task acceptance but lost the ticket
        // cleanup response. Reconcile settlement without executing deletion again.
        await authorizeTeardown(projectId, actorId)
        await settle(row.taskId, row.proposalId, 'accepted')
        continue
      }
      if (proposal.status === 'uncertain' && !(await claimRetry(row.taskId, row.proposalId))) {
        throw blocked('Deletion recovery is already being claimed')
      }
      if (!(await holdApplying(row.taskId, row.proposalId))) {
        throw blocked('Deletion recovery task cannot be retained')
      }
      await authorizeTeardown(projectId, actorId)
      const input = Object.fromEntries(bindingKeys.map(key => [key, row[key]]))
      try {
        if (row.state === 'admitted') {
          if (!resumeAdmitted) throw blocked('Admitted deletion recovery is unavailable')
          await resumeAdmitted(input, row.operationId)
        } else {
          await resumeExisting(input, row.operationId)
        }
      } catch (error) {
        if (error.code !== 'DELETION_SNAPSHOT_CONFLICT' || !['admitted', 'preparing'].includes(row.state) ||
            await readReservation(projectId, row.docId)) throw error
        await settle(row.taskId, row.proposalId, 'conflict')
        const settled = await readTask(row.taskId)
        if (settled?.proposals?.find(item => item.id === row.proposalId)?.status !== 'conflict') {
          throw blocked('Deletion conflict task is not settled')
        }
        conflicts++
        continue
      }
      const finished = await readReservation(projectId, row.docId)
      if (!finished || finished.state !== 'committed' || finished.operationId !== row.operationId ||
          bindingKeys.some(key => finished[key] !== row[key])) {
        throw blocked('Deletion recovery has no matching committed receipt')
      }
      await settle(row.taskId, row.proposalId, 'accepted')
      const settled = await readTask(row.taskId)
      if (settled?.proposals?.find(item => item.id === row.proposalId)?.status !== 'accepted') {
        throw blocked('Deletion recovery task is not settled')
      }
      completed++
    }
    if ((await listReservations(projectId)).some(row => row.projectId !== projectId || row.state !== 'committed')) {
      throw blocked('Unfinished deletion remains in project')
    }
    if (assertDrained) await assertDrained(projectId)
    return { completed, conflicts }
  })
}
