import mongoose from '../infrastructure/Mongoose.mjs'
const schema=new mongoose.Schema({_id:String,userId:{type:String,required:true},command:{type:String,required:true},name:String,description:String,enabled:{type:Boolean,default:true},sourceUrl:String,commit:String,skillPath:String,files:[{path:String,content:String,_id:false}],unsupportedFiles:[String],capabilities:[String],formatVersion:Number,installedAt:{type:Date,default:Date.now}})
schema.index({userId:1,command:1},{unique:true})
export const SkillPlugin=mongoose.model('SkillPlugin',schema)
