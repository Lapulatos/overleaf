import {expect} from 'chai'
import {planSequence,qualityOrder,recommendSequence,defaultReviewDays,reviewConflictSegments} from '@/features/plugins/submission-sequence'
import type {Venue} from '@/features/plugins/submission-deadlines'
const time=(s:string)=>Date.parse(s+'T12:00:00Z')
const event=(label:string,date:string)=>({label,utc:new Date(time(date)).toISOString(),original:date,timezone:'UTC'})
const make=(id:string,deadline:string,decision?:string)=>({id,title:id,kind:'conference',rank:'A',events:[event('Paper',deadline),...(decision?[event('Decision',decision)]:[])]} as Venue)
const settings={start:time('2027-01-01'),gapDays:7,reviewDays:{},withdrawals:{}}
describe('Submission sequence planning',()=>{
 it('keeps later submissions after rejection and preparation',()=>{const s=planSequence([make('A','2027-01-10','2027-02-01'),make('B','2027-02-10','2027-03-01')],settings);expect(s[1].start!).to.be.greaterThan(s[0].end!+6*86400000)})
 it('rejects overlapping deadlines and expired abstract gates',()=>{const b=make('B','2027-02-10');b.events.push(event('Abstract','2027-02-02'));const s=planSequence([make('A','2027-01-10','2027-02-01'),b],settings);expect(s[1].start).to.equal(undefined);expect(s[1].reason).to.include('Abstract')})
 it('does not infer a decision from response scores or conference dates',()=>{const a=make('A','2027-01-10');a.events.push(event('Response','2027-01-20'),event('Conference','2027-03-01'));const s=planSequence([a,make('B','2027-04-01')],settings);expect(s[0].end).to.equal(undefined);expect(s[1].start).to.equal(undefined)})
 it('allows a conditional withdrawal branch only on or after submission',()=>{const s=planSequence([make('A','2027-01-10','2027-03-01'),make('B','2027-02-10')],{...settings,withdrawals:{A:'2027-01-25'}});expect(s[0].withdrawal).to.equal(true);expect(s[1].start).to.not.equal(undefined);expect(s[1].conditional).to.equal(true);expect(planSequence([make('A','2027-01-10')],{...settings,withdrawals:{A:'2027-01-02'}})[0].start).to.equal(undefined)})
 it('defaults journal review to three calendar months',()=>{const journal={id:'J',kind:'journal',events:[]} as unknown as Venue;expect(planSequence([journal],settings)[0].end).to.equal(time('2027-04-01'));const s=planSequence([journal,make('B','2027-04-01')],{...settings,reviewDays:{J:30}});expect(s[0].conditional).to.equal(true);expect(s[1].start).to.not.equal(undefined)})
 it('blocks new submissions while a current review has no release date',()=>{expect(planSequence([make('A','2027-01-10')],{...settings,blocked:true})[0].start).to.equal(undefined)})
 it('orders known quality before fit and unknown quality last',()=>{const a=make('A','2027-01-10'),b={...a,id:'B',rank:'B'},u={...a,id:'U',rank:null};expect(qualityOrder([u,b,a],{U:100,B:99,A:80}).map(v=>v.id)).to.deep.equal(['A','B','U'])})
})

describe('Dynamic sequential choices',()=>{
 it('recalculates available options after choosing a previous review window',async()=>{const {sequenceChoices}=await import('@/features/plugins/submission-sequence');const a=make('A','2027-01-10','2027-02-01'),b=make('B','2027-01-25','2027-03-01'),c=make('C','2027-02-10','2027-03-10');const choices=sequenceChoices([a,b,c],[a],settings,time('2028-01-01'));expect(choices.find(x=>x.venue.id==='B')!.conflict).to.be.a('string');expect(choices.find(x=>x.venue.id==='C')!.conflict).to.equal(null)})
 it('reports horizon conflicts and selects a near-term initial target',async()=>{const {sequenceChoices,initialSequenceChoice}=await import('@/features/plugins/submission-sequence');const late=make('A','2027-11-01','2028-02-01'),near=make('B','2027-02-01','2027-04-01');expect(initialSequenceChoice([late,near],settings,time('2028-01-01'))?.id).to.equal('B');expect(sequenceChoices([late],[],settings,time('2028-01-01'))[0].conflict).to.include('horizon')})
})

