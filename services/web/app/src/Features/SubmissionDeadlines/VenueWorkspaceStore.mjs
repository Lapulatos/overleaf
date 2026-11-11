// Private durable data. Every lookup is scoped to both user and project; no TTL.
export function createVenueWorkspaceStore(collections){
 const key=(user,project)=>`${user}:${project}`
 return {
  async load(user,project){return (await collections()).workspaces.findOne({_id:key(user,project)})},
  async save(user,project,patch){await (await collections()).workspaces.updateOne({_id:key(user,project)},{$set:{...patch,userId:user,projectId:project,updatedAt:Date.now()}},{upsert:true})},
  async recommendation(user,project,taskId){return (await collections()).recommendations.findOne({_id:`${key(user,project)}:${taskId}`})},
  async archive(user,project,task,result,scope){const c=await collections();const snapshot={task:{taskId:task.taskId,status:task.status,instruction:task.instruction,summary:task.summary,output:task.output,activity:task.activity||[],proposals:[]},result,savedAt:Date.now()};await c.recommendations.updateOne({_id:`${key(user,project)}:${task.taskId}`},{$set:{...snapshot,userId:user,projectId:project}},{upsert:true});if(!scope){const patch={recommendation:{taskId:task.taskId,result,savedAt:snapshot.savedAt}};if(result.planning){const previous=await c.workspaces.findOne({_id:key(user,project)});patch.plan={...(previous?.plan||{reviews:{}}),...result.planning,...(result.planning.gapDays!==undefined?{gap:result.planning.gapDays}:{})}}await c.workspaces.updateOne({_id:key(user,project)},{$set:{...patch,userId:user,projectId:project,updatedAt:Date.now()}},{upsert:true})}return snapshot},
 }
}
export const venueWorkspaceStore=createVenueWorkspaceStore(async()=>{const {getCollectionInternal}=await import('../../infrastructure/mongodb.mjs');return {workspaces:await getCollectionInternal('venueUserWorkspaces'),recommendations:await getCollectionInternal('venueRecommendationSnapshots')}})
