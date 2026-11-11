import {readFileSync} from 'node:fs'
import {getCollectionInternal} from '../../infrastructure/mongodb.mjs'
import {deadlines} from './DeadlineService.mjs'
import {combineMetricSnapshots} from './MetricSnapshotPolicy.mjs'
import {metricKey,queryLetPub} from './LetPubMetrics.mjs'
const seed=JSON.parse(readFileSync(new URL('./data/venue-metrics.json',import.meta.url)))
const key=v=>v.kind+':'+metricKey(v.description)
const officialSeed=JSON.parse(readFileSync(new URL('./data/official-venue-metrics.json',import.meta.url)))
let job=null
const collection=()=>getCollectionInternal('venueMetricSnapshots')
export async function metricSnapshots(){
 const records=await (await collection()).find({}).toArray()
 const extra={...seed.entries,...Object.fromEntries(records.filter(r=>!r._id.startsWith('official:')).map(({_id,...r})=>[_id,r]))}
 const official={...officialSeed.entries}
 for(const {_id,...r}of records.filter(r=>r._id.startsWith('official:'))){const id=_id.slice(9),prior=official[id]||{};const fresh=Object.values(r.sourceEvidence||{}).flat();const labels=new Set(fresh.map(s=>s.label));official[id]={...prior,...r,sources:[...fresh,...(prior.sources||[]).filter(s=>!labels.has(s.label))]}}
 return {version:1,entries:combineMetricSnapshots(extra,official),job}
}
async function browserSource(url){
 const endpoint=process.env.OVERLEAF_AGENT_ENDPOINT
 const token=process.env.OVERLEAF_AGENT_TOKEN
 if(!endpoint||!token)throw new Error('Local LetPub browser reader is not configured')
 const response=await fetch(endpoint.replace(/\/$/,'')+'/agent/letpub-metrics-source',{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Token':token},body:JSON.stringify({url}),signal:AbortSignal.timeout(60000)})
 if(!response.ok)throw new Error('LetPub browser unavailable or login required')
 return response.json()
}
export function pauseMetricRefresh(){if(job?.running)job.pauseRequested=true}
export async function refreshMetricSnapshots(){
 if(job?.running)return job
 job={running:true,completed:0,total:0,updated:0,failed:0,started:new Date().toISOString()}
 const active=job
 void (async()=>{
  const db=await collection()
  const catalog=await deadlines.list();const venues=[...new Map(catalog.venues.filter(v=>v.kind==='journal').map(v=>[key(v),v])).values()]
  active.phase='official-lists'
  const endpoint=process.env.OVERLEAF_AGENT_ENDPOINT;const token=process.env.OVERLEAF_AGENT_TOKEN
  const response=await fetch(endpoint.replace(/\/$/,'')+'/agent/official-venue-metrics',{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Token':token},body:JSON.stringify({stream:true,venues:catalog.venues.map(({kind,description,year})=>({kind,description,year}))}),signal:AbortSignal.timeout(180000)})
  if(!response.ok)throw new Error('Official lists unavailable')
  active.officialUpdated=0
  const reader=response.body.getReader();const decoder=new TextDecoder();let pending=''
  async function consume(line){
   if(!line.trim())return;const event=JSON.parse(line)
   if(event.type==='error'){active.error=event.error;return}
   if(event.type==='done'){if(event.errors?.length)active.sourceErrors=event.errors;return}
   if(event.type!=='entries')return
   for(const [id,record]of Object.entries(event.entries)){
    const {sources,...fields}=record
    // Independent provider writes preserve other providers' fields and evidence.
    if(event.origin==='publisher'){const prior=await db.findOne({_id:'official:'+id});if(prior?.ei==='Indexed'||officialSeed.entries[id]?.ei==='Indexed')delete fields.ei}
    await db.updateOne({_id:'official:'+id},{$set:{...fields,['sourceEvidence.'+event.origin]:sources}},{upsert:true})
    active.officialUpdated++
   }
  }
  while(true){if(active.pauseRequested){await reader.cancel();active.phase='paused';return}const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let end;while((end=pending.indexOf('\n'))>=0){await consume(pending.slice(0,end));pending=pending.slice(end+1)}}
  if(pending.trim())await consume(pending)
  active.phase='letpub-supplement'
  let failures=0
  const supplements=venues.filter(v=>seed.entries[key(v)]?.status==='matched')
  active.total=supplements.length
  for(const venue of supplements){
   if(active.pauseRequested){active.phase='paused';break}
   const id=key(venue);const stored=await db.findOne({_id:id});const {_id:ignored,...previous}=stored||seed.entries[id]||{};void ignored
   try{
    const next=await queryLetPub(venue,{fetcher:browserSource,previous:seed.entries[id]?.status==='matched'?seed.entries[id]:undefined})
    if(next.status!=='matched'||next.access==='login-required')throw new Error(next.status==='matched'?'LetPub login required':next.status)
    await db.updateOne({_id:id},{$set:{...next,access:'authenticated',lastAttempt:{checked:next.checked,status:'updated'}}},{upsert:true});active.updated++;failures=0
   }catch(e){active.failed++;failures++;active.lastError=e.message;await db.updateOne({_id:id},{$set:{...(previous||{name:venue.description,status:'not-verified'}),lastAttempt:{checked:new Date().toISOString(),status:'failed',reason:e.message}}},{upsert:true})}
   active.completed++
   // A missing browser or expired login must not create hundreds of repeated failures.
   if(failures>=3||/rate limit|verification required/.test(active.lastError||'')){active.error='Refresh paused after repeated source failures or a rate limit. Check LetPub login and browser access; saved values were retained.';break}
   await new Promise(r=>setTimeout(r,15000))
  }
 })().catch(()=>{active.error='Latest official lists or metric storage could not be updated. Saved snapshots were retained; retry later.'}).finally(()=>{active.running=false;active.finished=new Date().toISOString()})
 return active
}
