import type {Fit} from './venue-recommendations'
import {useState,useEffect} from 'react'
import {cachedTracks,loadTracks,trackVenue} from './conference-tracks'
import {VenueSummaryCard,venueFullName,areaName,rating,ratingLabel} from './venue-display'
import type { Venue, DeadlineEvent } from './submission-deadlines'
export function calendarDayKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function calendarEvents(venues:Venue[]){const days=new Map<string,{venue:Venue;event:DeadlineEvent}[]>();for(const venue of venues.filter(v=>v.kind!=='journal'))for(const event of venue.events){if(!event.utc&&!event.date||!Number.isFinite(Date.parse(event.utc||event.date!)))continue;const key=event.utc?calendarDayKey(new Date(event.utc)):event.date!;const items=days.get(key)||[];items.push({venue,event});days.set(key,items)}for(const items of days.values())items.sort((a,b)=>Date.parse(a.event.utc||a.event.date!)-Date.parse(b.event.utc||b.event.date!));return days}
export default function DeadlineCalendar({venues,now,month,onMonth,onSelect,fits={}}:{fits?:Record<string,Fit>;venues:Venue[];now:number;month:Date;onMonth:(month:Date)=>void;onSelect:(venue:Venue)=>void}){
 const [day,setDay]=useState<string|null>(null);const [,refreshTracks]=useState(0)
 const conferences=venues.filter(v=>v.kind==='conference'&&v.website&&!v.parentVenueId);const ids=conferences.map(v=>v.id).join('|')
 useEffect(()=>{const update=()=>refreshTracks(n=>n+1);window.addEventListener('venue-tracks-loaded',update);return()=>window.removeEventListener('venue-tracks-loaded',update)},[])
 useEffect(()=>{let cancelled=false;let cursor=0;const queue=conferences.filter(v=>!cachedTracks(v.id));Promise.all(Array.from({length:Math.min(2,queue.length)},async()=>{for(;;){if(cancelled)return;const item=queue[cursor++];if(!item)return;try{await loadTracks(item.id)}catch{/* Source status remains available in the conference detail. */}}}));return()=>{cancelled=true}},[ids]) // eslint-disable-line react-hooks/exhaustive-deps
 const calendarVenues=venues.flatMap(v=>{const data=cachedTracks(v.id);if(!data)return [v];const children=data.tracks.filter(t=>t.events.length).map(t=>trackVenue(v,t));return [...(data.tracks.some(t=>t.isMain&&t.events.length)?[]:[v]),...children]});const events=calendarEvents(calendarVenues)

 const first=new Date(month.getFullYear(),month.getMonth(),1);const offset=(first.getDay()+6)%7
 const cells=Array.from({length:42},(_,i)=>new Date(month.getFullYear(),month.getMonth(),1-offset+i))
 const today=calendarDayKey(new Date(now));const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone
 const monthLabel=month.toLocaleDateString('en',{month:'long',year:'numeric'})
 function move(delta:number){onMonth(new Date(month.getFullYear(),month.getMonth()+delta,1));setDay(null)}
 return <section className="deadline-calendar" aria-label="Submission calendar">
  <div className="deadline-calendar-nav"><div><h3>{monthLabel}</h3><small>Dates shown in {timezone}</small></div><div><button type="button" aria-label="Previous month" onClick={()=>move(-1)}>←</button><button type="button" onClick={()=>{onMonth(new Date(now));setDay(today)}}>Today</button><button type="button" aria-label="Next month" onClick={()=>move(1)}>→</button></div></div>

  <div className="deadline-calendar-legend"><span className="is-abstract">● Registration / abstract</span><span className="is-paper">● Paper deadline</span></div>
  <div className="deadline-calendar-scroll"><table aria-label={monthLabel+' submission deadlines'}><thead><tr>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{Array.from({length:6},(_,week)=><tr key={week}>{cells.slice(week*7,week*7+7).map(date=>{const key=calendarDayKey(date);const items=events.get(key)||[];return <td key={key} className={`${date.getMonth()!==month.getMonth()?'outside-month ':''}${key===today?'is-today ':''}${key===day?'is-selected-day':''}`}><button type="button" className="deadline-day-number" aria-label={`Events on ${key}`} aria-pressed={key===day} onClick={()=>setDay(key)}>{date.getDate()}</button><div className="deadline-day-items">{items.slice(0,3).map(({venue,event},i)=><button type="button" key={venue.id+event.label+i} className={`deadline-calendar-event ${event.label==='Paper'?'is-paper':'is-abstract'} ${Date.parse(event.utc||event.date!)<now?'is-past':''}`} title={`${venue.title} ${venue.year||''} · ${venue.round}\n${event.label}: ${event.original} ${event.timezone}\nLocal: ${event.utc?new Date(event.utc).toLocaleString():'Time not confirmed'}`} onClick={()=>onSelect(venue)}><strong>{venue.title} {venue.year||''}{venue.parentVenueId?' · '+venue.round:''}</strong><span>{event.label}</span></button>)}{items.length>3&&<button type="button" className="deadline-more-events" aria-label={`Show all ${items.length} events on ${key}`} onClick={()=>setDay(key)}>+{items.length-3} more</button>}</div></td>})}</tr>)}</tbody></table></div>

  {day&&<section className="deadline-day-events" aria-label="Selected day events"><h4>{day} · {events.get(day)?.length||0} events</h4><div className="venue-recommendation-names">{Array.from(new Set((events.get(day)||[]).map(item=>item.venue.id))).map(id=>{const items=events.get(day)!.filter(item=>item.venue.id===id);const venue=items[0].venue;return <VenueSummaryCard key={id} venue={venue} now={now} onSelect={onSelect} fit={fits[id]} dayEvents={items.map(item=>item.event)}/>})}</div>{!events.get(day)?.length&&<p>No dates from the current catalog on this day.</p>}</section>}

 </section>
}

