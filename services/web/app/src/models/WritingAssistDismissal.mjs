import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

// Per-user, per-project "dismiss notebook": sentences the user marked as
// not-to-be-checked. When a writing-assist check would run on a sentence whose
// normalized text matches a notebook entry FOR THE SAME PROJECT, it is skipped
// (no LLM call). Dismissals are project-scoped — dismissing in one project does
// not affect another. For legacy consistency with Tag, the ids are plain
// strings.
export const WritingAssistDismissalSchema = new Schema(
  {
    user_id: { type: String, required: true },
    project_id: { type: String, required: true },
    // The dismissed sentence, normalized (trimmed, internal whitespace
    // collapsed to single spaces) so matching is stable across edits/reflow.
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { minimize: false }
)

WritingAssistDismissalSchema.index({ user_id: 1, project_id: 1 })

export const WritingAssistDismissal = mongoose.model(
  'WritingAssistDismissal',
  WritingAssistDismissalSchema
)
