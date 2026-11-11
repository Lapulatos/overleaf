import test from 'node:test'
import assert from 'node:assert/strict'
import { deadlineInstant,normalizeCatalog,extractGuide,createDeadlineService } from '../../app/src/Features/SubmissionDeadlines/DeadlineService.mjs'
import {publicIPv4,publicUrl,fetchPublicPage} from '../../app/src/Features/SubmissionDeadlines/PublicPage.mjs'
const input=[{title:'Test',description:'Example venue',conference_key:'SE/test',sub:'SE',rank:{ccf:'A'},confs:[{id:'old',year:2025,timeline:[{deadline:'2025-01-01 12:00:00'}],timezone:'AoE'},{id:'new',year:2027,link:'https://example.org/2027',timezone:'AoE',opening:'2027-05-01 08:00:00',timeline:[{abstract_deadline:'2026-11-01 23:59:59',deadline:'2026-11-05 23:59:59',comment:'Main'},{deadline:'TBD',comment:'Second'}]}]}]
test('AoE and UTC offsets preserve the exact instant; unknown and invalid dates stay unknown',()=>{
 assert.equal(deadlineInstant('2026-11-05 23:59:59','AoE'),'2026-11-06T11:59:59.000Z');assert.equal(deadlineInstant('2026-11-05 23:00:00','UTC+8'),'2026-11-05T15:00:00.000Z');assert.equal(deadlineInstant('2026-02-30 12:00:00','UTC'),null);assert.equal(deadlineInstant('TBD','AoE'),null);assert.equal(deadlineInstant('2026-11-05 23:00:00','Unknown'),null)
})
test('PT respects DST and refuses ambiguous and skipped local times',()=>{
 assert.equal(deadlineInstant('2026-07-01 12:00:00','PT'),'2026-07-01T19:00:00.000Z');assert.equal(deadlineInstant('2026-12-01 12:00:00','PT'),'2026-12-01T20:00:00.000Z');assert.equal(deadlineInstant('2026-11-01 01:30:00','PT'),null);assert.equal(deadlineInstant('2026-03-08 02:30:00','PT'),null)
})
test('keeps distinct rounds and abstract/paper events; never uses conference opening as submission opening',()=>{
 const all=normalizeCatalog(input);assert.equal(all.length,3);const rows=all.filter(v=>v.year===2027);assert.equal(rows[0].events.length,2);assert.equal(rows[1].events[0].utc,null);assert.notEqual(rows[0].id,rows[1].id);assert.equal(rows[0].opening,undefined)
})
test('extracts attributed constraints and safe links, without executing embedded HTML',()=>{
 const guide=extractGuide('<script>must use bad.cls</script><p>Papers must use 12 pages and anonymous review.</p><p>Use example.bst and LaTeX.</p><a href="/template.zip">LaTeX template</a><a href="javascript:alert(1)">Submit</a><a href="/authors">Author instructions</a>','https://example.org/cfp');assert.equal(guide.requirements.find(r=>r.id==='length').excerpts[0].source,'https://example.org/cfp');assert.ok(guide.links.some(l=>l.url==='https://example.org/template.zip'));assert.ok(!JSON.stringify(guide).includes('bad.cls'));assert.ok(!JSON.stringify(guide).includes('javascript:'))
})
test('blocks private destinations, credentials and non-http URLs',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false);assert.equal(publicIPv4('8.8.8.8'),true);assert.equal(publicUrl('file:///etc/passwd'),null);assert.equal(publicUrl('https://user:pass@example.org'),null);await assert.rejects(fetchPublicPage('http://127.0.0.1/'),/not public/)
})
test('coalesces catalog reads and marks failed refresh as stale with original timestamp',async()=>{
 let now=100000,fail=false,calls=0;const service=createDeadlineService({now:()=>now,fetcher:async()=>{calls++;if(fail)throw Error('offline');return {text:JSON.stringify(input)}}});const [a,b]=await Promise.all([service.list(),service.list()]);assert.equal(calls,1);assert.equal(a.fetched,b.fetched);now+=4000000;fail=true;const stale=await service.list();assert.equal(stale.stale,true);assert.equal(stale.fetched,100000)
})
test('official source failures remain visible and do not invent requirements or template links',async()=>{
 const service=createDeadlineService({fetcher:async url=>{if(url.includes('allconf.json'))return {text:JSON.stringify(input)};throw Error('HTTP 403')}});const value=await service.detail('SE%2Ftest~new~0',true);assert.equal(value.sources[0].status,'unavailable');assert.equal(value.templates.length,0);assert.ok(value.requirements.every(r=>r.excerpts.length===0))
})