function UndatedGroup({title,venues,onSelect,initiallyOpen=false}:{title:string;venues:Venue[];onSelect:(venue:Venue)=>void;initiallyOpen?:boolean}){
 const [page,setPage]=useState(0)
 const [open,setOpen]=useState(initiallyOpen)
 const pages=Math.ceil(venues.length/6)
 return <details className="deadline-undated-group" open={open} onToggle={e=>{if(e.target===e.currentTarget)setOpen(e.currentTarget.open)}}><summary><strong>{title}</strong><span>{venues.length}</span></summary>{open&&<>
  <ul className="deadline-undated-list">{venues.slice(page*6,page*6+6).map(v=><li key={v.id}><button type="button" onClick={()=>onSelect(v)} aria-label={`View requirements for ${v.title} ${v.year||''}`}><span className="deadline-undated-name"><strong>{v.title} {v.year||''}</strong><span>{venueFullName(v)}</span></span><span className="deadline-undated-meta"><span>{areaName(v.area)}</span><span>{ratingLabel('ccf',rating(v,'ccf'))}</span><small>{v.schedule==='rolling'?'Rolling submissions':v.kind==='journal'?'Submission dates to confirm':'Dates not announced'}</small></span><span className="deadline-undated-arrow" aria-hidden="true">→</span></button></li>)}</ul>
  {pages>1&&<nav className="deadline-undated-pagination" aria-label={`${title} pages`}><span>{page*6+1}–{Math.min((page+1)*6,venues.length)} of {venues.length}</span><div><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button type="button" disabled={page===pages-1} onClick={()=>setPage(p=>p+1)}>Next</button></div></nav>}
 </>}</details>
}
export function UndatedVenues({venues,onSelect}:{venues:Venue[];onSelect:(venue:Venue)=>void}){
 const undated=venues.filter(v=>!v.events.some(e=>e.utc&&Number.isFinite(Date.parse(e.utc))))
 const journals=undated.filter(v=>v.kind==='journal');const conferences=undated.filter(v=>v.kind!=='journal')
 if(!undated.length)return null
 return <section className="deadline-undated" aria-label="Venues without confirmed dates"><header><h4>Venues without confirmed dates</h4><p>Not placed on the calendar. Current search, filters and sort order apply.</p></header>{[{title:'Journals',rows:journals},{title:'Conferences · dates to confirm',rows:conferences}].filter(g=>g.rows.length).map((g,i)=><UndatedGroup key={g.title+g.rows.map(v=>v.id).join('|')} title={g.title} venues={g.rows} onSelect={onSelect} initiallyOpen={i===0}/>)}</section>
}
