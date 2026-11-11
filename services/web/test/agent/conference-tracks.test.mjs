import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {trackLinks,extractTrack,collectTracks,asTrackVenue,roundDates} from '../../app/src/Features/SubmissionDeadlines/ConferenceTracks.mjs'
import {extractGuide} from '../../app/src/Features/SubmissionDeadlines/DeadlineService.mjs'
const url='https://conf.researchr.org/home/test-2027';const main='https://conf.researchr.org/track/test-2027/research';const artifact='https://conf.researchr.org/track/test-2027/artifact';const venue={id:'test',kind:'conference',website:url}
const directory=`<a href="#">Attending</a><a href="${main}">Research papers</a><a href="${artifact}">Artifact evaluation</a><a href="/track/test-2026/posters">Last year posters</a>`
test('discovers edition-local Tracks without treating hash navigation as a Track',()=>{assert.deepEqual(trackLinks(directory,url).map(t=>t.title),['Research papers','Artifact evaluation'])})
test('extracts only track-local dates and preserves date-only uncertainty and eligibility',()=>{
 const html=`<table><tr href="${artifact}"><td>Mon 29 Jun 2026<br>Submission deadline</td></tr><tr href="${main}"><td>Tue 1 Sep 2026<br>Paper deadline</td></tr></table><div id="call-artifacts"><p>Only accepted research papers can submit supplementary artifacts as Docker images.</p></div>`
 const track=extractTrack(html,artifact,{url:artifact,title:'Artifact evaluation'},venue,extractGuide)
 assert.equal(track.events.length,1);assert.equal(track.events[0].date,'2026-06-29');assert.equal(track.events[0].utc,null);assert.equal(track.supportsLatex,false);assert.match(track.summary,/accepted research/)
})
test('keeps unavailable Tracks visible and never copies main requirements to them',async()=>{
 const data=await collectTracks(venue,async u=>{if(u===url)return {url,text:directory};if(u===main)return {url:main,text:'<div id="call-papers"><p>Use the LaTeX acmart template with a 10 page limit.</p></div>'};throw Error('HTTP403')},extractGuide)
 assert.equal(data.tracks.length,2);assert.equal(data.tracks[0].supportsLatex,true);assert.equal(data.tracks[1].status,'unavailable');assert.equal(data.tracks[1].supportsLatex,false);assert.deepEqual(data.tracks[1].requirements,[]);assert.equal(asTrackVenue(venue,data.tracks[0]).round,'Research papers')
})

test('keeps acceptance prerequisites separate from formatting and splits review ranges',()=>{
 const html=`<table><tr href="${artifact}"><td>Wed 8 - Sun 12 Jul 2026<br>Author response period</td></tr></table><div id="call-artifacts"><p>Artifact evaluation is for accepted submissions to the research track.</p></div>`
 const track=extractTrack(html,artifact,{url:artifact,title:'Artifact evaluation'},venue,extractGuide)
 assert.deepEqual(track.events.map(e=>e.date),['2026-07-08','2026-07-12']);assert.match(track.events[0].label,/starts/);assert.match(track.events[1].label,/ends/)
 assert.match(track.requirements.find(r=>r.id==='prerequisites').excerpts[0].text,/accepted submissions/)
})

test('resolves sub-Track identity and guide independently from the parent catalog entry',async()=>{
 const {createDeadlineService,CATALOG_URL}=await import('../../app/src/Features/SubmissionDeadlines/DeadlineService.mjs')
 const service=createDeadlineService({fetcher:async u=>u===CATALOG_URL?{text:JSON.stringify([{title:'TEST',conference_key:'test',sub:'SE',confs:[{id:'test27',year:2027,link:url,timeline:[{}]}]}])}:u===url?{url,text:directory}:u===main?{url:main,text:'<div id="call-main"><p>Use LaTeX with a 10 page limit.</p></div>'}:{url:artifact,text:'<div id="call-ae"><p>Only accepted submissions may submit supplementary artifacts.</p></div>'}})
 const parent=(await service.list()).venues.find(v=>v.title==='TEST')
 const data=await service.tracks(parent.id);const t=data.tracks.find(t=>t.title==='Artifact evaluation')
 const resolved=await service.resolve(t.id);assert.equal(resolved.parentVenueId,parent.id);assert.equal(resolved.website,artifact);assert.equal(resolved.track.supportsLatex,false)
 const detail=await service.detail(t.id);assert.equal(detail.venue.round,'Artifact evaluation');assert.equal(detail.templates.length,0);assert.equal(await service.resolve(parent.id+'::track:missing'),null)
})

