import {createHash} from 'node:crypto'
import {fetchPublicPage} from './PublicPage.mjs'

export function physicalPlace(value){
 if(typeof value!=='string')return null
 const place=value.trim()
 if(!place||place.length>300||/\b(?:tbd|tba|tbc|unknown|tentative|provisional|to be (?:announced|confirmed|determined)|not (?:announced|confirmed|verified))\b|^[-—]$/i.test(place))return null
 if(/^(?:online|virtual|remote)(?:\s+(?:only|event|conference))?$/i.test(place))return null
 return place.replace(/\s*\(hybrid\)\s*/ig,' ').trim()
}
export function locationSites(place){
 const sites=[...new Set(place.split(/\s*[;；|\n]\s*/).map(physicalPlace).filter(Boolean))]
 if(sites.length>6)throw Object.assign(new Error('Too many conference locations.'),{status:422})
 return sites
}
export function locationQueries(place){
 const parts=place.split(',').map(p=>p.trim()).filter(Boolean)
 const city=parts[0].replace(/\s+(?:Convention|Conference|Congress|Exhibition)\s+(?:Center|Centre)$/i,'').trim()
 const cityQuery=city!==parts[0]&&parts.length>=2?[city,...parts.slice(1)].join(', '):null
 // Keep city + country. Never substitute a country centroid.
 return [...new Set([place,...(cityQuery?[cityQuery]:[]),...(parts.length>=3?parts.slice(1,-1).map((_,i)=>parts.slice(i+1).join(', ')):[])])].slice(0,3)
}
export function parseLocations(text){
 const rows=JSON.parse(text)
 if(!Array.isArray(rows))throw new Error('Invalid location response')
 // Only administrative/place areas are accepted; a similarly named business is not a conference location.
 return uniqueLocations(rows.slice(0,5).filter(r=>['place','boundary'].includes(r.category||r.class)&&r.lat!=null&&r.lon!=null&&String(r.lat).trim()!==''&&String(r.lon).trim()!==''&&Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lon))&&Math.abs(Number(r.lat))<=90&&Math.abs(Number(r.lon))<=180&&typeof r.display_name==='string').map(r=>({latitude:Number(r.lat),longitude:Number(r.lon),label:r.display_name.slice(0,500),precision:'area',source:'https://www.openstreetmap.org/'+(['node','way','relation'].includes(r.osm_type)&&/^\d+$/.test(String(r.osm_id))?`${r.osm_type}/${r.osm_id}`:'')})))
}
// Nominatim can return a city node and its administrative boundary with the same label.
export function uniqueLocations(candidates){
 const normalized=label=>label.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()
 return candidates.filter((item,index)=>!candidates.slice(0,index).some(other=>normalized(other.label)===normalized(item.label)&&Math.hypot((other.latitude-item.latitude)*111,(other.longitude-item.longitude)*111*Math.cos(item.latitude*Math.PI/180))<30))
}
function normalizeResult(result){
 return {...result,candidates:uniqueLocations(result.candidates||[]),...(result.locations?{locations:result.locations.map(site=>({...site,candidates:uniqueLocations(site.candidates)}))}:{})}
}
const persistent={
 async get(key){const {getCollectionInternal}=await import('../../infrastructure/mongodb.mjs');const db=await getCollectionInternal('venueLocationCache');return db.findOne({_id:key})},
 async set(key,value){const {getCollectionInternal}=await import('../../infrastructure/mongodb.mjs');const db=await getCollectionInternal('venueLocationCache');await db.updateOne({_id:key},{$set:value},{upsert:true})},
}
export function createVenueLocationService({fetcher=fetchPublicPage,cache=persistent,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),endpoint=process.env.VENUE_GEOCODER_URL||'https://nominatim.openstreetmap.org/search'}={}){
 const pending=new Map();let queue=Promise.resolve();let nextRequest=0
 async function lookup(rawPlace){
  const place=physicalPlace(rawPlace);if(!place)throw Object.assign(new Error('A confirmed physical location is not available.'),{status:422})
  const key=createHash('sha256').update('multi-area-v4\n'+endpoint+'\n'+place.normalize('NFKC').toLowerCase()).digest('hex')
  const saved=await cache.get(key);if(saved&&saved.expires>now())return normalizeResult(saved.result)
  if(pending.has(key))return pending.get(key)
  if(pending.size>=8)throw Object.assign(new Error('Location lookup is busy. Please retry.'),{status:429})
  const request=queue.catch(()=>{}).then(async()=>{
   const sites=locationSites(place),locations=[]
   for(const site of sites){
    let candidates=[],matchedQuery=site,error
    try{for(const query of locationQueries(site)){
     await sleep(Math.max(0,nextRequest-now()));nextRequest=now()+1100
     const url=new URL(endpoint);if(url.protocol!=='https:')throw new Error('Location provider must use HTTPS')
     url.search=new URLSearchParams({q:query,format:'jsonv2',limit:'3',layer:'address','accept-language':'en'}).toString()
     const page=await fetcher(url.href,0,{extendedTimeout:true});candidates=parseLocations(page.text)
     if(candidates.length){matchedQuery=query;break}
    }}catch(e){if(sites.length===1)throw e;error='This location could not be loaded. Please retry.'}
    locations.push({place:site,matchedQuery,areaFallback:matchedQuery!==site,candidates,...(error?{error}:{})})
   }
   const first=locations[0]||{matchedQuery:place,candidates:[],areaFallback:false}
   const result={place,matchedQuery:first.matchedQuery,areaFallback:locations.some(l=>l.areaFallback),candidates:first.candidates,locations,attribution:'© OpenStreetMap contributors',checked:new Date(now()).toISOString()}
   if(!locations.some(l=>l.error))await cache.set(key,{result,expires:now()+(locations.every(l=>l.candidates.length)?30:1)*86400000})
   return result
  }).finally(()=>pending.delete(key))
  pending.set(key,request);queue=request;return request
 }
 return {lookup}
}
export const venueLocations=createVenueLocationService()
