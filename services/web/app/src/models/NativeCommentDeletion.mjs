import mongoose from '../infrastructure/Mongoose.mjs'

// A deletion receipt permits recovery after either downstream service fails.
// No manuscript text or comment content is retained here.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  projectId: { type: String, required: true, index: true },
  threadId: { type: String, required: true },
  docId: { type: String, required: true },
  authorId: { type: String, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
})
export const NativeCommentDeletion = mongoose.model(
  'NativeCommentDeletion',
  schema
)
