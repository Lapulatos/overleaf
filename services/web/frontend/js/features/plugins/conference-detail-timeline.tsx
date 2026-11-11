import CalendarExportActions from './calendar-export-actions'
import {conferenceCalendarEntries} from './calendar-export'
import {useEffect,useState} from 'react'
import type {Venue,DeadlineEvent} from './submission-deadlines'
import {cachedTracks,loadTracks,trackVenue,type ConferenceTrack} from './conference-tracks'
import TimelinePoint from './timeline-point'
import {remainingTime,elapsedTime} from './venue-countdown'
export type DetailMilestone=DeadlineEvent&{stamp:number;dateOnly:boolean;tracks:string[];sources:string[]}
export function detailCategory(label:string){
 if(/abstract/i.test(label))return {key:'abstract',label:'Abstract',color:'#b7791f'}
 if(/registration|register/i.test(label))return {key:'registration',label:'Registration',color:'#9b7930'}
 if(/camera.ready|final version/i.test(label))return {key:'camera',label:'Camera-ready',color:'#cc650e'}
 if(/rebuttal|response/i.test(label))return {key:'response',label:'Response',color:'#3178c6'}
 if(/decision|notification|acceptance/i.test(label))return {key:'decision',label:'Decision',color:'#8a4fc4'}
 if(/paper|submission|deadline/i.test(label))return {key:'paper',label:'Paper',color:'#237a53'}
 if(/conference|symposium|workshop|starts|ends/i.test(label))return {key:'conference',label:'Conference',color:'#16828c'}
 return {key:'other',label:'Other',color:'#718096'}
}
function calendarDate(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return NaN;const [y,m,d]=date.split('-').map(Number);const value=new Date(y,m-1,d);return value.getFullYear()===y&&value.getMonth()===m-1&&value.getDate()===d?value.getTime():NaN}
export function collectDetailMilestones(venue:Venue,tracks:ConferenceTrack[]=[]){
 const merged=new Map<string,DetailMilestone>()
 const baseEvents=[...(venue.milestones||[]),...venue.events]
 const rows=[...baseEvents.map(event=>({event,track:venue.round,source:venue.website||venue.sourceUrl})),...tracks.filter(track=>track.status==='retrieved').flatMap(track=>track.events.filter(event=>!(track.isMain&&!event.utc&&event.date&&baseEvents.some(known=>known.utc&&known.original.slice(0,10)===event.date&&detailCategory(known.label).key===detailCategory(event.label).key))).map(event=>({event,track:track.title,source:event.source||track.url})))]
 for(const {event,track,source} of rows){const dateOnly=!event.utc;const stamp=dateOnly?calendarDate(event.date||''):Date.parse(event.utc!);if(!Number.isFinite(stamp))continue;const key=`${dateOnly?'day':'time'}:${stamp}:${detailCategory(event.label).key}`;const existing=merged.get(key);if(existing){if(track&&!existing.tracks.includes(track))existing.tracks.push(track);if(source&&!existing.sources.includes(source))existing.sources.push(source)}else merged.set(key,{...event,stamp,dateOnly,tracks:track?[track]:[],sources:source?[source]:[]})}
 return [...merged.values()].sort((a,b)=>a.stamp-b.stamp||a.label.localeCompare(b.label))
}
export function nearestMilestones(events:DetailMilestone[],now:number){const today=new Date(now);today.setHours(0,0,0,0);const upcoming=events.filter(e=>e.stamp>=(e.dateOnly?today.getTime():now));return upcoming.length?upcoming.slice(0,2):events.slice(-2).reverse()}
function daysApart(stamp:number,now:number){const a=new Date(stamp);const b=new Date(now);return Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())-Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()))/86400000)}
function countdown(event:DetailMilestone,now:number){if(!event.dateOnly)return event.stamp>now?remainingTime(event.utc,now):elapsedTime(event.utc!,now);const days=daysApart(event.stamp,now);return days===0?'Today':days>0?`${days}d left`:`${-days}d past`}
export function detailTrackBranches(venue:Venue,tracks:ConferenceTrack[],now:number){
 const mainTracks=tracks.filter(t=>t.isMain&&t.status==='retrieved');const main={id:'main',title:mainTracks.map(t=>t.title).join(' / ')||'Main conference',events:collectDetailMilestones(venue,mainTracks),color:'#28765b',lane:0,first:0,last:0,fork:0,merge:0}
 const branches=tracks.filter(t=>!t.isMain).map((track,i)=>({id:track.id,title:track.title,events:collectDetailMilestones({...venue,events:[],milestones:[]},[track]),color:`hsl(${(210+i*137.508)%360} 58% 43%)`,lane:0,first:0,last:0,fork:0,merge:0}))
 const stamps=[now,...main.events.map(e=>e.stamp),...branches.flatMap(t=>t.events.map(e=>e.stamp))];const start=Math.min(...stamps);const end=Math.max(...stamps);const x=(stamp:number)=>80+820*(stamp-start)/Math.max(1,end-start);const occupied:number[]=[]
 const dated=branches.filter(t=>t.events.length).map(t=>({...t,first:x(t.events[0].stamp),last:x(t.events[t.events.length-1].stamp)})).sort((a,b)=>a.first-b.first||a.id.localeCompare(b.id))
 for(const branch of dated){branch.fork=branch.first-36;branch.merge=branch.last+36;let lane=occupied.findIndex(last=>last+18<branch.fork);if(lane<0)lane=occupied.length;occupied[lane]=branch.merge;branch.lane=lane+1}
 return {main,branches:dated,undated:branches.filter(t=>!t.events.length),x,start,end,height:100+occupied.length*48}
}
export function ConferenceTrackGraph({venue,tracks,now}:{venue:Venue;tracks:ConferenceTrack[];now:number}){
 const [active,setActive]=useState<string|null>(null);const model=detailTrackBranches(venue,tracks,now);const rows=[model.main,...model.branches];const highlighted=rows.find(t=>t.id===active);const categories=highlighted?[...new Map(highlighted.events.map(event=>{const c=detailCategory(event.label);return [c.key,c]})).values()]:[]
 const y=(lane:number)=>42+lane*48
 function activate(target:EventTarget|null){setActive(target instanceof Element?target.closest('[data-track-key]')?.getAttribute('data-track-key')||null:null)}
 return <div className="venue-detail-gitgraph" aria-label="Conference Track branches" onMouseMove={e=>activate(e.target)} onMouseLeave={()=>setActive(null)} onFocus={e=>activate(e.target)} onBlur={e=>{if(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget))setActive(null)}}>
 <div className="venue-axis-legend venue-detail-track-legend" aria-label={highlighted?`${highlighted.title} milestone categories`:'Track colors'}><div className="venue-track-names" style={{visibility:highlighted?'hidden':undefined}} aria-hidden={!!highlighted}>{rows.map(track=><span key={track.id}><i aria-hidden="true" style={{backgroundColor:track.color}}/>{track.title}</span>)}</div>{highlighted&&<div className="venue-track-active-legend"><strong>{highlighted.title}</strong>{categories.map(c=><span key={c.key}><i aria-hidden="true" style={{backgroundColor:c.color}}/>{c.label}</span>)}</div>}</div>
 <div className="venue-detail-graph-scroll"><div className="venue-detail-graph-canvas" style={{height:model.height}}><svg viewBox={`0 0 1000 ${model.height}`} preserveAspectRatio="none" aria-hidden="true">
 <path d="M 20 42 H 960" fill="none" stroke={model.main.color} strokeWidth={active==='main'?4:3} opacity={active&&active!=='main'?.2:1}/><path d="M 20 42 H 960" fill="none" stroke="transparent" strokeWidth="28" data-track-key="main" className="venue-branch-hit"/>
 {model.branches.map(track=>{const row=y(track.lane);const d=`M ${track.fork} 42 C ${track.fork+18} 42 ${track.first-18} ${row} ${track.first} ${row} H ${track.last} C ${track.last+18} ${row} ${track.merge-18} 42 ${track.merge} 42`;return <g key={track.id}><path d={d} data-track-line={track.id} fill="none" stroke={track.color} strokeWidth={active===track.id?4:3} opacity={active&&active!==track.id?.18:1} pointerEvents="none"/><path d={d} data-track-key={track.id} className="venue-branch-hit" fill="none" stroke="transparent" strokeWidth="26"/></g>})}
 <path d={`M ${model.x(now)} 22 V ${model.height-20}`} stroke="#b7791f" strokeDasharray="3 5" opacity=".5" pointerEvents="none"/>
 </svg><span className="venue-detail-graph-today" style={{left:`${model.x(now)/10}%`}}>Today</span>
 {rows.map(track=><div key={track.id} data-track-key={track.id} className={`venue-detail-track-points${active===track.id?' is-active':active?' is-muted':''}`}>{track.events.map((event,i)=><TimelinePoint key={i} className="venue-detail-track-point" style={{left:`${model.x(event.stamp)/10}%`,top:y(track.lane),backgroundColor:active===track.id?detailCategory(event.label).color:track.color}} label={`${track.title}: ${event.label}, ${event.original} ${event.timezone}`}><strong>{track.title} · {event.label}</strong><time>{event.dateOnly?event.date:new Date(event.utc!).toLocaleString()}</time><small>{event.original} · {event.timezone}</small></TimelinePoint>)}</div>)}
 </div></div>
 {model.undated.length>0&&<p className="deadline-footnote venue-undated-tracks">Dates not confirmed: <span>{model.undated.map(t=>t.title).join(', ')}</span></p>}
 </div>
}
export default function ConferenceDetailTimeline({venue,now}:{venue:Venue;now:number}){
 const [data,setData]=useState(()=>cachedTracks(venue.parentVenueId||venue.id));const [loading,setLoading]=useState(false);const [failed,setFailed]=useState(false)
 useEffect(()=>{let active=true;const id=venue.parentVenueId||venue.id;setData(cachedTracks(id));const update=()=>setData(cachedTracks(id));window.addEventListener('venue-tracks-loaded',update);if(!venue.parentVenueId){setLoading(true);loadTracks(id).then(value=>{if(active){setData(value);setFailed(false)}}).catch(()=>{if(active)setFailed(true)}).finally(()=>{if(active)setLoading(false)})}return()=>{active=false;window.removeEventListener('venue-tracks-loaded',update)}},[venue.id,venue.parentVenueId])
 const allTracks=venue.parentVenueId?[]:data?.tracks||[]
 const [chosenCycle,setChosenCycle]=useState('')
 const cycles=[...new Set(allTracks.filter(t=>t.isMain).flatMap(t=>t.events.map(e=>e.round).filter((r):r is string=>!!r)))].sort()
 const preferred=cycles.find(c=>allTracks.some(t=>t.isMain&&t.events.some(e=>e.round===c&&/paper submission deadline/i.test(e.label)&&Date.parse(e.utc||`${e.date}T23:59:59Z`)>now)))||cycles[cycles.length-1]
 const cycle=cycles.includes(chosenCycle)?chosenCycle:preferred
 const tracks=allTracks.map(t=>({...t,title:cycle&&t.events.some(e=>e.round)?`${t.title} · ${cycle}`:t.title,events:t.events.filter(e=>!e.round||e.round===cycle)}))
 // Official cycle-local dates take precedence over the flattened catalog dates.
 const timelineVenue=cycles.length?{...venue,events:[],milestones:[]}:venue
 const events=collectDetailMilestones(timelineVenue,tracks);const mainEvents=cycles.length?collectDetailMilestones(timelineVenue,tracks.filter(t=>t.isMain)):events;const next=nearestMilestones(mainEvents,now);const zones=[...new Set(events.filter(e=>!e.dateOnly).map(e=>e.timezone).filter(z=>z&&!/unknown|not confirmed/i.test(z)))];
 return <section data-venue-section="timeline" className="deadline-section venue-detail-timeline"><h3>Submission timeline</h3>
 {cycles.length>1&&<div className="venue-cycle-picker" role="group" aria-label="Submission cycle">{cycles.map(c=><button type="button" key={c} aria-pressed={c===cycle} onClick={()=>setChosenCycle(c)}>{c}{c===preferred?' · Next / latest':''}</button>)}</div>}
 <div className="venue-key-milestones">{next.map((event,i)=>{const category=detailCategory(event.label);return <article key={`${event.stamp}:${event.label}`} className="venue-key-milestone" style={{borderLeftColor:category.color}}><span>{(event.dateOnly?daysApart(event.stamp,now)<0:event.stamp<now)?'Recent milestone':i===0?'Next milestone':'Following milestone'} · {category.label}</span><strong>{countdown(event,now)}</strong><time dateTime={event.utc||event.date}>{event.dateOnly?event.date:new Date(event.utc!).toLocaleString()}</time><small>{event.label}{event.tracks.length?' · '+event.tracks.join(' / '):''}</small></article>})}</div>
 <ConferenceTrackGraph venue={timelineVenue} tracks={tracks} now={now}/>
 {loading&&<p className="deadline-footnote" role="status">Loading Track dates…</p>}{failed&&<p className="deadline-footnote">Track dates could not be loaded. The available conference dates are shown.</p>}
 <footer className="venue-official-schedule"><span>Official time{zones.length?' · '+zones.join(' / '):' · See the official schedule'}{events.some(e=>e.dateOnly)?' · Some dates have no published cutoff time.':''}</span>{venue.website&&<a href={venue.website} target="_blank" rel="noopener noreferrer">Official schedule &amp; Tracks ↗</a>}</footer>
 {!venue.parentVenueId&&<CalendarExportActions name={`${venue.title} ${venue.year || ""} · All Tracks`} entries={conferenceCalendarEntries(allTracks.map(track=>trackVenue(venue,track)))}/>}
 </section>
}
