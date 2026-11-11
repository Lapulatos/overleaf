import {createContext,useContext} from 'react'
import type {Venue} from './submission-deadlines'
// Reviewed publisher statements, not AI-generated scores. Never label a snapshot "latest".
const acm2026='https://prod-www.acm.bloomreach.cloud/media-center/2026/july/impact-factors-2026'
export const journalMetrics:Record<string,{jif?:number;year:number;release:number;category:string;rank:string;source:string;checked:string}>={
 'journal-csur':{jif:30.4,year:2025,release:2026,category:'Computer Science, Theory & Methods',rank:'#1',source:acm2026,checked:'2026-11-03'},
 'journal-tosem':{year:2025,release:2026,category:'Computer Science, Software Engineering',rank:'#8 (tied)',source:acm2026,checked:'2026-11-03'},
}
export type MetricSnapshot={name:string;sources?:{url:string;label:string;checked?:string;edition?:string;fields?:string[]}[];auditNote?:string;eiProceedings?:string;eiPaper?:string;eiEdition?:string;source?:string;checked?:string;sci?:string;ei?:string;jif?:{value:number;edition:string}|null;jcr?:{category:string;quartile:string;rank:string|null}[];jcrEdition?:string;cas?:{edition:string;division:number}|null;xinrui?:{edition:string;division:number}|null;lastAttempt?:{status:string;checked:string;reason?:string}}
export const MetricContext=createContext<Record<string,MetricSnapshot>>({})
export const venueMetricKey=(v:Venue)=>v.kind+':'+v.description.normalize('NFKC').toLowerCase().replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'')+(v.kind==='journal'?'':':'+v.year)
export function journalImpactFactor(venue:Venue,saved?:MetricSnapshot){
 if(venue.kind!=='journal')return null
 const fallback=journalMetrics[venue.id]?.jif
 const value=(saved?.jif||(fallback!==undefined?{value:fallback}:null))?.value
 return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null
}
export function journalQuartile(venue:Venue,saved?:MetricSnapshot){
 if(venue.kind!=='journal'||!saved?.jcr?.length||!saved.jcr.every(q=>/^Q[1-4]$/.test(q.quartile)))return null
 return Math.min(...saved.jcr.map(q=>Number(q.quartile.slice(1))))
}
export default function VenueMetrics({venue,showSources=true,compact=false,hidePrimaryLink=false}:{venue:Venue;showSources?:boolean;compact?:boolean;hidePrimaryLink?:boolean}){
 const snapshots=useContext(MetricContext);const saved=snapshots[venueMetricKey(venue)]
 const journal=venue.kind==='journal';const metric=journal?journalMetrics[venue.id]:undefined
 const known=(value?:string)=>!!value&&!/not verified|unverified|unknown|not confirmed|pending|planned|uncertain/i.test(value)
 const values:{label:string;value:string;title?:string}[]=[]
 if(journal){
  if(known(saved?.sci))values.push({label:'SCI/SCIE',value:saved!.sci!})
  if(known(saved?.ei))values.push({label:'EI',value:saved!.ei!})
  const jif=saved?.jif||(metric?.jif!==undefined?{value:metric.jif,edition:String(metric.year)}:null)
  if(jif&&Number.isFinite(jif.value)&&jif.value>=0)values.push({label:'JIF',value:`${jif.value} (${jif.edition})`})
  if(saved?.jcr?.length&&saved.jcr.every(q=>/^Q[1-4]$/.test(q.quartile)))values.push({label:'JCR',value:`${[...new Set(saved.jcr.map(q=>q.quartile))].join(' / ')} (${saved.jcrEdition})`,title:saved.jcr.map(q=>`${q.category}: ${q.quartile}${q.rank?' ('+q.rank+')':''}`).join('; ')})
  if(saved?.cas)values.push({label:'CAS division',value:`${saved.cas.division} (${saved.cas.edition})`})
  if(saved?.xinrui)values.push({label:'Xinrui division',value:`${saved.xinrui.division} (${saved.xinrui.edition})`})
 }else{
  if(known(saved?.eiProceedings))values.push({label:'EI proceedings',value:saved!.eiProceedings!})
  if(known(saved?.eiPaper))values.push({label:'EI paper inclusion',value:saved!.eiPaper!})
 }
 const conferenceLink=!hidePrimaryLink&&!journal&&venue.kind==='conference'&&venue.website&&/^https?:\/\//i.test(venue.website)?venue.website:null
 const sourceList=[...(saved?.sources||[])]
 if(journal&&venue.website&&/^https?:\/\//i.test(venue.website)&&!sourceList.some(source=>source.label==='Publisher'))sourceList.unshift({url:venue.website,label:'Publisher'})
 const sources=sourceList.filter(source=>!hidePrimaryLink||source.label!=='Publisher').sort((a,b)=>Number(b.label==='Publisher')-Number(a.label==='Publisher'))
 if(!values.length&&(compact||(!conferenceLink&&!sources.length)))return null
 const Container=compact?'span':'div'
 return <Container className="venue-metrics" aria-label={`${venue.title} indexing and metrics`}>
 <span className="venue-metric-values">{values.map(value=><span key={value.label} title={value.title}>{value.label} · {value.value}</span>)}</span>
 {!compact&&(sources.length>0||conferenceLink)?<small className="venue-metric-source" title={saved?.auditNote}>{conferenceLink&&<a href={conferenceLink} target="_blank" rel="noopener noreferrer">Conference Link ↗</a>}{sources.map((source,i)=><span key={source.url}>{i>0||conferenceLink?' · ':''}<a href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.fields?.join(', ')||'Supplemental data'} · ${source.edition||''} · Checked ${source.checked?.slice(0,10)||saved?.checked?.slice(0,10)}`}>{source.label} ↗</a></span>)}{saved?.checked&&<> · Checked {saved.checked.slice(0,10)}</>}{saved?.lastAttempt?.status==='failed'&&' · Update failed; saved values retained'}</small>:null}

 {!compact&&showSources&&<details><summary>Indexing &amp; metric sources</summary>{metric&&<p>Publisher-reported JCR rank {metric.rank} · {metric.category} · {metric.release} release ({metric.year} metrics). <a href={metric.source} target="_blank" rel="noopener noreferrer">Publisher source ↗</a> · Checked {metric.checked}. This is a dated snapshot, not an automatic latest-edition feed.</p>}
 <p>{journal?'JCR quartiles and CAS divisions are different systems; category and edition must be verified separately. Missing data does not mean the journal is not indexed.':'Proceedings indexing must be confirmed for this edition or volume. Planned indexing and previous editions do not confirm current inclusion. Journal metrics must not be inherited from a proceedings series or a special-issue journal.'}</p><div className="deadline-resource-links"><a href="https://mjl.clarivate.com/" target="_blank" rel="noopener noreferrer">Web of Science / SCI / SCIE ↗</a><a href="https://www.engineeringvillage.com/" target="_blank" rel="noopener noreferrer">EI Compendex ↗</a>{journal&&<><a href="https://jcr.clarivate.com/" target="_blank" rel="noopener noreferrer">JCR / Journal Impact Factor ↗</a><a href="https://www.fenqubiao.com/" target="_blank" rel="noopener noreferrer">CAS division source ↗</a></>}</div></details>}</Container>
}