test('does not treat submission instructions or sponsorship pages as submission Tracks',()=>{
 const html=directory+`<a href="/track/test-2027/how-to-submit">How to Submit</a><a href="/track/test-2027/guide">Submission Guidelines</a><a href="/track/test-2027/sponsor">Sponsorship</a><a href="/track/test-2027/demos">Tool Demonstrations</a>`
 assert.deepEqual(trackLinks(html,url).map(t=>t.title),['Research papers','Artifact evaluation','Tool Demonstrations'])
})

test('recognizes a lone official call as the main Track without inventing other Tracks',async()=>{const home='https://example.org/2027/';const call=home+'papers';const data=await collectTracks({...venue,year:2027,website:home},async u=>u===home?{url:home,text:'<a href="papers">Call for Papers</a>'}:{url:call,text:'<li>Camera-ready version: <p>15 March 2027</p></li><li>Author registration deadline: <p>20 March 2027</p></li>'},extractGuide);assert.equal(data.tracks.length,1);assert.equal(data.tracks[0].isMain,true);assert.deepEqual(data.tracks[0].events.map(e=>e.date),['2027-03-15','2027-03-20'])})

test('keeps submission portals local to the Track call and ignores generic service/docs links',()=>{
 const html=`<aside><a href="https://other.hotcrp.com/">Other Track submission</a></aside><div id="call-artifacts"><p>Submit artifacts through <a href="https://ae2027.hotcrp.com/">HotCRP</a>.</p><p><a href="https://easychair.org/">EasyChair</a><a href="https://easychair.org/conferences/?conf=ae2027">Submission site</a><a href="https://ae2027.hotcrp.com/help">Submission guidelines</a></p></div>`
 const track=extractTrack(html,artifact,{url:artifact,title:'Artifact evaluation'},venue,extractGuide)
 assert.deepEqual(track.submissionLinks,[{label:'HotCRP',url:'https://ae2027.hotcrp.com/'},{label:'EasyChair',url:'https://easychair.org/conferences/?conf=ae2027'}])
})

test('retains a verified Track snapshot when the current official source is unavailable',async()=>{
 const {createDeadlineService,CATALOG_URL}=await import('../../app/src/Features/SubmissionDeadlines/DeadlineService.mjs');const {trackSnapshotStore}=await import('../../app/src/Features/SubmissionDeadlines/TrackSnapshotStore.mjs');const fs=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');const root=await fs.mkdtemp(path.join(os.tmpdir(),'track-snapshot-'))
 try{const store=trackSnapshotStore(root);let fail=false;let clock=0;const fetcher=async u=>{if(u===CATALOG_URL)return {text:JSON.stringify([{title:'TEST',conference_key:'test',sub:'SE',confs:[{id:'test27',year:2027,link:url,timeline:[{}]}]}])};if(fail)throw Error('TLS unavailable');return u===url?{url,text:directory}:{url:u,text:'<div id="call-papers"><p>Use the LaTeX acmart template with a 10 page limit.</p></div>'}};let service=createDeadlineService({fetcher,now:()=>clock,trackSnapshots:store});const id=(await service.list()).venues.find(v=>v.title==='TEST').id;const first=await service.tracks(id);fail=true;clock=4000000;service=createDeadlineService({fetcher,now:()=>clock,trackSnapshots:store});const fallback=await service.tracks(id,true);assert.equal(fallback.stale,true);assert.equal(fallback.fetched,first.fetched);assert.deepEqual(fallback.tracks,first.tracks);assert.match(fallback.notice,/could not be refreshed/)}finally{await fs.rm(root,{recursive:true,force:true})}
})
test('Track overview uses scoped topics and omits administrative rules',async()=>{const {extractTrackOverview,withTrackOverviews}=await import('../../app/src/Features/SubmissionDeadlines/TrackOverview.mjs');const overview=extractTrackOverview('<h2>Call for Papers</h2><p>We invite original studies of software engineering methods and new tools for practical development.</p><h3>Topics of Interest</h3><ul><li>Software testing and analysis</li><li>Programming tools and methods</li></ul><h3>Submission Guidelines</h3><ul><li>Papers must use 18 pages.</li></ul>','https://example.org/track');assert.deepEqual(overview.topics,['Software testing and analysis','Programming tools and methods']);assert.doesNotMatch(overview.text,/18 pages/);const known=withTrackOverviews({tracks:[{url:'https://conf.researchr.org/track/fse-2027/fse-2027-papers'},{url:'https://example.org/unknown'}]});assert.ok(known.tracks[0].overview.topics.length);assert.equal(known.tracks[1].overview,null)})
test('retains a successfully retrieved Track when only that sibling fails on refresh',async()=>{const {preserveRetrievedTracks}=await import('../../app/src/Features/SubmissionDeadlines/ConferenceTracks.mjs');const old={fetched:1,tracks:[{id:'a',status:'retrieved',events:[{date:'2027-01-01'}]}]};const result=preserveRetrievedTracks({fetched:2,tracks:[{id:'a',status:'unavailable',events:[],reason:'timeout'},{id:'b',status:'retrieved',events:[]}]},old);assert.equal(result.tracks[0].events.length,1);assert.equal(result.tracks[0].sourceFetched,1);assert.equal(result.tracks[0].stale,true);assert.equal(result.tracks[1].sourceFetched,2)})

