import type {Venue} from './submission-deadlines'
export type SequenceSettings={prioritizeQuality?:boolean;start:number;adaptedStart?:number;gapDays:number;reviewDays:Record<string,number>;withdrawals:Record<string,string>;blocked?:boolean;conditional?:boolean;allowWarning?:boolean;reviewWindows?:Record<string,{start:number;end:number}>}
export type SequenceStep={venue:Venue;start?:number;end?:number;deadline?:number;gate?:number;conditional:boolean;withdrawal:boolean;reason:string;conflict?:string;conflictRange?:{start:number;end:number}}
const day=86400000
const timestamp=(event:{utc?:string|null;date?:string},end=false)=>event.utc?Date.parse(event.utc):event.date?Date.parse(event.date+(end?'T23:59:59Z':'T00:00:00Z')):NaN
export const isPaperSubmission=(label:string)=>/paper|submission/i.test(label)&&!/revision|camera|abstract|registration|final version|decision|notification|acceptance|response|rebuttal|proposal|review/i.test(label)
export function defaultReviewDays(start:number){const end=new Date(start);const date=end.getDate();end.setDate(1);end.setMonth(end.getMonth()+3);end.setDate(Math.min(date,new Date(end.getFullYear(),end.getMonth()+1,0).getDate()));return Math.round((end.getTime()-start)/day)}
export function qualityOrder(venues:Venue[],scores:Record<string,number>={}){
 const rank=(v:Venue)=>({A:3,B:2,C:1}[v.ranks?.ccf||v.rank||'']||0)
 const core=(v:Venue)=>({'A*':4,A:3,B:2,C:1}[v.ranks?.core||'']||0)
 return [...venues].sort((a,b)=>rank(b)-rank(a)||core(b)-core(a)||(scores[b.id]||0)-(scores[a.id]||0)||a.title.localeCompare(b.title))
}
export function manuscriptBranch(v:Venue){return v.manuscriptVariant?.kind==='adapted'?'adapted:'+v.manuscriptVariant.key:'original'}
function branchSettings(v:Venue,settings:SequenceSettings):SequenceSettings{return manuscriptBranch(v)==='original'?settings:{...settings,start:settings.adaptedStart??settings.start,blocked:false,conditional:false}}
export function planSequence(venues:Venue[],settings:SequenceSettings):SequenceStep[]{
 const groups=new Map<string,Venue[]>()
 return venues.map(v=>{const key=manuscriptBranch(v),group=groups.get(key)||[];group.push(v);groups.set(key,group);return planSingleSequence(group,branchSettings(v,settings)).at(-1)!})
}
function planSingleSequence(venues:Venue[],settings:SequenceSettings):SequenceStep[]{
 let available=settings.start,uncertain=Boolean(settings.conditional),blocked=Boolean(settings.blocked)
 return venues.map(venue=>{
  const row:SequenceStep={venue,conditional:uncertain,withdrawal:false,reason:''}
  if(blocked){row.reason='Previous submission has no known release date. Confirm rejection or effective withdrawal before planning this step.';return row}
  const events=venue.milestones||venue.events||[]
  if(venue.kind==='journal'){row.start=settings.reviewWindows?.[venue.id]?.start??available;if(row.start<available)row.conflict='Planned submission overlaps the previous review or preparation window (or starts before today).'}
  else{
   const paper=events.filter(e=>isPaperSubmission(e.label)).map(e=>timestamp(e)).filter(Number.isFinite).sort((a,b)=>a-b)
   const deadline=paper.find(t=>t>=available)??paper.at(-1);row.deadline=deadline
   if(deadline===undefined){row.reason='Submission deadline is not confirmed.';blocked=true;return row}
   if(deadline<available)row.conflict='Submission deadline is before the previous review/withdrawal and preparation window.'
   const gates=events.filter(e=>/abstract|registration/i.test(e.label)).map(e=>timestamp(e)).filter(t=>Number.isFinite(t)&&t<=deadline)
   row.gate=gates.length?Math.min(...gates):undefined
   if(!row.conflict&&row.gate!==undefined&&row.gate<available){row.conflictRange={start:row.gate,end:available};row.reason='Abstract / registration cutoff conflicts with the previous submission or preparation window.';blocked=true;return row}
   row.start=deadline
  }
  const withdrawal=Date.parse(settings.withdrawals[venue.id]?settings.withdrawals[venue.id]+'T23:59:59Z':'')
  if(Number.isFinite(withdrawal)){
   if(withdrawal<row.start!){row.reason='Withdrawal date must be on or after this planned submission.';row.start=undefined;blocked=true;return row}
   row.end=withdrawal;row.withdrawal=true;row.conditional=true
  }else if(venue.kind==='journal'){
   const days=settings.reviewDays[venue.id],manual=settings.reviewWindows?.[venue.id]
   if(manual&&Number.isFinite(manual.end)&&manual.end>row.start!)row.end=manual.end
   else if(Number.isFinite(days)&&days>0)row.end=row.start!+days*day
   else row.end=row.start!+defaultReviewDays(row.start!)*day
   row.conditional=true
  }else{
   const decisions=events.filter(e=>/decision|notification|acceptance/i.test(e.label)&&!/response|rebuttal/i.test(e.label)).map(e=>timestamp(e,true)).filter(t=>Number.isFinite(t)&&t>=row.start!)
   const response=events.filter(e=>/response|rebuttal/i.test(e.label)&&!/ends?|closing/i.test(e.label)).map(e=>timestamp(e)).filter(t=>Number.isFinite(t)&&t>=row.start!);const initial=response.length&&decisions.length?response:events.filter(e=>/initial|early.reject|first.*(?:decision|notification)/i.test(e.label)&&/decision|notification|reject/i.test(e.label)).map(e=>timestamp(e,true)).filter(t=>Number.isFinite(t)&&t>=row.start!)
   if(settings.allowWarning!==false&&initial.length){row.end=Math.min(...initial);row.conditional=true}else if(decisions.length)row.end=Math.max(...decisions)
  }
  if(row.end===undefined){row.reason=venue.kind==='journal'?'Enter an estimated review duration to explore a conditional continuation.':'Decision date is not confirmed. Subsequent submissions cannot yet be scheduled.';blocked=true;return row}
  if(row.conflict)row.conflictRange={start:row.start!,end:Math.min(available,row.end)}
  row.reason=row.conflict||(row.withdrawal?'Continue only after withdrawal takes effect; requesting withdrawal or receiving low scores is not sufficient.':venue.kind==='journal'?'Estimated review window, not a guaranteed rejection date. Continue only after actual rejection or effective withdrawal.':'Conditional transfer checkpoint: submit elsewhere only after effective withdrawal or confirmed rejection. Response scores are not a rejection; final notification remains visible.')
  available=Math.max(available,row.end)+Math.max(0,settings.gapDays)*day;uncertain=uncertain||row.conditional
  return row
 })
}

