import mongoose from '../infrastructure/Mongoose.mjs'
const schema=new mongoose.Schema({_id:String,nodeId:String,createdBy:String,ownerName:String,name:String,state:String,directory:String},{timestamps:true})
export const RuntimeTerminal=mongoose.model('RuntimeTerminal',schema)
