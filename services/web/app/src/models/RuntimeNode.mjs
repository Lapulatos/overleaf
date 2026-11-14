import mongoose from '../infrastructure/Mongoose.mjs'
const schema = new mongoose.Schema({
  _id: String, executionSettings:mongoose.Schema.Types.Mixed, runnerPowerState:String, runnerPowerError:String, runnerIdleSince:Date, runtimeLeaseOwner:String, runtimeLeaseUntil:Date, sshReachable:Boolean, sshLastCheckedAt:Date, sshConfigured:Boolean, sshEndpoint:mongoose.Schema.Types.Mixed, sshTunnel:String, sshTunnelPort:Number, protocol: String, runnerId: Number, systemId: String, runnerInfo: mongoose.Schema.Types.Mixed, runnerLastSeenAt: Date, name: String, createdBy: String,
  enrollmentHash: String, enrollmentExpiresAt: Date, credentialHash: String,
  identity: mongoose.Schema.Types.Mixed, resources: mongoose.Schema.Types.Mixed,
  registeredAt: Date, lastSeenAt: Date, revokedAt: Date, sequence: {type: Number, default: 0},
}, { timestamps: true })
export const RuntimeNode = mongoose.model('RuntimeNode', schema)
