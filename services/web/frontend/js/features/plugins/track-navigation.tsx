import {PaperTypeIcons} from './paper-type-icons'
import {useEffect,useState} from 'react'
import type {ConferenceTrack,TrackEvent} from './conference-tracks'

function eventDay(event:TrackEvent){
 if(event.utc){const value=Date.parse(event.utc);return Number.isFinite(value)?value:NaN}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(event.date||''))return NaN
 const [y,m,d]=event.date!.split('-').map(Number);const value=new Date(y,m-1,d)
 return value.getFullYear()===y&&value.getMonth()===m-1&&value.getDate()===d?value.getTime():NaN
}
function calendarDays(time:number,now:number){const a=new Date(time),b=new Date(now);return Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())-Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()))/86400000)}
function isPast(event:TrackEvent,now:number){return event.utc?eventDay(event)<now:calendarDays(eventDay(event),now)<0}
export function trackNavigationState(track:ConferenceTrack,now:number){
 const events=track.status==='retrieved'?track.events.filter(e=>Number.isFinite(eventDay(e))).slice().sort((a,b)=>eventDay(a)-eventDay(b)):[]
 const submissions=events.filter(e=>/submission|paper.*deadline|deadline.*paper|^paper$|^deadline$/i.test(e.label)&&!/camera.ready|final|revision|revised|rebuttal|response|abstract|registration|notification|decision/i.test(e.label))
 const upcoming=submissions.filter(e=>!isPast(e,now));const submission=upcoming[0]||submissions.at(-1)
 const color=submission?isPast(submission,now)?'closed':calendarDays(eventDay(submission),now)<=7?'soon':'open':'unknown'
 const next=events.find(e=>!isPast(e,now));const milestone=next||events.at(-1)
 const days=milestone?calendarDays(eventDay(milestone),now):null
 const elapsed=milestone?now-eventDay(milestone):0
 const countdown=days===null?null:milestone?.utc?elapsed>0?(elapsed<86400000?'<1d past':`${Math.floor(elapsed/86400000)}d past`):`${Math.ceil(-elapsed/86400000)}d left`:days<0?`${-days}d past`:days===0?'Today':`${days}d left`
 return {color,milestone,countdown,upcoming:!!next}
}
export default function TrackNavigation({tracks,onSelect}:{tracks:ConferenceTrack[];onSelect:(track:ConferenceTrack)=>void}){
 const [now,setNow]=useState(Date.now)
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[])
 return <div className="track-navigation" aria-label="Track navigation">{tracks.map(track=>{const state=trackNavigationState(track,now);return <button type="button" key={track.id} className={`track-navigation-card is-${state.color}`} onClick={()=>onSelect(track)}>
 <strong>{track.title}<PaperTypeIcons venue={{kind:"conference",track}}/></strong>
 <span className="track-navigation-status">{state.color==='closed'?'Submission deadline passed':state.color==='soon'?'Submission deadline soon':state.color==='open'?'Submission deadline upcoming':'Submission date not confirmed'}</span>
 {state.milestone?<><span className="track-navigation-next">{state.upcoming?'Next milestone':'Last milestone'} · {state.milestone.label}</span><b>{state.countdown}</b><time dateTime={state.milestone.utc||state.milestone.date}>{state.milestone.utc?new Date(state.milestone.utc).toLocaleString():state.milestone.date}</time></>:<span>{track.status==='unavailable'?'Source unavailable':'Dates not confirmed'}</span>}
 </button>})}</div>
}
