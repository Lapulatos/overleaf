import mongoose from '../infrastructure/Mongoose.mjs'
const schema = new mongoose.Schema({
  _id: String, userId: {type:String,required:true}, projectId: {type:String,required:true},
  taskId: String, review: mongoose.Schema.Types.Mixed,
  resolutions: {type:mongoose.Schema.Types.Mixed,default:{}},
  createdAt: {type:Date,default:Date.now},
}, {minimize:false})
schema.index({userId:1,projectId:1,createdAt:-1})
export const TrackCheckReport = mongoose.model('TrackCheckReport',schema)
