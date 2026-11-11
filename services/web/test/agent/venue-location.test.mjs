import test from 'node:test'
import assert from 'node:assert/strict'
import {createVenueLocationService,parseLocations,physicalPlace} from '../../app/src/Features/SubmissionDeadlines/VenueLocationService.mjs'
const response=JSON.stringify([{category:'place',lat:'22.14',lon:'113.51',display_name:'Hengqin, China',osm_type:'relation',osm_id:123}])
function memory(){const rows=new Map();return {get:async k=>rows.get(k),set:async(k,v)=>rows.set(k,v)}}
test('only confirmed physical locations can be resolved',()=>{
 for(const place of ['',undefined,'TBD','London (tentative)','Online','Virtual conference'])assert.equal(physicalPlace(place),null)
 assert.equal(physicalPlace('Hengqin, China (hybrid)'),'Hengqin, China')
})
test('validates coordinates and exposes area precision rather than inventing a venue address',()=>{
 assert.deepEqual(parseLocations(response)[0],{latitude:22.14,longitude:113.51,label:'Hengqin, China',precision:'area',source:'https://www.openstreetmap.org/relation/123'})
 assert.equal(parseLocations(JSON.stringify([{lat:'91',lon:'0',display_name:'bad'},{lat:'',lon:'1',display_name:'empty'},{lat:'1',lon:'Infinity',display_name:'invalid'}])).length,0)
})
test('deduplicates simultaneous lookups, persists results, and enforces provider pacing',async()=>{
 let calls=0,time=1000;const delays=[];const cache=memory();const fetcher=async url=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('layer'),'address');assert.equal(u.searchParams.get('accept-language'),'en');return {text:response}}
 const service=createVenueLocationService({fetcher,cache,now:()=>time,sleep:async ms=>{delays.push(ms);time+=ms}})
 const [a,b]=await Promise.all([service.lookup('Hengqin, China'),service.lookup('Hengqin, China')]);assert.deepEqual(a,b);assert.equal(calls,1)
 await service.lookup('London, UK');assert.equal(calls,2);assert.ok(delays.some(ms=>ms>=1100))
 const restarted=createVenueLocationService({fetcher,cache,now:()=>time,sleep:async()=>{}});await restarted.lookup('Hengqin, China');assert.equal(calls,2)
})
test('does not cache a failed or invalid provider response',async()=>{
 let calls=0;const service=createVenueLocationService({cache:memory(),sleep:async()=>{},fetcher:async()=>{calls++;if(calls===1)throw Error('offline');return {text:response}}})
 await assert.rejects(service.lookup('Hengqin, China'),/offline/);assert.equal((await service.lookup('Hengqin, China')).candidates.length,1);assert.equal(calls,2)
})

test('rejects unrelated businesses even when their coordinates are valid',()=>{assert.equal(parseLocations(JSON.stringify([{category:'amenity',type:'restaurant',lat:'1.33',lon:'103.95',display_name:'Bliss Garden Restaurant, Singapore EXPO'}])).length,0)})

test('falls back from an unrecognized venue to its city and retains area precision',async()=>{
 const queries=[];let time=1000;const delays=[]
 const service=createVenueLocationService({cache:memory(),now:()=>time,sleep:async ms=>{delays.push(ms);time+=ms},fetcher:async url=>{const q=new URL(url).searchParams.get('q');queries.push(q);return {text:q.startsWith('KIT,')?'[]':response}}})
 const result=await service.lookup('KIT, Amsterdam, The Netherlands')
 assert.deepEqual(queries,['KIT, Amsterdam, The Netherlands','Amsterdam, The Netherlands']);assert.equal(result.areaFallback,true);assert.equal(result.candidates[0].precision,'area');assert.ok(delays.includes(1100))
})
test('does not degrade a city/country query into a misleading country centroid',async()=>{
 const queries=[];const service=createVenueLocationService({cache:memory(),sleep:async()=>{},fetcher:async url=>{queries.push(new URL(url).searchParams.get('q'));return {text:'[]'}}})
 await service.lookup('Unmatched city, The Netherlands');assert.deepEqual(queries,['Unmatched city, The Netherlands'])
})

test('resolves two sites separately and falls back from a convention center to its city',async()=>{
 const queries=[];let time=1000;const service=createVenueLocationService({cache:memory(),now:()=>time,sleep:async ms=>{time+=ms},fetcher:async url=>{const q=new URL(url).searchParams.get('q');queries.push(q);return {text:q.includes('Convention Center')?'[]':response}}})
 const result=await service.lookup('San Diego Convention Center, USA; Mexico City, Mexico');assert.deepEqual(queries,['San Diego Convention Center, USA','San Diego, USA','Mexico City, Mexico']);assert.equal(result.locations.length,2);assert.equal(result.locations[0].areaFallback,true);assert.ok(result.locations.every(site=>site.candidates.length))
})
test('supports three sites and preserves successes when another lookup fails',async()=>{
 const queries=[];const service=createVenueLocationService({cache:memory(),sleep:async()=>{},fetcher:async url=>{const q=new URL(url).searchParams.get('q');queries.push(q);if(q.startsWith('Atlanta'))throw Error('offline');return {text:response}}})
 const result=await service.lookup('Sydney, Australia; Atlanta, USA; Paris, France');assert.deepEqual(queries,['Sydney, Australia','Atlanta, USA','Paris, France']);assert.equal(result.locations.length,3);assert.equal(result.locations[0].candidates.length,1);assert.ok(result.locations[1].error);assert.equal(result.locations[2].candidates.length,1)
})

test('merges nearby city and boundary duplicates but retains distant same-name places',()=>{
 const row={category:'place',lat:'52.37',lon:'4.89',display_name:'Amsterdam, North Holland, Netherlands',osm_type:'node',osm_id:1}
 const results=parseLocations(JSON.stringify([row,{...row,category:'boundary',lat:'52.38',osm_type:'relation',osm_id:2},{...row,lat:'12.37',osm_id:3}]))
 assert.equal(results.length,2);assert.equal(results[0].source,'https://www.openstreetmap.org/node/1');assert.equal(results[1].latitude,12.37)
})

test('normalizes existing cached duplicate locations without refetching',async()=>{
 const a={latitude:52.37,longitude:4.89,label:'Amsterdam, North Holland, Netherlands',precision:'area',source:'https://www.openstreetmap.org/node/1'}
 const candidates=[a,{...a,latitude:52.38,source:'https://www.openstreetmap.org/relation/2'}]
 const service=createVenueLocationService({cache:{get:async()=>({expires:Infinity,result:{candidates,locations:[{place:'Amsterdam',candidates}]}})},fetcher:async()=>{throw Error('must not fetch')}})
 const result=await service.lookup('Amsterdam, Netherlands');assert.equal(result.candidates.length,1);assert.equal(result.locations[0].candidates.length,1)
})