export function sequenceChoices(venues:Venue[],chosen:Venue[],settings:SequenceSettings,horizon:number,preserveWindowFor?:string){
 const used=new Set(chosen.map(v=>v.id))
 return venues.filter(v=>v.kind==='journal'||!used.has(v.id)).map(venue=>{
  const candidate=venue.kind==='journal'&&used.has(venue.id)?{...venue,id:venue.id+'::preview'}:venue
  const choiceSettings=venue.kind==='journal'&&!used.has(venue.id)&&venue.id!==preserveWindowFor?{...settings,reviewWindows:Object.fromEntries(Object.entries(settings.reviewWindows||{}).filter(([id])=>id!==venue.id))}:settings
  const step=planSequence([...chosen,candidate],choiceSettings).at(-1)!
  const conflict=step.conflict|| (step.start===undefined?step.reason:step.start>horizon?'Submission falls outside the planning horizon.':step.end!==undefined&&step.end>horizon?'Review outcome falls outside the planning horizon.':null)
  return {venue,step,conflict}
 })
}
export function initialSequenceChoice(venues:Venue[],settings:SequenceSettings,horizon:number,scores?:Record<string,number>){
 const choices=sequenceChoices(venues,[],settings,horizon).filter(c=>!c.conflict)
 if(scores&&choices.some(c=>Number.isFinite(scores[c.venue.id])))return [...choices].sort((a,b)=>(scores[b.venue.id]??-1)-(scores[a.venue.id]??-1)||(a.step.start!-b.step.start!))[0]?.venue
 const near=choices.filter(c=>c.step.start!<=settings.start+90*day)
 return (near.find(c=>c.step.end!==undefined)||near[0]||choices.find(c=>c.step.end!==undefined)||choices[0])?.venue
}

