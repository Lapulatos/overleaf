import { WritingAssistGoal as Model } from '../../models/WritingAssistGoal.mjs'
export const goalStore={
 find:(userId,projectId,conversationId)=>Model.findOne({userId,projectId,conversationId}).lean(),
 findId:id=>Model.findById(id).lean(),
 async create(value){try{return (await Model.create(value)).toObject()}catch(e){if(e.code===11000)return null;throw e}},
 async replace(id,revision,value){return Model.findOneAndUpdate({_id:id,revision,status:{$in:['completed','cancelled']}},{$set:value,$inc:{revision:1}},{new:true}).lean()},
 async action(id,revision,fields){return Model.findOneAndUpdate({_id:id,revision},{$set:{...fields,updatedAt:new Date(),leaseToken:null,leaseUntil:null},$inc:{revision:1}},{new:true}).lean()},
 async claim(token){return Model.findOneAndUpdate({status:{$in:['active','waiting_review']},$or:[{leaseUntil:null},{leaseUntil:{$lt:new Date()}}]},{$set:{leaseToken:token,leaseUntil:new Date(Date.now()+90000)}},{new:true,sort:{updatedAt:1}}).lean()},
 async save(goal,fields){return Model.findOneAndUpdate({_id:goal._id,leaseToken:goal.leaseToken,revision:goal.revision},{$set:{...fields,updatedAt:new Date()},$inc:{revision:1}},{new:true}).lean()},
 async active(goal){return Boolean(await Model.exists({_id:goal._id,leaseToken:goal.leaseToken,revision:goal.revision,status:'active'}))},
 async renew(id,token){await Model.updateOne({_id:id,leaseToken:token},{$set:{leaseUntil:new Date(Date.now()+90000)}})},
 async release(id,token){await Model.updateOne({_id:id,leaseToken:token},{$set:{leaseToken:null,leaseUntil:new Date(Date.now()+3000),updatedAt:new Date()}})},
}
