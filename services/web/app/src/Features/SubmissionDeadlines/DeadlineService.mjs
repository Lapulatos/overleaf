import {venueStore} from './VenueStore.mjs'
import {withTrackOverviews} from './TrackOverview.mjs'
import {journalDefaults,journalHomepage,extractJournalProfile,loadPublisherHomepages,journalSnapshotDetail} from './JournalProfile.mjs'
import {verifiedVenueOverview} from './VerifiedVenueOverviews.mjs'
import {trackSnapshotStore} from './TrackSnapshotStore.mjs'
import {conferenceOverview} from './ConferenceOverview.mjs'
import {collectTracks,asTrackVenue,trackSeparator,preserveRetrievedTracks} from './ConferenceTracks.mjs'
import {includeDirectoryVenues} from './VenueClassification.mjs'
import * as cheerio from 'cheerio'
import { fetchPublicPage, publicUrl } from './PublicPage.mjs'
export const CATALOG_URL='https://ccfddl.com/conference/allconf.json'
const HOUR=3600000
// Journal directories are separate from conference rounds. No invented annual deadlines.
export const JOURNALS=[
 {id:'journal-jmlr',title:'JMLR',description:'Journal of Machine Learning Research',area:'AI',website:'https://www.jmlr.org/author-info.html',schedule:'rolling'},
 {id:'journal-tmlr',title:'TMLR',description:'Transactions on Machine Learning Research',area:'AI',website:'https://jmlr.org/tmlr/author-guide.html',schedule:'rolling'},
 {id:'journal-tosem',title:'TOSEM',description:'ACM Transactions on Software Engineering and Methodology',area:'SE',website:'https://dl.acm.org/journal/tosem/author-guidelines'},
 {id:'journal-tse',title:'TSE',description:'IEEE Transactions on Software Engineering',area:'SE',website:'https://www.computer.org/csdl/journal/ts/write-for-us'},
 {id:'journal-tpami',title:'TPAMI',description:'IEEE Transactions on Pattern Analysis and Machine Intelligence',area:'AI',website:'https://www.computer.org/csdl/journal/tp/write-for-us'},
 {id:'journal-csur',title:'CSUR',description:'ACM Computing Surveys',area:'DS',website:'https://dl.acm.org/journal/csur/author-guidelines'},
].map(v=>({...v,kind:'journal',rank:null,year:null,round:'Regular submissions',events:[],sourceUrl:v.website}))
export function deadlineInstant(text,timezone){
 const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text||'');if(!m)return null
 const [y,mo,d,h,mi,s]=m.slice(1).map(Number);const stamp=Date.UTC(y,mo-1,d,h,mi,s||0);if(new Date(stamp).toISOString().slice(0,10)!==`${m[1]}-${m[2]}-${m[3]}`||h>23||mi>59||(s||0)>59)return null
 const zone=timezone==='AoE'?'UTC-12':timezone;const offset=/^UTC(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(zone||'');
 if(offset){if(Number(offset[3]||0)>59)return null;const mins=(Number(offset[2]||0)*60+Number(offset[3]||0))*(offset[1]==='-'?-1:1);if(Math.abs(mins)>14*60)return null;return new Date(stamp-mins*60000).toISOString()}
 if(zone==='PT'){
  const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const target=`${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]||'00'}`;const matches=[7,8].map(offset=>stamp+offset*HOUR).filter(value=>format.format(new Date(value))===target);return matches.length===1?new Date(matches[0]).toISOString():null
 }
 return null
}
export function normalizeCatalog(data,now=Date.now()){
 if(!Array.isArray(data))throw new Error('Invalid deadline catalog')
 const result=[]
 for(const venue of data){if(!Array.isArray(venue.confs))continue
 for(const conf of venue.confs)for(const [roundIndex,round] of (conf.timeline?.length?conf.timeline:[{}]).entries()){
  const events=[['registration_deadline','Registration'],['abstract_deadline','Abstract'],['deadline','Paper']].filter(([field])=>round[field]).map(([field,label])=>({label,original:round[field],timezone:conf.timezone||'Unknown',utc:deadlineInstant(round[field],conf.timezone)}))
  result.push({id:encodeURIComponent(venue.conference_key||venue.title)+'~'+conf.id+'~'+roundIndex,title:venue.title,description:venue.description,area:venue.sub,rank:venue.rank?.ccf||null,ranks:{ccf:venue.rank?.ccf||null,core:venue.rank?.core||null,thcpl:venue.rank?.thcpl||null},milestones:[...events,...[['rebuttal_deadline','Rebuttal'],['decision_deadline','Decision']].filter(([field])=>round[field]).map(([field,label])=>({label,original:round[field],timezone:conf.timezone||'Unknown',utc:deadlineInstant(round[field],conf.timezone)})),...(conf.opening?[{label:conf.opening_is_derived?'Conference starts (derived)':'Conference starts',original:conf.opening,timezone:conf.timezone||'Unknown',utc:deadlineInstant(conf.opening,conf.timezone)}]:[])],kind:'conference',year:conf.year,round:round.comment||`Submission round ${roundIndex+1}`,website:publicUrl(conf.link),sourceUrl:CATALOG_URL,date:conf.date,place:conf.place,events})
 }}return result
}
const rules=[['layout','Submission column layout',/\b(?:single|double|one|two)[-\s]column\b/i],['prerequisites','Submission prerequisites',/for accepted (?:papers|submissions)|only.{0,70}accepted|must.{0,50}(?:be accepted|have been accepted)|accepted.{0,70}(?:research track|research papers)|(?:require|must).{0,70}(?:runnable|demonstration video|demo video)|prerequisite|prior acceptance/i],['registration','Registration & abstract requirements',/registration|register.{0,40}(paper|abstract)|abstract.{0,40}(deadline|required|mandatory)|no new submissions/i],['length','Page & word limits',/\b(?:\d+[ -]?(?:pages?|words?)|page limit|page length|word limit)\b/i],['anonymity','Anonymity & review',/double.blind|single.blind|anonymous|anonymiz/i],['bibliography','BST & citation style',/\.bst\b|bibliographystyle|citation style|reference style/i],['format','LaTeX & document class',/latex|\.bst\b|\.cls\b|bibliograph|documentclass|acmart|IEEEtran/i],['files','Files & supplementary material',/supplement|appendi|\bPDF\b|file size|megabyte/i],['policy','Submission policies',/dual submission|simultaneous|plagiarism|generative|ethics|conflict of interest/i]]
export function extractGuide(html,url,venue){
 const $=cheerio.load(html);const journal=extractJournalProfile($,url,venue);$('script,style,nav,footer,header,noscript,form').remove()
 const links=[];$('a[href]').each((_,a)=>{const href=publicUrl($(a).attr('href'),url);const label=$(a).text().replace(/\s+/g,' ').trim();if(href&&label)links.push({url:href,label:label.slice(0,120)})})
 const paragraphs=[];$('p,li,h2,h3,h4,td').each((_,e)=>{if($(e).children('p,li,ul,ol').length)return;const text=$(e).text().replace(/\s+/g,' ').trim();if(text.length>20&&text.length<1600&&!paragraphs.includes(text))paragraphs.push(text)})
 const requirements=rules.map(([id,label,pattern])=>({id,label,excerpts:paragraphs.filter(t=>pattern.test(t)).slice(0,3).map(text=>({text,source:url}))}))
 return {journal,overview:conferenceOverview(paragraphs,venue,url,$('title,h1,h2,h3,h4,h5,h6').text()),requirements,links,follow:links.filter(l=>new URL(l.url).origin===new URL(url).origin&&/aims.and.scope|call.for.papers|submission|author.{0,15}(guide|instruction)|paper.{0,10}format/i.test(l.label+' '+l.url)&&!/#|\.(pdf|zip|gz)$/i.test(l.url)).slice(0,3)}
}
async function fetchSource(url){
 if(url!==CATALOG_URL&&!/^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+(?:\/contents)?$/.test(url)){
  const endpoint=process.env.OVERLEAF_AGENT_ENDPOINT;const token=process.env.OVERLEAF_AGENT_TOKEN
  if(endpoint&&token){const response=await fetch(endpoint.replace(/\/$/,'')+'/agent/public-guide',{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Token':token},body:JSON.stringify({url}),signal:AbortSignal.timeout(30000)});const page=await response.json();if(!response.ok)throw Error(page.error||'Public guide service unavailable');return page}
  return fetchPublicPage(url,0,{extendedTimeout:true})
 } // Fixed upstream URL only. Venue-supplied URLs use DNS-pinned public fetching.
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'PaperAssistant-SubmissionTracker'}});if(!response.ok)throw new Error(`Catalog returned HTTP ${response.status}`)
 const reader=response.body.getReader();const chunks=[];let size=0
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000)throw new Error('Catalog exceeds 2 MB');chunks.push(Buffer.from(value))}}finally{await reader.cancel()}
 return {url,text:Buffer.concat(chunks).toString('utf8'),contentType:'application/json'}
}
export function createDeadlineService({fetcher=fetchSource,now=()=>Date.now(),publisherHomepages=fetcher===fetchSource?loadPublisherHomepages:async()=>new Map(),repository=fetcher===fetchSource?venueStore:null,catalogSnapshots=repository?.catalog,trackSnapshots=repository?.tracks,legacyTracks=fetcher===fetchSource?trackSnapshotStore('/var/lib/overleaf/venue-track-snapshots'):null}={}){
 let catalog=null; let pending=null; let lastAttempt=0;const details=new Map();const detailRequests=new Map();const trackCache=new Map();const trackRequests=new Map()
 async function enrichJournalLinks(venues){const pages=await publisherHomepages().catch(()=>new Map());return venues.map(v=>({...v,website:journalHomepage(v,pages),...(v.kind==='journal'&&journalDefaults(v)?.cover?{cover:journalDefaults(v).cover}:{})}))}
 async function list(force=false){
  if(!catalog)catalog=await catalogSnapshots?.load().catch(()=>null)
  if(catalog&&!catalog.offline&&now()-catalog.fetched<HOUR&&!force)return {...catalog,stale:Boolean(catalog.offline||catalog.sourceFailed)}
  if(catalog&&!catalog.offline&&!force){void list(true).catch(()=>{});return {...catalog,stale:true}}
  if(pending)return pending
  if(catalog&&now()-lastAttempt<30000)return {...catalog,stale:now()-catalog.fetched>=HOUR}
  lastAttempt=now();pending=(async()=>{try{const page=await fetcher(CATALOG_URL);const venues=await enrichJournalLinks(includeDirectoryVenues([...normalizeCatalog(JSON.parse(page.text),now()),...JOURNALS]));catalog={venues,fetched:now(),sourceUrl:CATALOG_URL};await catalogSnapshots?.save(catalog).catch(()=>{});return {...catalog,stale:Boolean(catalog.offline||catalog.sourceFailed)}}catch(error){await repository?.failure('catalog','',error.message).catch(()=>{});if(!catalog||catalog.offline){const persisted=await catalogSnapshots?.load();if(persisted)catalog={...persisted,sourceFailed:true}}if(catalog&&!catalog.offline)return {...catalog,stale:true,error:'Could not refresh CCFDDL. Showing the previous snapshot.'};catalog={venues:await enrichJournalLinks(includeDirectoryVenues([...JOURNALS])),fetched:now(),sourceUrl:CATALOG_URL,offline:true};return {...catalog,stale:true,error:'Live deadline source unavailable. Showing the persisted CCF directory; submission dates are unconfirmed.'}}finally{pending=null}})();return pending
 }
 async function loadDetail(id,force){
  const {venues,stale}=await list();const venue=venues.find(v=>v.id===id);if(!venue)throw Object.assign(new Error('Venue not found'),{status:404})
  const cached=details.get(id)||await repository?.details.load(id).catch(()=>null);if(cached&&now()-cached.fetched<(force?30000:HOUR))return {...cached,catalogStale:stale}
  const snapshot=!force&&journalSnapshotDetail(venue);if(snapshot){const value={...snapshot,catalogStale:stale};details.set(id,value);await repository?.details.save(id,value).catch(()=>{});return value}
  const sources=[]; const guides=[]
  async function read(url){try{const page=await fetcher(url);if(!/html|text/i.test(page.contentType))throw new Error('HTML guide not available');const parsed=extractGuide(page.text,page.url,venue);sources.push({url:page.url,status:'retrieved'});guides.push(parsed);return parsed}catch(e){sources.push({url,status:'unavailable',reason:e.message});return null}}
  const defaults=journalDefaults(venue)
  const first=venue.website?await read(venue.website):null
  if(defaults?.guide&&defaults.guide!==venue.website)await read(defaults.guide)
  if(defaults?.source&&defaults.source!==venue.website&&defaults.source!==defaults.guide&&!/\.pdf(?:$|[?#])/i.test(defaults.source))await read(defaults.source)
  if(first)for(const link of first.follow)if(!sources.some(s=>s.url===link.url))await read(link.url)
  const links=[...new Map(guides.flatMap(g=>g.links).map(l=>[l.url,l])).values()]
  const requirements=rules.map(([key,label])=>({id:key,label,excerpts:[...new Map(guides.flatMap(g=>g.requirements.find(r=>r.id===key)?.excerpts||[]).map(e=>[e.text,e])).values()].slice(0,3)}))
  const templates=links.filter(l=>/template|style.file|\.bst\b|\.cls\b|latex.{0,20}(format|source|package)/i.test(l.label+' '+l.url)).slice(0,12)
  if(defaults?.templateResources)templates.push(...defaults.templateResources)
  const styleFiles=[]
  for(const link of templates.filter(l=>/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(l.url)).slice(0,2)){
   try{const repo=new URL(link.url).pathname.replace(/\/$/,'');const meta=JSON.parse((await fetcher('https://api.github.com/repos'+repo)).text);if(typeof meta.archive_url==='string'&&typeof meta.default_branch==='string'&&meta.archive_url.startsWith('https://api.github.com/repos'+repo+'/'))templates.push({label:link.label+' (ZIP archive)',url:meta.archive_url.replace('{archive_format}{/ref}','zipball/'+encodeURIComponent(meta.default_branch))});const files=JSON.parse((await fetcher('https://api.github.com/repos'+repo+'/contents')).text);if(Array.isArray(files))for(const file of files)if(/\.(bst|cls|sty)$/.test(file.name)&&publicUrl(file.html_url))styleFiles.push({name:file.name,url:publicUrl(file.html_url)});sources.push({url:link.url,status:'retrieved'})}catch{sources.push({url:link.url,status:'unavailable',reason:'Template repository metadata could not be retrieved.'})}
  }
  const submission=links.filter(l=>/submit|submission.system|manuscript.central|hotcrp|easychair|openreview|cmt3|manudb/i.test(l.label+' '+l.url)&&!/guideline|instruction/i.test(l.label)).slice(0,6)
  const extracted=guides.map(g=>g.journal).filter(Boolean);const journal=venue.kind==='journal'?{...defaults,homepage:venue.website,articleTypes:extracted.find(g=>g.articleTypes.length)?.articleTypes||defaults?.articleTypes||[],topics:extracted.find(g=>g.topics.length)?.topics||defaults?.topics||[],cover:extracted.find(g=>g.cover)?.cover||defaults?.cover||cached?.journal?.cover}:null
  if(defaults?.scopeNote)requirements.push({id:'scope',label:'Journal scope',excerpts:[{text:defaults.overview.text+' '+defaults.scopeNote,source:defaults.source}]})
  if(defaults?.homepage?.includes('advanced-engineering-informatics'))requirements.push({id:'format',label:'Publisher LaTeX guidance',excerpts:[{text:'Elsevier provides the elsarticle LaTeX template. This is a publisher resource, not confirmation of this journal’s required submission class options, column layout or reference style. Those must be confirmed against the journal author guide; do not invent journal-specific requirements.',source:'https://www.elsevier.com/researcher/author/policies-and-guidelines/latex-instructions'}]})
  for(const rule of defaults?.requirements||[]){const existing=requirements.find(r=>r.id===rule.id);if(existing){if(!existing.excerpts.length)existing.excerpts.push(...rule.excerpts)}else requirements.push(rule)}
  if(defaults?.submissionLinks)submission.push(...defaults.submissionLinks.filter(l=>!submission.some(x=>x.url===l.url)))
  const value={venue,journal,overview:extracted.find(g=>g.overview)?.overview||defaults?.overview||guides.find(g=>g.overview)?.overview||verifiedVenueOverview(venue),fetched:now(),sources,requirements,templates,styleFiles,submission,catalogStale:stale};details.set(id,value);if(sources.some(source=>source.status==='retrieved'))await repository?.details.save(id,value).catch(()=>{});else if(cached){await repository?.failure('details',id,'Official sources unavailable').catch(()=>{});return {...cached,catalogStale:true,stale:true}}if(details.size>150)details.delete(details.keys().next().value);return value
 }
 async function tracks(id,force=false){
  const parentId=id.split(trackSeparator)[0];let cached=trackCache.get(parentId)||await trackSnapshots?.load(parentId).catch(()=>null);if(!cached){cached=await legacyTracks?.load(parentId);if(cached)await trackSnapshots?.save(parentId,cached).catch(()=>{})}if(cached)trackCache.set(parentId,cached);if(cached&&now()-cached.fetched<(force?30000:HOUR))return cached
  if(cached&&!force){void tracks(parentId,true).catch(()=>{});return {...cached,stale:true,notice:'Showing saved Track details while checking official sources.'}}
  if(trackRequests.has(parentId))return trackRequests.get(parentId)
  if(trackRequests.size>=4)throw Object.assign(new Error('Track sources busy'),{status:429})
  const pending=(async()=>{const venue=(await list()).venues.find(v=>v.id===parentId);if(!venue){if(cached){await repository?.failure('tracks',parentId,'Annual catalog entry unavailable').catch(()=>{});return {...cached,stale:true,notice:'Catalog unavailable. Showing previously retrieved Track sources.'}}throw Object.assign(new Error('Venue not found'),{status:404})}let value={...await collectTracks(venue,fetcher,extractGuide),fetched:now()};if(!value.tracks.some(t=>t.status==='retrieved')&&cached){await repository?.failure('tracks',parentId,'Official sources unavailable').catch(()=>{});return {...cached,stale:true,notice:`Official sources could not be refreshed. Showing verified Track sources from ${new Date(cached.fetched).toISOString().slice(0,10)}.`,refreshSources:value.sources}}value=preserveRetrievedTracks(value,cached);await trackSnapshots?.save(parentId,value).catch(()=>{});trackCache.set(parentId,value);if(trackCache.size>150)trackCache.delete(trackCache.keys().next().value);return value})().finally(()=>trackRequests.delete(parentId));trackRequests.set(parentId,pending);return pending
 }
 async function resolve(id){const parent=(await list()).venues.find(v=>v.id===id.split(trackSeparator)[0]);if(!parent)return null;if(!id.includes(trackSeparator))return parent;const track=withTrackOverviews(await tracks(parent.id)).tracks.find(t=>t.id===id);return track?asTrackVenue(parent,track):null}
 async function detail(id,force=false){
  if(id.includes(trackSeparator)){const venue=await resolve(id);if(!venue)throw Object.assign(new Error('Track not found'),{status:404});const track=venue.track;return {venue,requirements:track.requirements,templates:track.templates,submission:[],styleFiles:[],fetched:now(),sources:[{url:track.url,status:track.status,reason:track.reason}],catalogStale:false}}

  if(!force){const cached=details.get(id)||await repository?.details.load(id).catch(()=>null);if(cached){details.set(id,cached);if(now()-cached.fetched>=HOUR){void detail(id,true).catch(()=>{});return {...cached,stale:true}}return cached}}
  if(detailRequests.has(id))return detailRequests.get(id)
  if(detailRequests.size>=4)throw Object.assign(new Error('Source checks are busy. Try again shortly.'),{status:429})
  const pending=loadDetail(id,force).finally(()=>detailRequests.delete(id));detailRequests.set(id,pending);return pending
 }
 return {list,detail,tracks,resolve}
}
export const deadlines=createDeadlineService()
