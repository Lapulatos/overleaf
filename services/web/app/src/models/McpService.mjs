import mongoose from '../infrastructure/Mongoose.mjs'
const schema = new mongoose.Schema({
  _id: String,
  userId: { type: String, required: true, index: true },
  name: String,
  description: String,
  transport: String,
  url: String,
  command: String,
  args: [String],
  verifiedAt: Date,
  tools: [{ name: String, description: String, _id: false }],
  revision: { type: Number, default: 0 },
}, { timestamps: true })
export const McpService = mongoose.model('McpService', schema)