test('keeps registration cutoff separate and extracts official registration policy',()=>{
 const fixture=structuredClone(input);fixture[0].confs[1].timeline[0].registration_deadline='2026-10-30 23:59:59';
 const row=normalizeCatalog(fixture).find(v=>v.year===2027);assert.deepEqual(row.events.map(e=>e.label),['Registration','Abstract','Paper']);
 const guide=extractGuide('<p>Paper registration is mandatory before the abstract deadline; no new submissions are accepted after it.</p>','https://example.org/cfp');
 assert.equal(guide.requirements.find(r=>r.id==='registration').excerpts.length,1)
})

test('preserves all source ranking systems and keeps review dates separate from submission deadlines',()=>{
 const fixture=structuredClone(input);fixture[0].rank={ccf:'N',core:'A*',thcpl:'B'};fixture[0].confs[1].timeline[0].decision_deadline='2027-01-01 23:59:59';const row=normalizeCatalog(fixture).find(v=>v.year===2027);assert.deepEqual(row.ranks,{ccf:'N',core:'A*',thcpl:'B'});assert.equal(row.events.some(e=>e.label==='Decision'),false);assert.equal(row.milestones.some(e=>e.label==='Decision'),true);assert.equal(normalizeCatalog(input)[0].ranks.core,null)
})

test('retains closed current-year conferences alongside the next edition',()=>{
 const fixture=structuredClone(input);fixture[0].confs.push({id:'current',year:2026,timezone:'AoE',timeline:[{deadline:'2026-04-01 23:59:59'}]});
 const rows=normalizeCatalog(fixture,Date.parse('2026-11-03T00:00:00Z'));
 assert.ok(rows.some(r=>r.year===2026&&r.events[0].original==='2026-04-01 23:59:59'));assert.ok(rows.some(r=>r.year===2027));assert.ok(rows.some(r=>r.year===2025));
})

test('survives restart with annual catalog snapshot when upstream is offline',async()=>{
 let saved;const store={load:async()=>saved,save:async v=>{saved=v}};
 const first=createDeadlineService({now:()=>1,catalogSnapshots:store,fetcher:async()=>({text:JSON.stringify(input)})});await first.list();
 const second=createDeadlineService({now:()=>4000001,catalogSnapshots:store,fetcher:async()=>{throw Error('offline')}});const value=await second.list();assert.ok(value.stale);assert.ok(value.venues.some(v=>v.year===2027));assert.ok((await second.list()).stale);
});
test('keeps retrieved Tracks when the annual parent disappears from fallback catalog',async()=>{
 const cached={fetched:1,tracks:[{id:'missing::track:research',status:'retrieved',events:[]}]};
 const service=createDeadlineService({now:()=>999999999,trackSnapshots:{load:async()=>cached},fetcher:async()=>{throw Error('offline')}});const value=await service.tracks('missing');assert.equal(value.tracks,cached.tracks);assert.ok(value.stale);
});
test('returns saved Tracks immediately while a slow upstream refresh is pending',{timeout:500},async()=>{
 const cached={fetched:1,tracks:[{id:'saved::track:research',status:'retrieved',events:[{date:'2027-01-01'}]}]};
 const service=createDeadlineService({now:()=>999999999,trackSnapshots:{load:async()=>cached},fetcher:async()=>new Promise(()=>{})});
 const value=await service.tracks('saved');assert.equal(value.tracks,cached.tracks);assert.ok(value.stale);
});
