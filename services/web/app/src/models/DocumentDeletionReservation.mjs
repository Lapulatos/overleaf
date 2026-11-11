import mongoose from '../infrastructure/Mongoose.mjs'

// No TTL: expiry could allow a delayed deletion to race a newly editable doc.
// Stores identity/hash only, never manuscript contents or credentials.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  projectId: { type: String, required: true, index: true },
  docId: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  taskId: { type: String, required: true },
  proposalId: { type: String, required: true },
  operationId: { type: String, required: true },
  expectedVersion: { type: Number, required: true },
  baseHash: { type: String, required: true },
  path: { type: String, required: true },
  state: { type: String, enum: ['preparing', 'fenced', 'committing', 'committed'], required: true },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
})
export const DocumentDeletionReservation = mongoose.model(
  'DocumentDeletionReservation', schema
)
