import {fetchPublicPage} from './PublicPage.mjs'
export const ACCEPTANCE_URL='https://ccfddl.com/conference/allacc.json'
export function acceptanceHistory(catalog,venue){
 const key=decodeURIComponent((venue.parentVenueId||venue.id).split('~')[0]).toLowerCase()
 const year=Number(venue.year)
 if(!Number.isInteger(year)||year<1900)return []
 // Never join by acronym: FSE has independent software-engineering and cryptography series.
 const entry=catalog.find(row=>typeof row.conference_key==='string'&&row.conference_key.toLowerCase()===key)
 return (entry?.accept_rates||[]).filter(row=>Number.isInteger(row.year)&&row.year>=1900&&row.year<=year).map(row=>{
  const count=v=>Number.isSafeInteger(v)&&v>=0?v:null
  const submitted=count(row.submitted),accepted=count(row.accepted)
  const calculated=submitted>0&&accepted!==null&&accepted<=submitted?accepted/submitted:null
  const published=typeof row.rate==='number'&&Number.isFinite(row.rate)&&row.rate>=0&&row.rate<=1?row.rate:null
  const inconsistent=accepted!==null&&submitted!==null&&accepted>submitted
  let source=null;try{const url=new URL(row.source);if(['https:','http:'].includes(url.protocol))source=url.href}catch{}
  return {year:row.year,submitted,accepted,rate:inconsistent?null:calculated??published,source,note:inconsistent?'Source counts are inconsistent; rate omitted.':calculated!==null&&published!==null&&Math.abs(calculated-published)>.005?'Rate calculated from counts; published rate differs.':null}
 }).sort((a,b)=>a.year-b.year)
}
export const acceptanceRepository={
 async load(){const {getCollectionInternal}=await import('../../infrastructure/mongodb.mjs');return (await getCollectionInternal('venueAcceptanceSnapshots')).findOne({_id:'ccfddl'})},
 async save(value){const {getCollectionInternal}=await import('../../infrastructure/mongodb.mjs');await (await getCollectionInternal('venueAcceptanceSnapshots')).updateOne({_id:'ccfddl'},{$set:value},{upsert:true})},
}
async function fetchAcceptance(url){let page;try{page=await fetchPublicPage(url)}catch{page=await fetchPublicPage('https://raw.githubusercontent.com/ccfddl/ccfddl.github.io/page/conference/allacc.json')}return {ok:true,url:page.url,text:async()=>page.text}}
export function createAcceptanceService(fetcher=fetchAcceptance,now=Date.now,repository=fetcher===fetchAcceptance?acceptanceRepository:null){
 let cache,pending,loaded=false,lastFailure=-Infinity
 async function refresh(){
  if(pending)return pending
  if(now()-lastFailure<300000)throw Error('Statistics source is temporarily unavailable. Please retry later.')
  pending=(async()=>{const response=await fetcher(ACCEPTANCE_URL,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Acceptance source unavailable');const text=await response.text();if(text.length>5000000)throw Error('Acceptance source too large');const data=JSON.parse(text);if(!Array.isArray(data)||!data.length||!data.every(row=>row&&typeof row.conference_key==='string'&&Array.isArray(row.accept_rates)))throw Error('Invalid acceptance catalog');const value={data,fetched:now(),source:response.url||ACCEPTANCE_URL};await repository?.save(value);cache=value;lastFailure=-Infinity})().catch(e=>{lastFailure=now();throw e}).finally(()=>{pending=null})
  return pending
 }
 return {async history(venue){
  if(!loaded){const stored=await repository?.load();if(stored?.data?.length&&Number.isFinite(stored.fetched))cache=stored;loaded=true}
  if(!cache)await refresh()
  const stale=now()-cache.fetched>3600000
  if(stale)void refresh().catch(()=>{})
  return {records:acceptanceHistory(cache.data,venue),throughYear:venue.year,source:cache.source||ACCEPTANCE_URL,fetched:cache.fetched,stale}
 }}
}
export const venueAcceptance=createAcceptanceService()
