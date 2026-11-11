import mongoose from '../infrastructure/Mongoose.mjs'

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  libraryId: { type: String, required: true },
  encryptedApiKey: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
})
export const WritingAssistLibrary = mongoose.model(
  'WritingAssistLibrary',
  schema
)
