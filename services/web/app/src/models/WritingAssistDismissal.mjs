import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

// Per-user "dismiss notebook": sentences the user marked as not-to-be-checked.
// When a writing-assist check would run on a sentence whose normalized text is
// in this notebook, it is skipped (no LLM call) so the same suggestion is never
// surfaced again. For legacy consistency with Tag, user_id is a plain string.
export const WritingAssistDismissalSchema = new Schema(
  {
    user_id: { type: String, required: true },
    // The dismissed sentence, normalized (trimmed, internal whitespace
    // collapsed to single spaces) so matching is stable across edits/reflow.
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { minimize: false }
)

WritingAssistDismissalSchema.index({ user_id: 1 })

export const WritingAssistDismissal = mongoose.model(
  'WritingAssistDismissal',
  WritingAssistDismissalSchema
)
