import {cfpCategories,categoryContent} from './CfpCategories.mjs'
import {extractTrackOverview} from './TrackOverview.mjs'
import * as cheerio from 'cheerio'
import {createHash} from 'node:crypto'
import {publicUrl} from './PublicPage.mjs'
const clean=s=>s.replace(/\s+/g,' ').trim()
export const trackSeparator='::track:'
export function trackLinks(html,url){
 const $=cheerio.load(html);const base=new URL(url);const edition=/\/(?:home|track)\/([^/]+)/.exec(base.pathname)?.[1];const found=new Map()
 $('a[href]').each((_,e)=>{if(!$(e).attr('href')||$(e).attr('href').startsWith('#'))return;const href=publicUrl($(e).attr('href'),url);const label=clean($(e).text());if(!href||!label||/^(?:how to submit|submission (?:instructions|guidelines|information)|author (?:instructions|guidelines)|call for papers|important dates|program|committee|registration|contact|sponsorship|keynotes?|.* keynotes)$/i.test(label))return;const u=new URL(href);u.hash='';const callMenu=/call for/i.test($(e).closest('ul').parent().children('a').first().text());const recruitment=/artifact evaluators?|reviewer recruitment/i.test(label);if(u.origin!==base.origin&&!(callMenu&&recruitment))return;const years=u.pathname.match(/20\d{2}/g)||[];const baseYear=base.pathname.match(/20\d{2}/)?.[0];if(baseYear&&years.some(year=>year!==baseYear))return
  if(edition){if(!u.pathname.startsWith(`/track/${edition}/`))return}else if(!/research papers?|technical papers?|artifact evaluation|posters?|tool demonstrations?|doctoral symposium|industry track|research track/i.test(label)&&!(callMenu&&/^(?:papers|artifacts|artifact evaluators|workshops)$/i.test(label))||/committee|program|accepted|\.pdf$/i.test(u.pathname))return
  if(!found.has(u.href))found.set(u.href,{title:label,url:u.href,...(recruitment?{submissionKind:'reviewer-recruitment'}:{})})
 });return [...found.values()]
}
const monthNames=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
function datePart(text){
 let m=/\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text);let year,month,day
 if(m){[,year,month,day]=m}else{m=/\b(\d{1,2})\s+(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\s+(20\d{2})\b/i.exec(text);if(m){day=m[1];month=monthNames.indexOf(m[2].slice(0,3).toLowerCase())+1;year=m[3]}else{m=/\b(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i.exec(text);if(!m)return null;day=m[2];month=monthNames.indexOf(m[1].slice(0,3).toLowerCase())+1;year=m[3]}}
 const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?{date,matched:m[0]}:null
}
// Table cells keep event names separate from their dates; do not derive a
// deadline from a paragraph that happens to mention another submission policy.
function structuredDates(content,url){
 const $=cheerio.load(content);const events=[];const seen=new Set()
 $('tr:not([href])').each((_,row)=>{
  const cells=$(row).children('td,th');if(cells.length!==2)return
  let label=clean(cells.eq(0).text());if(!/deadline|submission|notification|camera.ready|rebuttal|response|abstract|registration|papers? due|conference/i.test(label))return
  if(/^full papers? due$/i.test(label))label='Paper submission'
  const cell=cells.eq(1);const display=clean(cell.text());const original=cell.find('[data-original-deadline]').first().attr('data-original-deadline')||display
  const raw=original.replace(/\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?),?\s*/gi,'')
  const pieces=raw.split(/\s+[–—-]\s+/);let start=datePart(pieces[0]);const end=pieces.length===2?datePart(pieces[1]):null
  if(end&&!start){const monthYear=/([A-Za-z]+)\s+(20\d{2})/.exec(pieces[1]);if(monthYear&&/^\d{1,2}$/.test(pieces[0]))start=datePart(`${pieces[0]} ${monthYear[1]} ${monthYear[2]}`)}
  if(!start)return
  const utc=cell.find('[data-deadline-utc]').first().attr('data-deadline-utc');const validUtc=utc&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(utc)&&Number.isFinite(Date.parse(utc))?new Date(utc).toISOString():null
  const dates=end&&end.date>=start.date?[[start,' · starts'],[end,' · ends']]:[[start,'']]
  for(const [date,suffix] of dates){const id=label+suffix+date.date;if(seen.has(id))continue;seen.add(id);const exact=(!suffix||suffix===' · ends')?validUtc:null;events.push({label:label+suffix,date:date.date,original:label+' · '+original,utc:exact,timezone:exact?(/AoE/i.test(original)?'AoE (UTC−12)':'UTC'):'Time / timezone not confirmed',precision:exact?'datetime':'date',source:url})}
 });return events
}
export function trackSubmissionLinks(html,url){
 const $=cheerio.load(html);const links=new Map()
 $('a[href]').each((_,a)=>{const href=publicUrl($(a).attr('href'),url);if(!href)return;const u=new URL(href);const text=clean($(a).text());const context=clean($(a).closest('p,li,td').text());const host=u.hostname.toLowerCase();const platform=/(^|\.)hotcrp\.com$/.test(host)?'HotCRP':/(^|\.)easychair\.org$/.test(host)?'EasyChair':/(^|\.)openreview\.net$/.test(host)?'OpenReview':/^cmt\d*\.research\.microsoft\.com$/.test(host)?'Microsoft CMT':/(^|\.)edas\.info$/.test(host)?'EDAS':null
 if(/instruction|guideline|template|documentation/i.test(text))return
 const specific=platform==='HotCRP'?host!=='hotcrp.com'&&host!=='www.hotcrp.com':u.pathname!=='/'||!!u.search
 if(platform&&specific&&(/submit|submission|paper|hotcrp|easychair|openreview|cmt|edas/i.test(text+' '+context)))links.set(href,{label:platform,url:href})
 else if(!platform&&/^(?:submit (?:a |your )?(?:paper|manuscript)|submission (?:site|system|portal))$/i.test(text)&&!/#|\.(pdf|zip)$/i.test(href))links.set(href,{label:'Submission portal',url:href})
 });return [...links.values()]
}
// Preserve explicit official cycle headings instead of flattening both calls.
export function roundDates(html,url){
 const $=cheerio.load(html);const events=[];let inDates=false,round=null
 $('h2,h3,h4,h5,li').each((_,node)=>{
  const text=clean($(node).text())
  if(/^h[2-5]$/.test(node.tagName)){
   if(/important dates/i.test(text)){inDates=true;round=null;return}
   if(node.tagName==='h2'){inDates=false;round=null;return}
   if(inDates){const match=/^(?:cycle|round)\s*(\d+)$|^(first|second|third) deadline$/i.exec(text);if(match)round=match[1]?`Cycle ${match[1]}`:`Cycle ${{first:1,second:2,third:3}[match[2].toLowerCase()]}`}
   return
  }
  if(!inDates||!round||text.length>350)return
  const date=datePart(text);if(!date)return
  const label=text.slice(0,text.indexOf(date.matched)).replace(/[\s:–—-]+$/,'');if(!label)return
  events.push({label,date:date.date,round,original:text,utc:null,timezone:'Time / timezone not confirmed',precision:'date',source:url})
 });return events
}
export function extractTrack(html,url,link,venue,extractGuide){
 const $=cheerio.load(html);$('script,style,nav,footer,header,form,.navigationbar,.navbar').remove();$('br').replaceWith(' ')
 const call=$('[id^="call-"],#call-for-papers,#submission-guidelines').first();const content=call.length&&!/^h[1-6]$/.test(call[0].tagName)?call.html():$('main,article').first().html()||$.html();const guide=extractGuide(content,url);const events=[];const seen=new Set()
 // Researchr exposes track-local deadlines in clickable date rows. Never read other tracks' sidebar dates.
 $('tr[href]').each((_,row)=>{const href=publicUrl($(row).attr('href'),url);if(href?.split('#')[0]!==url.split('#')[0])return;const rowText=clean($(row).text());const date=datePart(rowText);if(!date)return;const range=/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2})(?: (\w+))? [-–] (?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}) (\w+) (20\d{2})\s+/.exec(rowText);if(range){const start=datePart(`${range[1]} ${range[2]||range[4]} ${range[5]}`);const name=rowText.slice(range[0].length);if(start&&start.date<=date.date){for(const [part,label] of [[start,name+' · starts'],[date,name+' · ends']]){if(!seen.has(label+part.date)){seen.add(label+part.date);events.push({label,date:part.date,original:rowText,timezone:'Time / timezone not confirmed',utc:null,precision:'date',source:url})}}return}}const label=rowText.replace(date.matched,'').replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*/,'').trim();if(!label||seen.has(label+date.date))return;seen.add(label+date.date);events.push({label,date:date.date,original:clean($(row).text()),timezone:'Time / timezone not confirmed',utc:null,precision:'date',source:url})})
 if(!events.length)events.push(...structuredDates($('main,article').first().html()||$.html(),url))
 if(!events.length){const c=cheerio.load(content);c('li,tr,p').each((_,row)=>{const text=clean(c(row).text());if(text.length>350||!/deadline|submission|notification|camera.ready|rebuttal|abstract|registration/i.test(text))return;const date=datePart(text);if(!date||seen.has(text))return;seen.add(text);events.push({label:text.replace(date.matched,'').replace(/^[\s:–—-]+|[\s:–—-]+$/g,'').slice(0,120),date:date.date,original:text,timezone:'Time / timezone not confirmed',utc:null,precision:'date',source:url})})}
 const rounds=roundDates(content,url);if(rounds.length){events.splice(0,events.length,...rounds)}
 const text=clean(cheerio.load(content).text());const latexEvidence=guide.requirements.find(r=>r.id==='format')?.excerpts.filter(e=>/latex|documentclass|acmart|ieeetran/i.test(e.text))||[]
 return {id:venue.id+trackSeparator+createHash('sha256').update(link.url).digest('hex').slice(0,16),title:link.title,url,submissionKind:link.submissionKind||(/workshop/i.test(link.title)?'workshop-proposal':/artifact/i.test(link.title)?'artifact':'paper'),isMain:/^(papers?|(?:research|technical|main|regular)( papers?| track)?)$/i.test(link.title),status:'retrieved',overview:extractTrackOverview(content,url),submissionLinks:trackSubmissionLinks(content,url),requirements:guide.requirements,events:events.sort((a,b)=>a.date.localeCompare(b.date)),supportsLatex:latexEvidence.length>0,latexEvidence,templates:guide.links.filter(l=>/latex|template|\.cls|\.zip/i.test(l.label+' '+l.url)).slice(0,12),sourceText:text.slice(0,16000),summary:text.slice(0,450),dateNote:events.length?'Dates come from the official call. Exact cutoffs are shown only when the source provides them; date-only milestones remain unconfirmed.':'No dated submission milestones found in the retrieved Track page.'}
}
export function asTrackVenue(parent,track){return {...parent,id:track.id,parentVenueId:parent.id,round:track.title,website:track.url,sourceUrl:track.url,events:track.events,milestones:track.events,track,description:parent.description}}
export async function collectTracks(venue,fetcher,extractGuide){
 if(venue.kind!=='conference'||!venue.website)return {tracks:[],sources:[],notice:'No conference Track directory is available.'}
 let first;try{first=await fetcher(venue.website)}catch(e){return {tracks:[],sources:[{url:venue.website,status:'unavailable',reason:e.message}],notice:'Official Track directory could not be retrieved. No Track dates were inferred.'}}
 const discovered=trackLinks(first.text,first.url)
 // A supplementary Track must not hide the main official call.
 if(!discovered.some(link=>/^(research|technical|main|regular)( papers?| track)?$/i.test(link.title))){const $=cheerio.load(first.text);$('a[href]').each((_,link)=>{if(!/^call for papers$/i.test(clean($(link).text())))return;const href=publicUrl($(link).attr('href'),first.url);if(!href||new URL(href).origin!==new URL(first.url).origin)return;const years=new URL(href).pathname.match(/20\d{2}/g)||[];if(venue.year&&years.some(year=>Number(year)!==Number(venue.year)))return;if(!discovered.some(t=>t.url===href))discovered.push({title:'Research papers',url:href})});if(!discovered.some(t=>t.url===first.url)&&/^call for papers$/i.test(clean($('h1').first().text())))discovered.push({title:'Research papers',url:first.url})}
 const links=discovered.slice(0,60);const sources=[{url:first.url,status:'retrieved'}];const tracks=new Array(links.length);let cursor=0
 await Promise.all(Array.from({length:Math.min(4,links.length)},async()=>{for(;;){const index=cursor++;if(index>=links.length)return;const link=links[index];try{const page=link.url===first.url?first:await fetcher(link.url);const categories=cfpCategories(page.text,page.url);tracks[index]=categories.length?categories.map(category=>({...extractTrack(categoryContent(page.text,category,categories),page.url,category,venue,extractGuide),url:category.url,categoryEvidence:{text:category.evidence,source:page.url}})):extractTrack(page.text,page.url,link,venue,extractGuide);sources.push({url:page.url,status:'retrieved'})}catch(e){tracks[index]={id:venue.id+trackSeparator+createHash('sha256').update(link.url).digest('hex').slice(0,16),title:link.title,url:link.url,submissionKind:link.submissionKind,isMain:/research|main|technical papers/i.test(link.title),status:'unavailable',reason:e.message,requirements:[],events:[],supportsLatex:false,templates:[],dateNote:'Source unavailable; dates and requirements could not be checked.'};sources.push({url:link.url,status:'unavailable',reason:e.message})}}}))
 const expanded=tracks.flat();expanded.sort((a,b)=>Number(b.isMain)-Number(a.isMain));return {tracks:expanded,sources,notice:discovered.length>60?'Showing the first 60 official Tracks; additional Track links remain in the official directory.':links.length?'Tracks linked by the official edition website. Other editions are not substituted.':'No Track links recognized in this official page. Check the official directory; this is not proof that no other Tracks exist.'}
}

// A failed sibling fetch must not erase the last successful Track snapshot.
export function preserveRetrievedTracks(value,cached){
 if(!cached)return value
 const previous=new Map(cached.tracks.map(t=>[t.id,t]));let retained=false
 const tracks=value.tracks.map(track=>{const old=previous.get(track.id);if(track.status==='unavailable'&&old?.status==='retrieved'){retained=true;return {...old,stale:true,sourceFetched:old.sourceFetched||cached.fetched,refreshError:track.reason}}return {...track,sourceFetched:value.fetched}})
 return {...value,tracks,...(retained?{stale:true,notice:'Some Track sources could not be refreshed. Their last successfully retrieved details are retained.'}:{})}
}
