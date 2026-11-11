import {useEffect,useRef,useState} from 'react'
import {cachedTracks,loadTracks,type ConferenceTrack} from './conference-tracks'
import {trackNavigationState} from './track-navigation'
import type {Venue} from './submission-deadlines'
import {submissionStatus} from './venue-status'
// Fetch only visible cards, bounded across the list; shared cache also serves details.
const queue=new Map<string,Set<()=>boolean>>()
let active=0
function drain(){while(active<2&&queue.size){const [id,watchers]=queue.entries().next().value!;queue.delete(id);if(![...watchers].some(valid=>valid()))continue;active++;void loadTracks(id).catch(()=>{}).finally(()=>{active--;drain()})}}
export function trackAvailability(venue:Venue,tracks:ConferenceTrack[]|undefined,now:number){
 const closed:string[]=[];const open:string[]=[]
 for(const track of tracks||[]){const state=trackNavigationState(track,now);if(state.color==='closed')closed.push(track.title);if(state.color==='open'||state.color==='soon')open.push(track.title)}
 // Catalog dates describe this named round only, never all conference Tracks.
 if(!tracks?.some(t=>t.isMain&&trackNavigationState(t,now).color!=='unknown')){const state=submissionStatus(venue,now);const label=venue.round&&!/^Directory entry/i.test(venue.round)?venue.round:'Main submission';if(state.kind==='closed')closed.push(label);else if(state.kind==='future')open.push(label)}
 return {closed:[...new Set(closed)],open:[...new Set(open)]}
}
export default function VenueTrackAvailability({venue,now}:{venue:Venue;now:number}){
 const ref=useRef<HTMLDivElement>(null);const [tracks,setTracks]=useState(()=>cachedTracks(venue.id)?.tracks)
 useEffect(()=>{let valid=true;const update=()=>{if(valid)setTracks(cachedTracks(venue.id)?.tracks)};window.addEventListener('venue-tracks-loaded',update);update();const available=()=>valid
 const enqueue=()=>{if(cachedTracks(venue.id))return;const watchers=queue.get(venue.id)||new Set();watchers.add(available);queue.set(venue.id,watchers);drain()}
 let observer:IntersectionObserver|undefined
 if(typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer?.disconnect();enqueue()}},{rootMargin:'120px'});if(ref.current)observer.observe(ref.current)}
 return()=>{valid=false;observer?.disconnect();queue.get(venue.id)?.delete(available);window.removeEventListener('venue-tracks-loaded',update)}
 },[venue.id])
 const groups=trackAvailability(venue,tracks,now)
 return <div ref={ref} className="venue-track-availability" aria-label="Track submission availability">{!!groups.closed.length&&<div className="venue-submission-status is-closed"><strong>Submission closed:</strong> <span>{groups.closed.join(', ')}</span></div>}{!!groups.open.length&&<div className="venue-submission-status is-open"><strong>Submission open:</strong> <span>{groups.open.join(', ')}</span></div>}</div>
}
