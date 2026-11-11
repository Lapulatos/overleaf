import {trackFitSummary} from './track-fit-summary'
import {useCallback,useState} from 'react'
import VenueRecommendations,{type Recommendations} from './venue-recommendations'
import type {Venue} from './submission-deadlines'

export default function ConferenceTrackRecommendations({projectId,venue,onSelect}:{projectId:string;venue:Venue;onSelect:(venue:Venue)=>void}){
 const [result,setResult]=useState<Recommendations|null>(null)
 const [activityTarget,setActivityTarget]=useState<HTMLDivElement|null>(null)
 const receive=useCallback((value:Recommendations)=>setResult(value),[])
 return <section className="venue-track-recommendations" aria-label={`${venue.title} Track recommendations`}>
  <header><strong>Best-fitting conference Tracks</strong><VenueRecommendations hideCompletedActivity projectId={projectId} scopeVenueId={venue.id} buttonLabel={result?'Recheck Track fit':'Recommend Tracks for my paper'} onResult={receive} activityTarget={activityTarget}/></header>
  <div ref={setActivityTarget}/>
  {result&&<details className="venue-track-results"><summary>Recommended Tracks · {result.recommendations.length}{result.recommendations[0]&&<> · Best fit: {result.recommendations[0].venue.track?.title||result.recommendations[0].venue.round}</>}</summary><ol>{result.recommendations.map((item,index)=>{const brief=trackFitSummary(item);return <li key={item.venue.id}><div className="venue-track-fit-heading"><button type="button" onClick={()=>onSelect(item.venue)}>{index===0?'Best fit · ':''}{item.venue.track?.title||item.venue.round}</button><span>Fit {item.score}/100</span></div><div className="venue-track-brief"><section><strong>Why it fits</strong><ul>{brief.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul></section>{item.eligibility&&<section className={'venue-track-eligibility '+item.eligibility.status}><strong>{item.eligibility.status==='met'?'Prerequisites met':item.eligibility.status==='unmet'?'Not yet met':'Needs confirmation'}</strong>{brief.issues.length>0&&<ul>{brief.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}</section>}</div><details className="venue-track-full-analysis"><summary>View detailed analysis</summary><p>{item.reason}</p>{item.eligibility&&<p>{item.eligibility.reason}</p>}</details>{item.venue.website&&<a href={item.venue.website} target="_blank" rel="noopener noreferrer">Official Track call ↗</a>}</li>})}</ol>{!result.recommendations.length&&<p>No suitable Track was established from the available evidence.</p>}{result.limitations.length>0&&<details><summary>Evidence limits</summary><ul>{result.limitations.map((item,index)=><li key={index}>{item}</li>)}</ul></details>}</details>}
 </section>
}
