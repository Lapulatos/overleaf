import {randomUUID} from 'node:crypto'
import {db} from '../../infrastructure/mongodb.mjs'
import {deadlines} from './DeadlineService.mjs'
import {refreshMetricSnapshots,pauseMetricRefresh} from './VenueMetricService.mjs'
import {refreshEvidence,refreshPrompt,parseRefreshAnalysis} from './VenueRefreshAnalysis.mjs'
const key='venue-database-refresh',sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let localRun=false
const publicJob=j=>j?{running:j.running&&j.leaseUntil>Date.now(),phase:j.running&&j.leaseUntil<=Date.now()?'interrupted':j.phase,total:j.ids?.length||0,completed:j.cursor||0,updated:j.updated||0,analyzed:j.analyzed||0,failed:j.failed||0,error:j.error||'',current:j.current||'',finished:j.finished,canResume:!!j.ids&&(j.cursor<j.ids.length||j.pending?.length>0)}:null
export async function venueRefreshStatus(){return publicJob(await db.venueSyncState.findOne({_id:key}))}
export async function pauseVenueRefresh(user){const result=await db.venueSyncState.updateOne({_id:key,owner:user,running:true},{$set:{pauseRequested:true}});if(result.matchedCount)pauseMetricRefresh();return venueRefreshStatus()}
export async function startVenueRefresh(user,projectId,options={}){
 const {agentService}=await import('../WritingAssist/WritingAssistAgentController.mjs')
 await agentService.models(user,projectId)
 await db.venueSyncState.updateOne({_id:key},{$setOnInsert:{running:false,phase:'ready'}},{upsert:true})
 const token=randomUUID(),result=await db.venueSyncState.findOneAndUpdate({_id:key,$or:[{running:false},{leaseUntil:{$lt:Date.now()}}]},{$set:{running:true,leaseUntil:Date.now()+120000,token,pauseRequested:false}},{returnDocument:'after'})
 const job=result
 if(!job)return venueRefreshStatus()
 if(job.ids&&(job.cursor<job.ids.length||job.pending?.length>0)&&job.owner!==user){await db.venueSyncState.updateOne({_id:key,token},{$set:{running:false}});throw Object.assign(Error('Only the user who started this update can resume it.'),{status:403})}
 if(localRun){await db.venueSyncState.updateOne({_id:key,token},{$set:{running:false}});throw Error('Previous update is stopping; retry shortly.')}
 localRun=true
 async function save(fields){await db.venueSyncState.updateOne({_id:key,token},{$set:{...fields,leaseUntil:Date.now()+120000}});Object.assign(job,fields)}
 async function paused(){const state=await db.venueSyncState.findOne({_id:key,token});return !state||state.pauseRequested}
 const heartbeat=setInterval(()=>void db.venueSyncState.updateOne({_id:key,token},{$set:{leaseUntil:Date.now()+120000}}).catch(()=>{}),20000)
 void (async()=>{
  if(!job.ids||(job.cursor>=job.ids.length&&!job.pending?.length)){await save({owner:user,projectId,model:options.model,effort:options.effort,phase:'catalog',cursor:0,updated:0,analyzed:0,failed:0,error:'',pending:[],taskId:null,finished:null});const catalog=await deadlines.list(true);const requested=options.venueIds?new Set(options.venueIds):null;const ids=catalog.venues.filter(v=>(!requested||requested.has(v.id))&&v.website).map(v=>v.id);if(requested&&ids.length!==requested.size)throw Error('One or more requested venues have no retrievable source.');await save({ids,catalogStale:catalog.stale});if(!options.venueIds)await refreshMetricSnapshots()}
  const catalog=await deadlines.list(),venues=new Map(catalog.venues.map(v=>[v.id,v]))
  async function analyze(){
   if(!job.pending?.length)return
   await save({phase:'ai-analysis'})
   if(!job.taskId){const task=await agentService.create(job.owner,job.projectId,refreshPrompt(job.pending),{model:job.model,effort:job.effort,reportOnly:true,includeProjectAssets:false,extraAssets:[{path:'venue-source-evidence.json',data:Buffer.from(JSON.stringify(job.pending)).toString('base64')}]});await save({taskId:task.taskId})}
   let task
   for(;;){task=await agentService.get(job.owner,job.projectId,job.taskId);if(!['running','queued'].includes(task.status))break;await sleep(2000)}
   if(task.status!=='completed')throw Error('AI analysis '+task.status+'. Resume to retry; source records were retained.')
   const entries=parseRefreshAnalysis(task.summary,job.pending)
   if(entries.length!==job.pending.length)throw Error('AI omitted a venue; resume to retry analysis.')
   for(const entry of entries)await db.venues.updateOne({_id:entry.venueId},{$set:{aiAnalysis:{...entry,taskId:job.taskId}}})
   await save({analyzed:job.analyzed+entries.length,pending:[],taskId:null})
  }
  if(job.pending?.length)await analyze()
  while(job.cursor<job.ids.length){
   if(await paused()){await save({phase:'paused'});return}
   const venue=venues.get(job.ids[job.cursor]);await save({phase:'sources',current:venue?venue.title+(venue.year?' '+venue.year:''):job.ids[job.cursor]})
   try{if(!venue)throw Error('Venue missing from catalog');const data=venue.kind==='conference'?await deadlines.tracks(venue.id,true):await deadlines.detail(venue.id,true);const evidence=refreshEvidence(venue,data);if(!evidence.evidence.length)throw Error('No attributed requirements or dates retrieved');await save({cursor:job.cursor+1,updated:job.updated+1,pending:[...(job.pending||[]),evidence]})}catch(error){await save({cursor:job.cursor+1,failed:job.failed+1,error:error.message})}
   if(await paused()){await save({phase:'paused'});return}
   if(job.pending?.length>=8)await analyze()
  }
  await analyze();await save({phase:'completed',finished:Date.now(),current:''})
 })().catch(async error=>{await save({phase:'failed',error:error.message,taskId:null})}).finally(async()=>{clearInterval(heartbeat);localRun=false;await db.venueSyncState.updateOne({_id:key,token},{$set:{running:false,leaseUntil:0}})})
 return publicJob(job)
}