describe('Manual journal windows',()=>{it('preserves manual dates and flags overlapping reviews',()=>{const venues=[{id:'J1',kind:'journal',events:[]},{id:'J2',kind:'journal',events:[]}] as unknown as Venue[];const rows=planSequence(venues,{...settings,reviewWindows:{J2:{start:time('2027-02-01'),end:time('2027-05-01')}}});expect(rows[1].start).to.equal(time('2027-02-01'));expect(rows[1].end).to.equal(time('2027-05-01'));expect(rows[1].conflict).to.include('overlaps')})})
describe('Conflict intersections',()=>{it('returns only the actual overlap, not the whole window',async()=>{const {reviewOverlap}=await import('@/features/plugins/submission-sequence');expect(reviewOverlap({start:10*86400000,end:30*86400000},{start:20*86400000,end:40*86400000})).to.deep.equal({start:20*86400000,end:30*86400000});expect(reviewOverlap({start:10,end:20},{start:20,end:40})).to.equal(null)})})

describe('Overlap threshold',()=>{it('ignores under 24h and includes exactly 24h',async()=>{const {reviewOverlap}=await import('@/features/plugins/submission-sequence');expect(reviewOverlap({start:0,end:86400000},{start:1,end:2*86400000})).to.equal(null);expect(reviewOverlap({start:0,end:86400000},{start:0,end:2*86400000})).to.deep.equal({start:0,end:86400000})})})
describe('Author-response conditional transfer branch',()=>{it('schedules after author response and separates red/yellow overlap intervals',async()=>{const {reviewConflictSegments}=await import('@/features/plugins/submission-sequence');const conference=make('C','2027-01-10');conference.events.push(event('Author response starts','2027-02-01'),event('Initial notification','2027-02-10'),event('Final notification','2027-03-01'));const journal={id:'J',kind:'journal',events:[]} as unknown as Venue;const steps=planSequence([conference,journal],settings);expect(steps[0].end).to.equal(time('2027-02-01'));expect(steps[1].start).to.equal(time('2027-02-08'));const overlap=reviewConflictSegments({venue:journal,start:time('2027-01-20'),end:time('2027-02-20')},[steps[0]]);expect(overlap).to.deep.equal([{start:time('2027-01-20'),end:time('2027-02-01'),kind:'hard'},{start:time('2027-02-01'),end:time('2027-02-20'),kind:'conditional'}])})})

describe('Manuscript-fit first suggestion',()=>{it('prefers stronger fit over rank and proximity while excluding infeasible targets',async()=>{const {initialSequenceChoice}=await import('@/features/plugins/submission-sequence');const near=make('Near','2027-01-10','2027-03-01'),fit={...make('Fit','2027-05-01','2027-06-01'),rank:'B'},expired=make('Expired','2026-12-01');expect(initialSequenceChoice([near,fit,expired],settings,time('2028-01-01'),{Near:60,Fit:95,Expired:100})?.id).to.equal('Fit')})})

describe('Alternative journal scheduling',()=>{it('ignores stale candidate dates but preserves the currently edited window',async()=>{const {sequenceChoices}=await import('@/features/plugins/submission-sequence');const journal={id:'J',title:'Journal',kind:'journal',events:[]} as unknown as Venue;const custom={...settings,reviewWindows:{J:{start:time('2026-12-01'),end:time('2027-02-01')}}};expect(sequenceChoices([journal],[],custom,time('2028-01-01'))[0].conflict).to.equal(null);expect(sequenceChoices([journal],[],custom,time('2028-01-01'))[0].step.start).to.equal(settings.start);expect(sequenceChoices([journal],[],custom,time('2028-01-01'),'J')[0].conflict).to.be.a('string')})})


