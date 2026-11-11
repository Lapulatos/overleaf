import type {Venue} from './submission-deadlines'
export function remainingTime(utc:string|null,now:number){
 const end=Date.parse(utc||'');if(!Number.isFinite(end))return 'Date unconfirmed'
 const delta=end-now;if(delta<=0)return 'Closed';if(delta<60000)return 'Less than 1 min left'
 const minutes=Math.floor(delta/60000);const days=Math.floor(minutes/1440);const hours=Math.floor(minutes%1440/60);const mins=minutes%60
 return `${days?`${days}d `:''}${days||hours?`${hours}h `:''}${mins}m left`
}
export function elapsedTime(utc:string,now:number){
 const minutes=Math.max(0,Math.floor((now-Date.parse(utc))/60000));const days=Math.floor(minutes/1440);const hours=Math.floor(minutes%1440/60);return `${days}d ${hours}h ${minutes%60}m past`
}
export default function VenueCountdown({venue,now,compact=false,showOtherDeadlines=true}:{venue:Venue;now:number;compact?:boolean;showOtherDeadlines?:boolean}){
 const events=venue.events.filter(e=>['Registration','Abstract','Paper'].includes(e.label));
 const submission=events.filter(e=>e.utc&&Date.parse(e.utc)>now).sort((a,b)=>Date.parse(a.utc!)-Date.parse(b.utc!))[0]
 const next=submission||(venue.milestones||[]).filter(e=>e.utc&&Date.parse(e.utc)>now).sort((a,b)=>Date.parse(a.utc!)-Date.parse(b.utc!))[0]
 const past=!next?[...events,...(venue.milestones||[])].filter(e=>e.utc&&Date.parse(e.utc)<=now).sort((a,b)=>Date.parse(b.utc!)-Date.parse(a.utc!))[0]:undefined
 const urgent=submission&&next&&Date.parse(next.utc!)-now<=3*86400000
 if(!events.length&&!next&&!past)return null
 if(past&&!compact)return <div className="venue-countdown is-milestone is-past" aria-label={`${venue.title} elapsed milestone`}><div className="venue-countdown-next"><span>Last milestone · {past.label}</span><strong>{elapsedTime(past.utc!,now)}</strong><time dateTime={past.utc!}>{new Date(past.utc!).toLocaleString()}</time></div></div>
 if(compact)return next?<span className={`venue-countdown-compact${urgent?' is-urgent':''}${!submission?' is-milestone':''}`}><span>{submission?'Next deadline':'Next milestone'} · {next.label}</span><strong>{remainingTime(next.utc,now)}</strong></span>:null
 return <div className={`venue-countdown${urgent?' is-urgent':''}${!submission?' is-milestone':''}`} aria-label={`${venue.title} submission countdown`}>
 {next&&<div className="venue-countdown-next"><span>{submission?'Next submission deadline':'Next milestone · not a submission deadline'} · {next.label}</span><strong>{remainingTime(next.utc,now)}</strong><time dateTime={next.utc!}>{new Date(next.utc!).toLocaleString()}</time></div>}
 {showOtherDeadlines&&<div className="venue-countdown-events">{events.filter(event=>event!==next&&(!event.utc||Date.parse(event.utc)>now)).map((event,i)=><div key={i} className={event.utc&&Date.parse(event.utc)<=now?'is-closed':''}><span>{event.label}</span><strong>{remainingTime(event.utc,now)}</strong></div>)}</div>}
 </div>
}
