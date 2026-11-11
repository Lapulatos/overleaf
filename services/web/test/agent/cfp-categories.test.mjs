import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {collectTracks,extractTrack} from '../../app/src/Features/SubmissionDeadlines/ConferenceTracks.mjs'
import {cfpCategories} from '../../app/src/Features/SubmissionDeadlines/CfpCategories.mjs'
import {extractGuide} from '../../app/src/Features/SubmissionDeadlines/DeadlineService.mjs'
const html=fs.readFileSync(new URL('./fixtures/cfp/cav-2027.html',import.meta.url),'utf8')
const artifacts=fs.readFileSync(new URL('./fixtures/cfp/cav-2027-artifacts.html',import.meta.url),'utf8')
const url='https://conferences.i-cav.org/2027/cfp/'
const venue={id:'cav2027',kind:'conference',year:2027,website:url}
async function collect(){return collectTracks(venue,async link=>({url:link,text:link===url?html:artifacts}),extractGuide)}
test('CAV official CFP yields all three paper categories alongside artifacts, with stable source-based IDs',async()=>{
 const result=await collect();const again=await collect();assert.deepEqual(result.tracks.map(t=>t.id),again.tracks.map(t=>t.id));assert.equal(new Set(result.tracks.map(t=>t.id)).size,5)
 assert.deepEqual(result.tracks.filter(t=>t.categoryEvidence&&!/Artifact/.test(t.title)).map(t=>t.title),['Regular Papers','Tool Papers','Application/Industrial Experience/Case Study Papers'])
 assert.equal(result.tracks.find(t=>t.title==='Tool Papers').url,url+'#tool-papers-1')
})
test('shared submission/response/final dates retain official exact timestamps without copying artifact registration between categories',async()=>{
 const {tracks}=await collect()
 for(const t of tracks.filter(t=>t.categoryEvidence&&!/Artifact/.test(t.title))){
  assert.equal(t.events.find(e=>e.label==='Paper submission').utc,'2027-01-21T11:59:00.000Z')
  assert.deepEqual(t.events.filter(e=>/Author response/.test(e.label)).map(e=>e.date),['2027-04-05','2027-04-08'])
  assert.equal(t.events.find(e=>e.label==='Author notification').date,'2027-04-23')
  assert.equal(t.events.find(e=>e.label==='Author notification').utc,null)
  assert.equal(t.events.filter(e=>/Artifact registration/.test(e.label)).length,1)
  assert.equal(t.events.find(e=>/Artifact registration/.test(e.label)).date,t.title==='Tool Papers'?'2027-03-08':'2027-04-26')
 }
})
test('category requirements keep page limits, anonymity and artifact obligations separate',async()=>{
 const {tracks}=await collect();const regular=tracks.find(t=>t.title==='Regular Papers');const tool=tracks.find(t=>t.title==='Tool Papers');const app=tracks.find(t=>t.title.startsWith('Application/'))
 const rule=(t,id)=>t.requirements.find(r=>r.id===id).excerpts.map(e=>e.text).join('\n')
 assert.match(rule(regular,'length'),/Camera-ready: Regular papers and tool papers: up to 20 pages/);assert.match(rule(regular,'length'),/18 pages/);assert.doesNotMatch(rule(regular,'length'),/10 pages/)
 assert.match(rule(regular,'anonymity'),/double-blind/);assert.doesNotMatch(rule(regular,'anonymity'),/single-blind/)
 assert.match(rule(tool,'anonymity'),/single-blind/);assert.doesNotMatch(rule(tool,'anonymity'),/double-blind/)
 assert.match(rule(app,'length'),/10 pages/);assert.doesNotMatch(rule(app,'length'),/18 pages|20 pages/)
 assert.match(tool.summary+' '+JSON.stringify(tool.requirements),/mandatory for tool papers/)
})
test('topics and incidental paper headings never invent categories',()=>{assert.deepEqual(cfpCategories('<p>Topics of interest</p><ul><li>Tool Papers</li><li>Regular Papers</li></ul><h2 id="a">Tool Papers</h2><h2 id="b">Regular Papers</h2>',url),[])})
test('shorthand date ranges become both endpoints and submission-guidelines anchor does not hide table dates',()=>{
 const t=extractTrack('<main><table><tr><td>Author response period</td><td>Mon, 5 – Thu, 8 Apr 2027</td></tr><tr><td>Full papers due</td><td>20 January 2027</td></tr></table><h2 id="submission-guidelines">Submission Guidelines</h2><p>18 pages</p></main>',url,{url,title:'Research papers'},venue,extractGuide)
 assert.deepEqual(t.events.map(e=>e.date),['2027-01-20','2027-04-05','2027-04-08'])
})

test('artifact rounds keep independent submission deadlines and notification dates',async()=>{
 const rounds=(await collect()).tracks.filter(t=>/^Artifact Evaluation Round/.test(t.title));assert.equal(rounds.length,2)
 assert.deepEqual(rounds.map(t=>t.events.find(e=>e.label==='Artifact submission')?.date),['2027-03-11','2027-05-03'])
 assert.ok(rounds.every(t=>t.events.filter(e=>e.label==='Artifact submission').length===1))
})
