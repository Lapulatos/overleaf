import test from 'node:test'
import assert from 'node:assert/strict'
import {parseRecommendations,recommendationPrompt,recommendationAnalysisCatalog} from '../../app/src/Features/SubmissionDeadlines/Recommendation.mjs'
const venues=[{id:'a',title:'A',rank:'B'},{id:'b',title:'B',rank:'A'}]
test('validates catalog IDs, scores and source URLs without accepting invented ranks',()=>{const result=parseRecommendations(JSON.stringify({paperSummary:'Methods paper',limitations:['Limited coverage'],recommendations:[{venueId:'a',score:80,reason:'Method fit',rank:'A*',sources:['javascript:alert(1)','https://example.org/cfp']},{venueId:'missing',score:99,reason:'Invented'},{venueId:'b',score:90,reason:'Strong fit'},{venueId:'a',score:81,reason:'Duplicate'}]}),venues);assert.deepEqual(result.recommendations.map(v=>v.venue.id),['b','a']);assert.equal(result.recommendations[1].venue.rank,null);assert.equal(result.recommendations[1].venue.ccf.status,'unmatched');assert.deepEqual(result.recommendations[1].sources,['https://example.org/cfp']);assert.ok(result.limitations.some(s=>s.includes('omitted')))})
test('accepts empty results and JSON fences, refuses unstructured reports',()=>{assert.deepEqual(parseRecommendations('```json\n{"paperSummary":"No fit","recommendations":[]}\n```',venues).recommendations,[]);assert.throws(()=>parseRecommendations('Try venue A',venues));assert.match(recommendationPrompt(),/do not edit/i)})

test('track recommendations keep prerequisite assessment distinct from topic fit',()=>{
 const track={id:'track',title:'TEST',track:{title:'Artifacts'},kind:'conference',area:'SE',rank:'A'}
 const result=parseRecommendations(JSON.stringify({paperSummary:'Tool paper',recommendations:[{venueId:'track',score:90,reason:'Relevant tool, acceptance not known',sources:[]}]}),[track])
 assert.equal(result.recommendations[0].score,90)
 assert.equal(result.recommendations[0].eligibility.status,'unconfirmed')
})

test('bounds optional concise recommendation bullets and supports legacy reports',()=>{
 const result=parseRecommendations(JSON.stringify({paperSummary:'Paper',recommendations:[{venueId:'a',score:80,reason:'Evidence',briefReasons:['Fit',null,'x'.repeat(300),'extra','overflow'],prerequisiteIssues:['Wrong format']}]}),venues)
 assert.equal(result.recommendations[0].briefReasons.length,3);assert.equal(result.recommendations[0].briefReasons[1].length,160);assert.deepEqual(result.recommendations[0].prerequisiteIssues,['Wrong format'])
})

test('accepts a concrete adapted Track plan but not a bare new-manuscript flag',()=>{
 const track={id:'tool',title:'TEST',kind:'conference',track:{title:'Tool Papers'}}
 const variant={kind:'adapted',key:'tool-paper',summary:'A tool contribution with a separate evaluation',changes:['Package the implementation and add a usability case study']}
 const parse=(v,id='tool')=>parseRecommendations(JSON.stringify({paperSummary:'Research paper',recommendations:[{venueId:id,score:88,reason:'Can be adapted',manuscriptVariant:v}]}),[track,...venues]).recommendations[0].venue
 assert.deepEqual(parse(variant).manuscriptVariant,variant)
 assert.equal(parse({...variant,changes:[]}).manuscriptVariant,undefined)
 assert.equal(parse(variant,'a').manuscriptVariant,undefined)
 assert.equal(parse({kind:'adapted'}).manuscriptVariant,undefined)
 assert.match(recommendationPrompt(),/SAME key/)
})

test('analysis catalog preserves Track evidence and dates without repeated provenance',()=>{
 const events=[{label:'Paper submission',date:'2027-03-01',source:'https://example.org/cfp'}],requirements=[{label:'Tool paper',excerpts:['Runnable artifact required']}]
 const original={venues:[{id:'t',title:'C',kind:'conference',ccf:{long:'directory provenance'},xidian:{long:'directory provenance'},events,milestones:events,track:{id:'t',title:'Tool Papers',events,requirements}}]}
 const compact=recommendationAnalysisCatalog(original)
 assert.deepEqual(compact.venues[0].events,events);assert.deepEqual(compact.venues[0].track.requirements,requirements)
 assert.equal(compact.venues[0].milestones,undefined);assert.equal(compact.venues[0].track.events,undefined)
 assert.deepEqual(original.venues[0].track.events,events);assert.ok(JSON.stringify(compact).length<JSON.stringify(original).length)
})

test('command planning preferences are bounded and cannot overwrite the declared submission',()=>{
 const valid=parseRecommendations(JSON.stringify({paperSummary:'Plan',recommendations:[],planning:{months:18,gapDays:5,mode:'journal',allowWarning:false,reviewId:'invented',active:false}}),venues)
 assert.deepEqual(valid.planning,{months:18,gapDays:5,mode:'journal',allowWarning:false})
 const invalid=parseRecommendations(JSON.stringify({paperSummary:'Plan',recommendations:[],planning:{months:999,gapDays:-1,mode:'anything',allowWarning:'yes'}}),venues)
 assert.equal(invalid.planning,undefined)
})
