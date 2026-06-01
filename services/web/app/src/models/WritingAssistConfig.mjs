import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

// Per-user Writing Assist configuration, persisted so settings (provider, model,
// encrypted API key, categories, debounce/concurrency/timeout, analysis mode)
// survive a server restart. Previously this lived in an in-memory Map and was
// lost on restart. One document per user; for legacy consistency with Tag and
// WritingAssistDismissal, user_id is a plain string.
//
// The whole resolved config object is stored under `config` as a Mixed value so
// the schema does not have to track every field (the shape is owned by the
// controller's getDefaultConfig + validation). The API key inside it is stored
// AES-encrypted, exactly as before.
export const WritingAssistConfigSchema = new Schema(
  {
    user_id: { type: String, required: true, unique: true },
    config: { type: Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now },
  },
  { minimize: false }
)

export const WritingAssistConfig = mongoose.model(
  'WritingAssistConfig',
  WritingAssistConfigSchema
)
