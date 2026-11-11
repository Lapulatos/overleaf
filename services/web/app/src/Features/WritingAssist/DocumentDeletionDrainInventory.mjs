import { validateDeletionBinding, DeletionReservationError } from './DocumentDeletionReservations.mjs'

// Include tickets written before a reservation existed. Never let a receipt for
// another accepted operation hide that crash gap.
export function deletionDrainInventory(projectId, receipts, tickets) {
  const rows = new Map()
  for (const receipt of receipts) {
    const binding = validateDeletionBinding(receipt)
    if (binding.projectId !== projectId || rows.has(binding.docId)) {
      throw new DeletionReservationError(409, 'Ambiguous project deletion inventory')
    }
    rows.set(binding.docId, receipt)
  }
  const seen = new Set()
  for (const ticket of tickets) {
    const binding = validateDeletionBinding(ticket)
    if (binding.projectId !== projectId || seen.has(binding.docId)) {
      throw new DeletionReservationError(409, 'Ambiguous project deletion admission')
    }
    seen.add(binding.docId)
    const receipt = rows.get(binding.docId)
    if (receipt && (receipt.operationId !== ticket.operationId ||
        Object.entries(binding).some(([key, value]) => receipt[key] !== value))) {
      throw new DeletionReservationError(409, 'Project admission and deletion receipt disagree')
    }
    if (!receipt) rows.set(binding.docId, { ...ticket, state: 'admitted' })
  }
  return [...rows.values()]
}
