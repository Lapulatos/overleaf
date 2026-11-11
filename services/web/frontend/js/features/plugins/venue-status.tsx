import type {Venue} from './submission-deadlines'
export function submissionStatus(venue:Venue,now:number){
 const papers=venue.events.filter(e=>e.label==='Paper');const stamps=papers.map(e=>Date.parse(e.utc||''));
 if(papers.length&&stamps.every(t=>Number.isFinite(t)&&t<=now))return {kind:'closed',label:'Submission closed',description:'The paper deadline for this round has passed. Topic fit only; this is not an open submission opportunity.'}
 const gate=venue.events.find(e=>['Registration','Abstract'].includes(e.label)&&e.utc&&Date.parse(e.utc)<=now)
 if(gate)return {kind:'gated',label:`${gate.label} deadline passed`,description:'Check whether prior registration or an abstract is required. A future paper deadline does not mean new submissions are permitted.'}
 if(stamps.some(t=>Number.isFinite(t)&&t>now))return {kind:'future',label:'Paper deadline upcoming',description:'Confirm the opening date and eligibility in the official call.'}
 return {kind:'unknown',label:venue.schedule==='rolling'?'Rolling submissions · check availability':'Submission dates unconfirmed',description:'The catalog does not establish whether submissions are currently open.'}
}
export function SubmissionStatus({venue,now,compact=false}:{venue:Venue;now:number;compact?:boolean}){const status=submissionStatus(venue,now);return <div className={`venue-submission-status is-${status.kind}`} title={compact?status.description:undefined}><strong>{status.label}</strong>{!compact&&<p>{status.description}</p>}</div>}
