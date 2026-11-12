import mongoose from '../infrastructure/Mongoose.mjs'

const schema = new mongoose.Schema(
  {
    _id: String,
    userId: { type: String, required: true },
    projectId: { type: String, required: true },
    workspaceIdentity: mongoose.Schema.Types.Mixed,
    plugin: mongoose.Schema.Types.Mixed,
    plugins: [mongoose.Schema.Types.Mixed],
    scope: [mongoose.Schema.Types.Mixed],
    instruction: String,
    reportOnly: Boolean,
    exportOnly: Boolean,
    issueContext: mongoose.Schema.Types.Mixed,
    trackReview: mongoose.Schema.Types.Mixed,
    recommendationCatalog: mongoose.Schema.Types.Mixed,
    referenceReview: mongoose.Schema.Types.Mixed,
    claimInput: mongoose.Schema.Types.Mixed,
    claimReview: mongoose.Schema.Types.Mixed,
    sourceSelection: mongoose.Schema.Types.Mixed,
    retryRequest: mongoose.Schema.Types.Mixed,
    status: String,
    summary: String,
    activity: [mongoose.Schema.Types.Mixed],
    documents: [mongoose.Schema.Types.Mixed],
    proposals: [mongoose.Schema.Types.Mixed],
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    deletionRetention: Boolean,
    applicationRetention: Boolean,
    applicationOutcome: mongoose.Schema.Types.Mixed,
  },
  { minimize: false }
)
schema.index({ userId: 1, projectId: 1, createdAt: -1 })
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export const WritingAssistTask = mongoose.model('WritingAssistTask', schema)