describe('Continuous AI recommendation sequence',()=>{
 const journal={id:'J',title:'Journal',kind:'journal',events:[]} as unknown as Venue
 it('fills eighteen months with independent journal instances and default review lengths',()=>{
  const horizon=time('2028-07-01'), venues=recommendSequence([journal],settings,horizon,{J:90}), steps=planSequence(venues,settings)
  expect(steps.length).to.be.greaterThan(4);expect(new Set(venues.map(v=>v.id)).size).to.equal(venues.length)
  steps.forEach((s,i)=>{expect(s.start!).to.be.lessThan(horizon);expect(s.end!-s.start!).to.equal(defaultReviewDays(s.start!)*86400000);if(i)expect(s.start).to.equal(steps[i-1].end!+7*86400000)})
  expect(steps.at(-1)!.end!+7*86400000).to.be.at.least(horizon)
 })
 it('uses Track dates and allows only warning overlap after response',()=>{
  const c=make('C','2027-01-10','2027-04-01');c.events.push(event('Author response','2027-02-01'))
  const venues=recommendSequence([c,journal],settings,time('2027-06-01'),{C:99,J:80}),steps=planSequence(venues,settings)
  expect(venues[0].id).to.equal('C');expect(steps[1].start).to.equal(time('2027-02-08'))
  expect(reviewConflictSegments(steps[1],[steps[0]]).map(s=>s.kind)).to.deep.equal(['conditional'])
  const strict={...settings,allowWarning:false}, strictSteps=planSequence(recommendSequence([c,journal],strict,time('2027-06-01'),{C:99,J:80}),strict)
  expect(strictSteps[1].start).to.equal(time('2027-04-08'));expect(reviewConflictSegments(strictSteps[1],[strictSteps[0]])).to.deep.equal([])
 })
 it('skips expired gates and unknown dates and terminates when no candidates remain',()=>{
  const gated=make('G','2027-01-10','2027-02-01');gated.events.push(event('Abstract','2026-12-30'))
  expect(recommendSequence([gated,make('U','2027-02-01')],settings,time('2028-01-01'))).to.deep.equal([])
  expect(recommendSequence([journal],{...settings,blocked:true},time('2028-01-01'))).to.deep.equal([])
 })
})

describe('Fixed conference opportunities in mixed plans',()=>{
 const journal={id:'J',title:'Journal',kind:'journal',events:[]} as unknown as Venue
 it('keeps a comparable conference before a journal would consume its deadline',()=>{
  const c=make('C','2027-02-01','2027-04-01')
  const plan=recommendSequence([journal,c],settings,time('2028-01-01'),{J:95,C:88})
  expect(plan[0].id).to.equal('C');expect(plan.some(v=>v.kind==='journal')).to.equal(true)
 })
 it('does not force an unsuitable conference or a missed abstract gate',()=>{
  const c=make('C','2027-02-01','2027-04-01')
  expect(recommendSequence([journal,c],settings,time('2028-01-01'),{J:95,C:60})[0].id).to.equal('J')
  c.events.push(event('Abstract','2026-12-01'))
  expect(recommendSequence([journal,c],settings,time('2028-01-01'),{J:95,C:99}).some(v=>v.id==='C')).to.equal(false)
 })
})

describe('Adapted manuscript branches',()=>{
 const variant={kind:'adapted' as const,key:'tool-paper',summary:'Distinct tool contribution',changes:['Package and evaluate the tool']}
 it('schedules a new manuscript before original release without moving the original chain',()=>{
  const tool={...make('T','2027-02-01','2027-04-01'),manuscriptVariant:variant}
  const journal={id:'J',kind:'journal',events:[]} as Venue
  const context={...settings,start:time('2027-06-01'),adaptedStart:time('2027-01-01')}
  const plan=planSequence([tool,journal],context)
  expect(plan[0].start).to.equal(time('2027-02-01'));expect(plan[1].start).to.equal(time('2027-06-01'))
  expect(recommendSequence([tool,journal],context,time('2028-01-01'),{T:90,J:92})[0].id).to.equal('T')
  expect(recommendSequence([tool],{...context,blocked:true},time('2028-01-01'))[0].id).to.equal('T')
 })
 it('ignores cross-manuscript overlaps but preserves conflicts within the same adapted draft',()=>{
  const original={venue:make('O','2027-01-01','2027-06-01'),start:time('2027-01-01'),end:time('2027-06-01')}
  const tool={venue:{...make('T','2027-02-01','2027-04-01'),manuscriptVariant:variant},start:time('2027-02-01'),end:time('2027-04-01')}
  expect(reviewConflictSegments(tool,[original])).to.deep.equal([])
  expect(reviewConflictSegments(tool,[{...tool,venue:{...tool.venue,id:'T2'}}])).not.to.deep.equal([])
  const second={...make('T2','2027-03-01','2027-05-01'),manuscriptVariant:variant}
  expect(planSequence([tool.venue,second],settings)[1].conflict).to.include('before the previous')
 })
})

