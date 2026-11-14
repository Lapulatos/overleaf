import mongoose from '../infrastructure/Mongoose.mjs'
const schema = new mongoose.Schema({
  _id: Number, executionSettings:mongoose.Schema.Types.Mixed, nodeId: {type:String,index:true}, createdBy:String, kind:String,
  state: {type:String,default:'queued'}, tokenHash:String, systemId:String,
  startedAt:Date, finishedAt:Date, cancelRequestedAt:Date, failureReason:String, exitCode:Number,
  trace: {type:Buffer,default:()=>Buffer.alloc(0)}, offset:{type:Number,default:0},
}, {timestamps:true})
export const RuntimeTask = mongoose.model('RuntimeTask',schema)
