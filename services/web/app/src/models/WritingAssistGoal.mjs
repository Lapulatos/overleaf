import mongoose from '../infrastructure/Mongoose.mjs'
const schema=new mongoose.Schema({_id:String,userId:String,projectId:String,conversationId:String,objective:String,elapsedMs:{type:Number,default:0},runningSince:Date,timeLimitMs:Number,baseline:[mongoose.Schema.Types.Mixed],reviewMode:{type:String,enum:['human','ai'],default:'human'},scope:[mongoose.Schema.Types.Mixed],skills:[String],images:[mongoose.Schema.Types.Mixed],model:String,effort:String,status:String,stage:String,taskId:String,workTaskId:String,steps:{type:Number,default:0},noProgress:{type:Number,default:0},next:String,reason:String,review:mongoose.Schema.Types.Mixed,recent:[mongoose.Schema.Types.Mixed],revision:{type:Number,default:0},leaseToken:String,leaseUntil:Date,createdAt:Date,updatedAt:Date})
schema.index({userId:1,projectId:1,conversationId:1},{unique:true})
schema.index({status:1,leaseUntil:1})
export const WritingAssistGoal=mongoose.model('WritingAssistGoal',schema)
