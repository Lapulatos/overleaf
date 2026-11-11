import {isPaperSubmission} from './submission-sequence'
import type {Venue} from './submission-deadlines'
import type {ConferenceTrack} from './conference-tracks'
export function plannerTracks(parent:Venue,tracks:ConferenceTrack[]):Venue[]{return tracks.map(track=>({...parent,id:track.id,parentVenueId:parent.id,track,round:track.title,website:track.url,events:track.events,milestones:track.events}))}
export function plannerName(v:Venue){return `${v.title}${v.year?' '+v.year:''} (${v.kind==='journal'?'Journal':'Conference'})${v.kind==='conference'?' · '+(v.track?.title||'Track not selected'):''}`}
export function reviewWindow(v:Venue|undefined,now:number,estimate=''){
 const stamp=(e:Venue['events'][number],end=false)=>e.utc?Date.parse(e.utc):e.date?Date.parse(e.date+(end?'T23:59:59Z':'T00:00:00Z')):NaN
 const events=v?.milestones||v?.events||[]
 const past=events.filter(e=>isPaperSubmission(e.label)).map(e=>stamp(e)).filter(t=>Number.isFinite(t)&&t<=now)
 const decisions=events.filter(e=>/decision|notification|acceptance/i.test(e.label)&&!/response|rebuttal/i.test(e.label)).map(e=>stamp(e,true)).filter(t=>Number.isFinite(t))
 const initial=events.filter(e=>/initial|early.reject|first.*(?:decision|notification)/i.test(e.label)&&/decision|notification|reject/i.test(e.label)).map(e=>stamp(e,true)).filter(t=>Number.isFinite(t))
 const response=events.filter(e=>/response|rebuttal/i.test(e.label)&&!/ends?|closing/i.test(e.label)).map(e=>stamp(e)).filter(t=>Number.isFinite(t))
 const futureResponse=response.filter(t=>t>=now),futureInitial=initial.filter(t=>t>=now)
 const official=v?.kind==='conference'&&v.track&&decisions.length?(futureResponse.length?Math.min(...futureResponse):futureInitial.length?Math.min(...futureInitial):Math.max(...decisions)):undefined
 const estimated=estimate?Date.parse(estimate+'T23:59:59'):NaN
 return {checkpoint:futureResponse.length>0&&official!==undefined,start:past.length?Math.max(...past):now,end:official??(Number.isFinite(estimated)&&estimated>=now?estimated:undefined),estimated:official===undefined,knownStart:past.length>0}
}
export const plannerMilestoneKinds={abstract:{label:'Abstract / registration',short:'Abstract',color:'#b07b29'},paper:{label:'Paper submission',short:'Paper',color:'#287149'},response:{label:'Response / rebuttal',short:'Response',color:'#397ec0'},decision:{label:'Decision / notification',short:'Decision',color:'#8249b9'},camera:{label:'Camera-ready',short:'Final version',color:'#c86b2b'},conference:{label:'Conference',short:'Conference',color:'#278790'},other:{label:'Other milestone',short:'Milestone',color:'#697783'}}
export function plannerMilestones(v:Venue,parent?:Venue){
 const events=[...(v.milestones||v.events||[]),...(parent?.milestones||parent?.events||[]).filter(e=>/conference|symposium|event starts/i.test(e.label))]
 const seen=new Set<string>()
 return events.flatMap(e=>{const time=e.utc?Date.parse(e.utc):e.date?Date.parse(e.date+'T12:00:00Z'):NaN;if(!Number.isFinite(time))return [];const key=e.label+'|'+time;if(seen.has(key))return [];seen.add(key)
 const kind=/conference|symposium|event starts/i.test(e.label)?'conference':/camera.ready|final version/i.test(e.label)?'camera':/decision|notification|acceptance/i.test(e.label)?'decision':/response|rebuttal/i.test(e.label)?'response':/abstract|registration/i.test(e.label)?'abstract':/paper|submission/i.test(e.label)?'paper':'other'
 return [{time,kind,...plannerMilestoneKinds[kind],fullLabel:e.label,original:e.original,timezone:e.timezone}]
 }).sort((a,b)=>a.time-b.time)
}

export function plannerOptionName(v:Venue){return `${v.title}${v.year?' '+v.year:''} (${v.description||v.title}) · ${v.kind==='journal'?'Journal':v.track?.title||'Conference — choose Track'}`}
export function snapPlannerDate(value:number,targets:number[],span:number,width:number){const nearest=targets.reduce((a,b)=>Math.abs(b-value)<Math.abs(a-value)?b:a,value+span);return Math.abs(nearest-value)/span*width<=8?nearest:value}

export function automaticPlanningTargets(expanded:Venue[],assessed:Venue[]){
 const explicit=new Set(assessed.filter(v=>v.track).map(v=>v.id))
 return expanded.filter(v=>v.kind==='journal'||explicit.has(v.id)||Boolean(v.track?.isMain))
}
