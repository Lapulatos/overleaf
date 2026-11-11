import mongoose from '../infrastructure/Mongoose.mjs'

const turnSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true },
    instruction: { type: String, required: true },
    sourceSelection: mongoose.Schema.Types.Mixed,
    request: mongoose.Schema.Types.Mixed,
    inherited: Boolean,
    scope:[mongoose.Schema.Types.Mixed],
    plugins:[mongoose.Schema.Types.Mixed],
    status: { type: String, required: true },
    summary: { type: String, default: '' },
    activity: [mongoose.Schema.Types.Mixed],
    attachments: [
      { name: String, mime: String, width: Number, height: Number, _id: false },
    ],
    proposals: [{ path: String, status: String, _id: false }],
    createdAt: { type: Date, required: true },
  },
  { _id: false }
)
const schema = new mongoose.Schema({
  _id: String,
  userId: { type: String, required: true },
  projectId: { type: String, required: true },
  title: { type: String, required: true },
  parent: mongoose.Schema.Types.Mixed,
  revision: { type: Number, default: 0 },
  activeTaskId: { type: String, default: null },
  turns: [turnSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})
// Conversations contain transcript text and review status, not document snapshots
// or API credentials. They remain available when short-lived task records expire.
schema.index({ userId: 1, projectId: 1, updatedAt: -1 })
export const WritingAssistConversation = mongoose.model(
  'WritingAssistConversation',
  schema
)
