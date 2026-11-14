import mongoose from '../infrastructure/Mongoose.mjs'
const grant=new mongoose.Schema({_id:String,taskId:String,userId:String,projectId:String,tokenHash:String,references:[String],expiresAt:Date})
grant.index({expiresAt:1},{expireAfterSeconds:0})
export const TerminalAgentGrant=mongoose.model('TerminalAgentGrant',grant)
const operation=new mongoose.Schema({_id:String,grantId:String,userId:String,projectId:String,kind:String,args:mongoose.Schema.Types.Mixed,state:String,result:mongoose.Schema.Types.Mixed,error:String,createdAt:Date,expiresAt:Date})
operation.index({expiresAt:1},{expireAfterSeconds:0})
export const TerminalAgentOperation=mongoose.model('TerminalAgentOperation',operation)
const lease=new mongoose.Schema({_id:String,expiresAt:Date})
lease.index({expiresAt:1},{expireAfterSeconds:0})
export const TerminalInputLease=mongoose.model('TerminalInputLease',lease)
export async function assertManualTerminalInput(reference){if(await TerminalInputLease.exists({_id:reference,expiresAt:{$gt:new Date()}}))throw Object.assign(Error('Agent is sending input to this session. Retry in a moment.'),{status:409})}