describe('Workshop submission versus notification',()=>{
 it('retains the real conflicting paper deadline instead of submitting on notification day',()=>{
  const issta=make('I','2027-01-11','2027-06-17');issta.events.push(event('Author response starts','2027-03-22'))
  const workshop={...make('W','2027-03-02'),events:[event('Workshop Proposal Deadline','2026-12-02'),event('Workshop Proposal Notification','2026-12-11'),event('Workshop Paper Submission Deadline','2027-03-02'),event('Workshop Paper Notification','2027-04-06')]}
  const steps=planSequence([issta,workshop],settings)
  expect(steps[1].start).to.equal(time('2027-03-02'));expect(steps[1].end).to.equal(time('2027-04-06'));expect(steps[1].conflict).to.exist
  expect(reviewConflictSegments(steps[1],[steps[0]])).to.deep.equal([{start:time('2027-03-02'),end:time('2027-03-22'),kind:'hard'},{start:time('2027-03-22'),end:time('2027-04-06'),kind:'conditional'}])
  expect(recommendSequence([issta,workshop],settings,time('2028-01-01'),{I:95,W:90}).some(v=>v.id==='W')).to.equal(false)
 })
 it('does not use paper notification as a submission when no submission date is known',()=>{
  const v={...make('W','2027-03-02'),events:[event('Workshop Paper Notification','2027-04-06')]}
  expect(planSequence([v],settings)[0].start).to.equal(undefined)
 })
})

describe('Quality-first feasible manuscript opportunities',()=>{
 it('does not spend the original manuscript on a C conference before a similarly suitable A journal',()=>{
  const high={id:'T',title:'TOSEM',kind:'journal',rank:'A',events:[]} as unknown as Venue
  const lower={...make('EASE','2027-02-01','2027-03-01'),rank:'C'}
  expect(recommendSequence([lower,high],settings,time('2028-01-01'),{EASE:95,T:89})[0].id).to.equal('T')
 })
 it('prioritizes shorter decisions among equally ranked and similarly suitable conferences',()=>{
  const slow=make('Slow','2027-01-15','2027-06-01'),fast=make('Fast','2027-02-01','2027-03-01')
  expect(recommendSequence([slow,fast],{...settings,allowWarning:false},time('2028-01-01'),{Slow:95,Fast:90})[0].id).to.equal('Fast')
 })
 it('does not promote a poor-fit A venue merely for prestige',()=>{
  const high={id:'T',title:'TOSEM',kind:'journal',rank:'A',events:[]} as unknown as Venue
  const lower={...make('Fit','2027-02-01','2027-03-01'),rank:'B'}
  expect(recommendSequence([lower,high],settings,time('2028-01-01'),{Fit:95,T:60})[0].id).to.equal('Fit')
 })
})

it('places a suitable A journal first even with more than ten points of fit difference',()=>{
 const high={id:'T',title:'TOSEM',kind:'journal',rank:'A',events:[]} as unknown as Venue
 const lower={id:'E',title:'ESE',kind:'journal',rank:'B',events:[]} as unknown as Venue
 expect(recommendSequence([lower,high],settings,time('2028-01-01'),{E:98,T:82})[0].id).to.equal('T')
})
