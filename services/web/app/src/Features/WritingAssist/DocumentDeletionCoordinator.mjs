import { DeletionReservationError, validateDeletionBinding } from './DocumentDeletionReservations.mjs'

// Internal orchestration. Adapters must implement native idempotent deletion and
// inspect all commit postconditions, not merely absence from the file tree.
// Task acceptance exposes this only behind the reviewed-deletion feature gate.
export function createDocumentDeletionCoordinator({
  authorize, verifyAcceptedProposal, withProjectLock, admitDeletion, readAdmission, beginAdmittedDeletion,
  reservations, preflightHistory, prepareDocument, commitDeletion, inspectDeletion, notifyCommitted = async () => {},
}) {
  return async function execute(input, { existingOperationId, admittedOperationId } = {}) {
    if (admittedOperationId !== undefined && (existingOperationId !== undefined || !readAdmission)) {
      throw new DeletionReservationError(409, 'Admitted recovery is unavailable or ambiguous')
    }
    await authorize(input)
    await verifyAcceptedProposal(input)
    return withProjectLock(input.projectId, async () => {
      // Recheck after waiting for the lock; revocation must also stop retries.
      await authorize(input)
      // Another acceptance can finish while this caller waits for the lock.
      // Do not allocate a fresh ticket from a now-settled proposal.
      await verifyAcceptedProposal(input)
      let receipt = await reservations.find(input)
      if (existingOperationId !== undefined && (!receipt || receipt.operationId !== existingOperationId)) {
        throw new DeletionReservationError(409, 'Existing deletion operation is missing or changed')
      }
      let admission
      if (admittedOperationId !== undefined) {
        admission = await readAdmission(input, admittedOperationId)
        if (admission?.operationId !== admittedOperationId ||
            (receipt && receipt.operationId !== admittedOperationId)) {
          throw new DeletionReservationError(409, 'Admitted deletion operation changed')
        }
      } else if (!receipt && admitDeletion) {
        admission = await admitDeletion(input)
      }
      if (admission !== undefined || (!receipt && admitDeletion)) {
        const expected = validateDeletionBinding(input)
        if (!admission || typeof admission.operationId !== 'string' ||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(admission.operationId) ||
            Object.entries(expected).some(([key, value]) => admission[key] !== value)) {
          throw new DeletionReservationError(502, 'Invalid project deletion admission acknowledgement')
        }
      }
      if (!receipt || receipt.state === 'preparing') {
        // Read-only readiness checks: never migrate/resync while holding this lock.
        // Already fenced operations must recover their original history event.
        await preflightHistory(input.projectId)
      }
      if (!receipt) {
        await verifyAcceptedProposal(input)
        if (admittedOperationId !== undefined) {
          // Preflight may wait on another service. Re-read the durable ticket
          // before filling the crash gap; never call the new-admission path.
          const current = await readAdmission(input, admittedOperationId)
          const expected = validateDeletionBinding(input)
          if (current?.operationId !== admittedOperationId ||
              Object.entries(expected).some(([key, value]) => current[key] !== value)) {
            throw new DeletionReservationError(409, 'Admitted deletion changed during preflight')
          }
        }
        receipt = admission && beginAdmittedDeletion
          ? await beginAdmittedDeletion(input, admission.operationId)
          : await reservations.begin(input, admission ? { operationId: admission.operationId } : undefined)
      }
      if (receipt.state === 'committed') {
        await notifyCommitted(input, receipt)
        return receipt
      }
      if (receipt.state !== 'committing') {
        await authorize(input)
        // DU owns its lock, pending edits, persistence flush and final Redis CAS.
        // A timeout is uncertain. Never remove the reservation from this caller.
        let acknowledged
        try {
          acknowledged = await prepareDocument(input.projectId, input.docId, receipt.operationId)
        } catch (error) {
          // Only a definitive DU conflict plus absence of its reservation proves
          // that preparation aborted. Fenced operations and lost replies remain
          // recoverable using the same proposal, even if they report a conflict.
          const status = error.status ?? error.response?.status ?? error.statusCode
          if (receipt.state === 'preparing' && status === 409 &&
              !(await reservations.find(input))) {
            throw Object.assign(new DeletionReservationError(409,
              'Document changed since this suggestion. Run a new task.'),
            { code: 'DELETION_SNAPSHOT_CONFLICT' })
          }
          throw error
        }
        if (acknowledged?.projectId !== input.projectId || acknowledged?.docId !== input.docId ||
            acknowledged?.operationId !== receipt.operationId ||
            !['committing', 'committed'].includes(acknowledged?.state)) {
          throw new DeletionReservationError(502, 'Invalid deletion preparation acknowledgement')
        }
        const persisted = await reservations.read(input)
        if (persisted.operationId !== receipt.operationId ||
            !['committing', 'committed'].includes(persisted.state)) {
          throw new DeletionReservationError(409, 'Deletion preparation is not persisted')
        }
        receipt = persisted
      }
      if (receipt.state === 'committed') {
        await notifyCommitted(input, receipt)
        return receipt
      }
      await authorize(input)
      // A lost commit response is resolved by authoritative inspection on retry.
      if (await inspectDeletion(input, receipt) !== true) {
        await commitDeletion(input, receipt)
        if (await inspectDeletion(input, receipt) !== true) {
          throw new DeletionReservationError(502, 'Deletion outcome is not confirmed')
        }
      }
      const committed = await reservations.markCommitted(input, receipt.operationId)
      await notifyCommitted(input, committed)
      return committed
    })
  }
}