// Construct a conditional fallback chain, not simultaneous submissions.
export function recommendSequence(venues:Venue[],settings:SequenceSettings,horizon:number,scores:Record<string,number>={}):Venue[]{
 const groups=new Map<string,Venue[]>()
 for(const v of venues){const key=manuscriptBranch(v);groups.set(key,[...(groups.get(key)||[]),v])}
 const result=[...groups.values()].flatMap(group=>recommendBranchSequence(group,branchSettings(group[0],settings),horizon,scores))
 const times=new Map(planSequence(result,settings).map(s=>[s.venue.id,s.start??Infinity]))
 return result.sort((a,b)=>times.get(a.id)!-times.get(b.id)!)
}
function recommendBranchSequence(venues:Venue[],settings:SequenceSettings,horizon:number,scores:Record<string,number>={}):Venue[]{
 if(settings.blocked||settings.start>=horizon)return []
 const result:Venue[]=[],uses=new Map<string,number>();let available=settings.start
 const fresh={...settings,reviewDays:{},reviewWindows:{}}
 while(available<horizon){
  const feasible=venues.filter(v=>v.kind==='journal'||!uses.has(v.id)).flatMap(v=>{
   const count=uses.get(v.id)||0,candidate=count?{...v,id:v.id+'::plan:auto'+count}:v
   const step=planSequence([...result,candidate],fresh).at(-1)!
   return step.start!==undefined&&step.end!==undefined&&!step.conflict&&step.start<horizon&&step.end>available?[{venue:v,candidate,step,count}]:[]
  })
  if(!feasible.length)break
  // Scores describe fit, never acceptance probability. Restrict quality comparisons
  // to candidates with suitable assessed fit (70+), so prestige cannot rescue a poor fit.
  const leastUses=Math.min(...feasible.map(c=>c.count))
  const freshPool=feasible.filter(c=>c.count===leastUses)
  const strongestFit=Math.max(...freshPool.map(c=>scores[c.venue.id]??0))
  const fitFloor=strongestFit>=70?70:strongestFit-10
  const pool=freshPool.filter(c=>(scores[c.venue.id]??0)>=fitFloor)
  const quality=(v:Venue)=>({A:3,B:2,C:1}[v.ranks?.ccf||v.rank||'']||({'A*':3,A:3,B:2,C:1}[v.ranks?.core||'']||0))
  // A lower-tier early opportunity must not displace a suitable higher-tier target.
  // Among comparable quality, shorter outcome windows preserve more opportunities.
  pool.sort((a,b)=>(settings.prioritizeQuality===false?(scores[b.venue.id]??0)-(scores[a.venue.id]??0):quality(b.venue)-quality(a.venue))||a.step.end!-b.step.end!||(scores[b.venue.id]??0)-(scores[a.venue.id]??0)||a.step.start!-b.step.start!||a.venue.id.localeCompare(b.venue.id))
  const first=pool[0]
  const conference=settings.prioritizeQuality!==false&&first.venue.kind==='journal'?pool.filter(c=>c.venue.kind==='conference'&&quality(c.venue)>=quality(first.venue)&&(c.step.gate??c.step.start!)<first.step.end!+Math.max(0,settings.gapDays)*day).sort((a,b)=>quality(b.venue)-quality(a.venue)||a.step.end!-b.step.end!||(scores[b.venue.id]??0)-(scores[a.venue.id]??0))[0]:undefined
  const best=conference||first;result.push(best.candidate);uses.set(best.venue.id,best.count+1);available=best.step.end!+Math.max(0,settings.gapDays)*day
 }
 return result
}

export function reviewOverlap(a:{start?:number;end?:number},b:{start?:number;end?:number}){if(a.start===undefined||a.end===undefined||b.start===undefined||b.end===undefined)return null;const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);return end-start>=day?{start,end}:null}

export type ReviewPeriod={venue:Venue;start?:number;end?:number}
export function reviewPhases(period:ReviewPeriod){
 const events=period.venue.milestones||period.venue.events||[]
 const initial=period.venue.kind==='conference'?events.filter(e=>/initial|early.reject|first.*(?:decision|notification)/i.test(e.label)&&/decision|notification|reject/i.test(e.label)).map(e=>timestamp(e,true)).filter(t=>Number.isFinite(t)&&(period.start===undefined||t>=period.start)):[]
 const decisions=events.filter(e=>/decision|notification|acceptance/i.test(e.label)&&!/response|rebuttal/i.test(e.label)).map(e=>timestamp(e,true)).filter(Number.isFinite)
 const response=period.venue.kind==='conference'?events.filter(e=>/response|rebuttal/i.test(e.label)&&!/ends?|closing/i.test(e.label)).map(e=>timestamp(e)).filter(t=>Number.isFinite(t)&&(period.start===undefined||t>=period.start)):[]
 const first=response.length&&decisions.length?Math.min(...response):initial.length?Math.min(...initial):undefined,last=decisions.length?Math.max(...decisions):undefined
 return {hard:{start:period.start,end:first!==undefined&&period.end!==undefined?Math.min(first,period.end):period.end},tail:first!==undefined&&last!==undefined&&last>first?{start:first,end:last}:null}
}
export function reviewConflictSegments(current:ReviewPeriod,others:ReviewPeriod[]){
 const a=reviewPhases(current),ranges:Array<{start:number;end:number;kind:'hard'|'conditional'}>=[]
 for(const other of others){if(manuscriptBranch(current.venue)!==manuscriptBranch(other.venue))continue;const b=reviewPhases(other);const hard=reviewOverlap(a.hard,b.hard);if(hard)ranges.push({...hard,kind:'hard'});for(const pair of [[a.tail,b.hard],[a.hard,b.tail],[a.tail,b.tail]]){if(pair[0]&&pair[1]){const overlap=reviewOverlap(pair[0],pair[1]);if(overlap)ranges.push({...overlap,kind:'conditional'})}}}
 const bounds=[...new Set(ranges.flatMap(r=>[r.start,r.end]))].sort((a,b)=>a-b),result:typeof ranges=[]
 for(let i=0;i<bounds.length-1;i++){const start=bounds[i],end=bounds[i+1],active=ranges.filter(r=>r.start<end&&r.end>start);if(!active.length)continue;const kind=active.some(r=>r.kind==='hard')?'hard':'conditional';const previous=result.at(-1);if(previous&&previous.kind===kind&&previous.end===start)previous.end=end;else result.push({start,end,kind})}
 return result
}
