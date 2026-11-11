import type {Fit} from './venue-recommendations'
import type { Venue } from './submission-deadlines'
import {VenueCard,venueKey} from './venue-display'
export function registrationNotice(venue:Venue,now:number){
 const passed=venue.events.find(e=>['Registration','Abstract'].includes(e.label)&&e.utc&&Date.parse(e.utc)<=now)
 const paper=venue.events.find(e=>e.label==='Paper'&&e.utc&&Date.parse(e.utc)>now)
 if(!paper)return null
 return passed?`${passed.label} deadline has passed. New submissions may be closed; confirm whether an existing registration is required in the official rules.`:'Check the registration and abstract requirements before the paper deadline. Registration requirements are not confirmed by this catalog.'
}
export default function DeadlineTimeline({projectId,venues,now,onSelect,saved=[],onTrack=()=>{},fits={} }:{projectId?:string;venues:Venue[];now:number;onSelect:(venue:Venue)=>void;saved?:string[];onTrack?:(id:string)=>void;fits?:Record<string,Fit>}){
 return <section className="deadline-agenda" aria-label="Submission deadline timeline"><h3>Venue timelines</h3><p>Local dates are shown below. Each line is scaled within its own venue; registration, submission, review and conference dates are separate milestones.</p>{venues.map(venue=><VenueCard projectId={projectId} key={venue.id} venue={venue} now={now} onSelect={onSelect} fit={fits[venue.id]} tracked={saved.includes(venueKey(venue.id))} onTrack={()=>onTrack(venue.id)}/>)}</section>
}