test('splits a response range with months at both endpoints',()=>{
 const html=`<table><tr href="${main}"><td>Mon 22 Mar - Thu 25 Mar 2027 Author Response Period</td></tr></table>`
 const track=extractTrack(html,main,{url:main,title:'Research Papers'},venue,extractGuide)
 assert.deepEqual(track.events.map(e=>e.date),['2027-03-22','2027-03-25']);assert.match(track.events[0].label,/starts/)
})

test('discovers short Call For labels and an officially linked external evaluator call',async()=>{
 const home='https://example.org/SP2027/';
 const html='<div class="navbar"><ul><li><a href="#">Call For...</a><ul><li><a href="cfpapers.html">Papers</a></li><li><a href="cfartifacts.html">Artifacts</a></li><li><a href="https://forms.gle/official">Artifact Evaluators</a></li><li><a href="cfworkshops.html">Workshops</a></li></ul></li></ul></div><a href="awards.html">Papers</a><a href="../SP2026/cfpapers.html">Research papers</a>';
 assert.deepEqual(trackLinks(html,home).map(t=>t.title),['Papers','Artifacts','Artifact Evaluators','Workshops']);
 const data=await collectTracks({...venue,website:home},async u=>({url:u,text:u===home?html:html+'<main><p>We invite contributions to this call and describe their specific submission requirements.</p></main>'}),extractGuide);
 assert.equal(data.tracks.length,4);assert.equal(data.tracks[0].isMain,true);
 assert.equal(data.tracks.find(t=>t.title==='Artifact Evaluators').submissionKind,'reviewer-recruitment');
 assert.ok(data.tracks.every(t=>!t.sourceText.includes('Call For')));
})

test('retains official S&P paper and artifact cycle boundaries',()=>{
 for(const [kind,count] of [['papers',10],['artifacts',5]]){
  const html=fs.readFileSync(new URL(`./fixtures/sp2027-${kind}-dates.html`,import.meta.url),'utf8');const events=roundDates(html,'https://sp2027.ieee-security.org/cf'+kind+'.html');
  assert.equal(events.length,count*2);assert.equal(events.filter(e=>e.round==='Cycle 1').length,count);assert.equal(events.filter(e=>e.round==='Cycle 2').length,count);
  assert.ok(events.filter(e=>e.round==='Cycle 1').every(e=>e.date<'2026-11-01'));assert.ok(events.filter(e=>e.round==='Cycle 2').every(e=>e.date>='2026-11-01'));
 }
})
