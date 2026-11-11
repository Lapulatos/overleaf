import {useEffect,useState} from 'react'
import {OLModal,OLModalHeader,OLModalTitle,OLModalBody} from '@/shared/components/ol/ol-modal'
import {FetchError} from '@/infrastructure/fetch-json'
import {getJSON} from '@/infrastructure/fetch-json'
import type {Venue} from './submission-deadlines'
import './venue-acceptance.css'
type RecordRow={year:number;submitted:number|null;accepted:number|null;rate:number|null;source:string|null;note:string|null}
type History={records:RecordRow[];throughYear:number;source:string;fetched:number;stale:boolean}
function HistoryChart({records}:{records:RecordRow[]}){
 const [selected,setSelected]=useState<number|null>(null)
 const years=records.map(r=>r.year),first=Math.min(...years),last=Math.max(...years)
 const maximum=Math.max(100,Math.ceil(Math.max(...records.map(r=>r.submitted||0))/100)*100)
 const x=(year:number)=>76+(last===first?355:710*(year-first)/(last-first))
 const y=(r:RecordRow,kind:'submitted'|'rate')=>240-(kind==='rate'?r.rate!:r.submitted!/maximum)*180
 const format=(r:RecordRow,kind:'submitted'|'rate')=>kind==='rate'?(r.rate!*100).toFixed(1)+'%':r.submitted!.toLocaleString()
 const colors={submitted:'#397ec0',rate:'#397458'},step=Math.max(1,Math.ceil(records.length/7))
 const boxes:Array<{x:number;y:number;width:number}>=[]
 const labels=records.flatMap((r,i)=>{if(i%step&&i!==records.length-1)return [];return (['submitted','rate'] as const).flatMap(kind=>{if(r[kind]===null)return [];const text=format(r,kind),width=text.length*7+10,left=x(r.year)-width/2,cy=y(r,kind);let top=cy+(kind==='rate'?22:-12);for(const candidate of [top,cy-12,cy+22]){if(candidate<38||candidate>263)continue;if(!boxes.some(b=>left<b.x+b.width&&left+width>b.x&&Math.abs(candidate-b.y)<17)){top=candidate;boxes.push({x:left,y:top,width});return [{text,x:x(r.year),y:top,color:colors[kind]}]}}return []})})
 const active=selected===null?null:records[selected]
 return <section className="acceptance-chart"><h3>Submissions &amp; acceptance rate</h3><div className="acceptance-chart-legend"><span><i style={{background:colors.submitted}}/>Submissions · left axis</span><span><i className="is-dashed" style={{borderColor:colors.rate}}/>Acceptance rate · right axis</span></div>
 <div className="acceptance-chart-scroll"><svg viewBox="0 0 870 300" role="img" aria-label="Submissions and acceptance rate by year" onMouseLeave={()=>setSelected(null)}>
 {[0,.25,.5,.75,1].map(t=><g key={t}><line x1="76" x2="786" y1={240-180*t} y2={240-180*t} stroke="#dce5df"/><text x="64" y={244-180*t} textAnchor="end" style={{fill:colors.submitted}}>{Math.round(t*maximum).toLocaleString()}</text><text x="798" y={244-180*t} style={{fill:colors.rate}}>{Math.round(t*100)}%</text></g>)}
 {(['submitted','rate'] as const).map(kind=><g key={kind}>{records.map((r,i)=>{const next=records[i+1];return next&&r[kind]!==null&&next[kind]!==null?<line key={i} x1={x(r.year)} y1={y(r,kind)} x2={x(next.year)} y2={y(next,kind)} stroke={colors[kind]} strokeWidth="2.5" strokeDasharray={kind==='rate'?'7 4':undefined}/>:null})}{records.filter(r=>r[kind]!==null).map((r,i)=><circle key={i} cx={x(r.year)} cy={y(r,kind)} r="4.5" fill={colors[kind]}/>)}</g>)}
 {labels.map((item,i)=><text key={i} x={item.x} y={item.y} textAnchor="middle" className="acceptance-value-label" style={{fill:item.color}}>{item.text}</text>)}
 {active&&<line x1={x(active.year)} x2={x(active.year)} y1="38" y2="248" stroke="#7b8c83" strokeDasharray="3 3"/>}
 {records.map((r,i)=>{const left=i?(x(records[i-1].year)+x(r.year))/2:60,right=i<records.length-1?(x(r.year)+x(records[i+1].year))/2:796;return <rect key={i} x={left} y="30" width={Math.max(1,right-left)} height="230" fill="transparent" tabIndex={0} role="button" aria-label={`${r.year}: ${r.submitted===null?'Unreported':r.submitted} submissions, ${r.rate===null?'unreported acceptance rate':format(r,'rate')}`} onMouseEnter={()=>setSelected(i)} onFocus={()=>setSelected(i)} onBlur={()=>setSelected(null)}><title>{r.year} · Submitted: {r.submitted??'—'} · Accepted: {r.accepted??'—'} · Rate: {r.rate===null?'—':format(r,'rate')}</title></rect>})}
 {Array.from(new Set(years)).filter((_,i,a)=>i%step===0||i===a.length-1).map(year=><text key={year} x={x(year)} y="282" textAnchor="middle">{year}</text>)}
 </svg></div><p className="acceptance-point-detail" aria-live="polite">{active?<><strong>{active.year}</strong> · Submitted: {active.submitted?.toLocaleString()??'—'} · Accepted: {active.accepted?.toLocaleString()??'—'} · Acceptance rate: {active.rate===null?'—':format(active,'rate')}</>:'Hover or focus a year to see submissions, accepted papers and acceptance rate.'}</p></section>
}
export default function VenueAcceptanceDialog({venue,onHide}:{venue:Venue;onHide:()=>void}){
 const [data,setData]=useState<History|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');getJSON<History>('/writing-assist/submission-deadlines/acceptance?id='+encodeURIComponent(venue.parentVenueId||venue.id),{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setData(result)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof FetchError&&e.data?.error?String(e.data.error):e instanceof Error?e.message:'Statistics unavailable.')});return()=>controller.abort()},[venue.id,venue.parentVenueId,retry])
 const records=(data?.records||[]).filter(r=>venue.year!==null&&r.year<=venue.year).sort((a,b)=>a.year-b.year)
 return <OLModal show onHide={onHide} size="lg" className="venue-acceptance-modal" aria-labelledby="venue-acceptance-title"><OLModalHeader closeButton><OLModalTitle id="venue-acceptance-title">{venue.title} {venue.year} · Submissions &amp; acceptance</OLModalTitle></OLModalHeader><OLModalBody>
 <p>{venue.description}</p><p className="acceptance-context">Reported years through {venue.year}. Statistics may cover different paper categories or review rounds; see each annual source. They are not a manuscript acceptance prediction.</p>
 {error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>Retry statistics</button></div>:!data?<p role="status">Loading historical statistics…</p>:<>{data.stale&&<p role="status">Showing saved statistics. Updates run in the background when the source is available.</p>}{records.length?<><HistoryChart records={records}/><details className="acceptance-table"><summary>Annual data &amp; sources</summary><div><table><thead><tr><th>Year</th><th>Submitted</th><th>Accepted</th><th>Acceptance rate</th><th>Source</th></tr></thead><tbody>{records.map((r,i)=><tr key={i}><th>{r.year}</th><td>{r.submitted?.toLocaleString()??'—'}</td><td>{r.accepted?.toLocaleString()??'—'}</td><td>{r.rate===null?'—':(r.rate*100).toFixed(1)+'%'}</td><td>{r.source?<a href={r.source} target="_blank" rel="noopener noreferrer">Annual source ↗</a>:'Not supplied'}{r.note&&<small>{r.note}</small>}</td></tr>)}</tbody></table></div></details></>:<p>No historical statistics reported through {venue.year}. Missing years are not treated as zero.</p>}<p className="acceptance-source"><a href={data.source} target="_blank" rel="noopener noreferrer">CCFDDL statistics ↗</a> · Retrieved {new Date(data.fetched).toLocaleDateString()} · Missing years are omitted; lines connect reported observations.</p></>}
 </OLModalBody></OLModal>
}
