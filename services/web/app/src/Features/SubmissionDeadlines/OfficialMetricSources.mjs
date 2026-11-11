import {publisherMetricPages,parsePublisherMetrics} from './PublisherMetrics.mjs'
import yauzl from 'yauzl'
import {parseStringPromise} from 'xml2js'
import * as cheerio from 'cheerio'
import {createHash} from 'node:crypto'
import {metricKey} from './LetPubMetrics.mjs'
import {fetchPublicPage} from './PublicPage.mjs'
export async function readMetricWorkbook(bytes){
 const parts={};let total=0
 await new Promise((resolve,reject)=>yauzl.fromBuffer(bytes,{lazyEntries:true},(error,zip)=>{
  if(error)return reject(error)
  zip.on('error',reject);zip.on('end',resolve);zip.on('entry',entry=>{
   if(!/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(entry.fileName))return zip.readEntry()
   if((total+=entry.uncompressedSize)>150000000){zip.close();return reject(new Error('Workbook exceeds size limit'))}
   zip.openReadStream(entry,(e,stream)=>{if(e)return reject(e);const chunks=[];stream.on('data',x=>chunks.push(x));stream.on('error',reject);stream.on('end',()=>{parts[entry.fileName]=Buffer.concat(chunks).toString();zip.readEntry()})})
  });zip.readEntry()
 }))
 if(Object.values(parts).some(s=>/<!DOCTYPE|<!ENTITY/i.test(s)))throw new Error('Unsupported workbook XML')
 const strings=parts['xl/sharedStrings.xml']?(await parseStringPromise(parts['xl/sharedStrings.xml'])).sst.si.map(si=>si.t?.map(t=>typeof t==='string'?t:t._||'').join('')||si.r?.map(r=>r.t?.map(t=>typeof t==='string'?t:t._||'').join('')).join('')||''):[]
 const sheets={}
 for(const [name,xml] of Object.entries(parts)){
  if(!name.includes('/sheet'))continue
  const rows=[]
  for(const match of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
   const row={}
   for(const cell of match[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
    const column=cell[1].match(/\br="([A-Z]+)\d+"/)?.[1];if(!column)continue
    const type=cell[1].match(/\bt="([^"]+)"/)?.[1];const value=cell[2].match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1]||''
    row[column]=type==='s'?strings[Number(value)]||'':value
   }
   rows.push(row)
  }
  sheets[name]=rows
 }
 return sheets
}
const issn=s=>String(s||'').toUpperCase().replace(/[^0-9X]/g,'')
export function matchOfficialMetrics(venues,ieeeSheets,eiSheets,sources,checked=new Date().toISOString()){
 const ieee=Object.values(ieeeSheets).find(rows=>rows.some(r=>r.B==='Publication Title'))||[]
 const journalRows=Object.values(eiSheets).find(rows=>rows.some(r=>r.C==='ISSN'&&r.A==='Source title'))||[]
 const procRows=Object.values(eiSheets).find(rows=>rows.some(r=>r.C==='ISBN13'))||[]
 const footnote=ieee.find(r=>/Journal Citation Reports/.test(r.A||''))?.A||''
 const years=footnote.match(/(20\d\d).*released.*(20\d\d)/i);if(!years&&sources.only!=='compendex')throw new Error('IEEE metric year could not be verified')
 const year=Number(years?.[1]||0),release=Number(years?.[2]||0);const edition=`${year}; released ${release}`
 const eiEdition=journalRows[0]?.A||'';if(!/UPDATED.*20\d\d/.test(eiEdition)&&sources.only!=='ieee')throw new Error('Compendex edition could not be verified')
 const normalizedProceedings=procRows.filter(r=>r.B==='Proceeding').map(r=>({...r,normalized:metricKey(r.A),years:new Set(r.A.match(/\b20\d\d\b/g)||[])}))
 const entries={};const audit=[]
 for(const venue of venues){
  let key=venue.kind+':'+metricKey(venue.description);if(venue.kind!=='journal')key+=':'+venue.year
  if(audit.some(x=>x.key===key))continue
  const record={name:venue.description,checked,status:'official',sources:[]}
  if(venue.kind==='journal'){
   const rows=ieee.filter(r=>metricKey(r.B)===metricKey(venue.description)&&['SCIE','ESCI','SSCI'].includes(r.F))
   if(rows.length===1){const r=rows[0];Object.assign(record,{issn:r.D,eissn:r.E,sci:r.F,jcrEdition:edition});if(/^\d+(\.\d+)?$/.test(r.G))record.jif={value:Number(r.G),year,release,edition,source:sources.ieee};if(/^Q[1-4]$/.test(r.I))record.jcr=[{category:'Publisher-reported quartile',quartile:r.I,rank:null}];record.sources.push({url:sources.ieee,label:'IEEE',fields:['sci','jif','jcr'],edition,checked})}
   const ids=[issn(record.issn),issn(record.eissn)].filter(Boolean)
   const ei=journalRows.filter(r=>r.B==='Journal'&&(metricKey(r.A)===metricKey(venue.description)||ids.some(id=>[issn(r.C),issn(r.D)].includes(id))))
   if(ei.length===1){record.ei='Indexed';record.eiEdition=eiEdition;record.issn||=ei[0].C;record.sources.push({url:sources.compendex,label:'Elsevier Compendex',fields:['ei'],edition:eiEdition,checked})}
  }else if(venue.year){
   const full=metricKey(venue.description);const matches=normalizedProceedings.filter(r=>r.years.has(String(venue.year))&&r.normalized.includes(full))
   if(matches.length){Object.assign(record,{eiProceedings:'Listed',eiPaper:'Not verified',eiEdition,proceedings:matches.map(r=>({title:r.A,isbn:r.C}))});record.sources.push({url:sources.compendex,label:'Elsevier Compendex',fields:['eiProceedings'],edition:eiEdition,checked})}
  }
  if(record.sources.length)entries[key]=record
  audit.push({key,matched:record.sources.length>0,jif:!!record.jif,ei:!!record.ei,eiProceedings:!!record.eiProceedings})
 }
 return {entries,audit,checked,sources,metricYear:year,releaseYear:release}
}
export async function fetchOfficialMetrics(venues,{fetcher=fetchPublicPage,onEntries=()=>{}}={}){
 const find=async(landing,pattern)=>{const page=await fetcher(landing);const $=cheerio.load(page.text);const links=$('a[href]').map((i,e)=>new URL($(e).attr('href'),page.url||landing).href).get().filter(u=>pattern.test(u));if(links.length===0)throw new Error('Latest official workbook link not found');return links[0]}
 const providers=[{origin:'ieee',landing:'https://open.ieee.org/publishing-options/ieee-title-list/',pattern:/^https:\/\/open\.ieee\.org\/.*IEEE-Title-List.*\.xlsx$/i},{origin:'compendex',landing:'https://www.elsevier.com/products/engineering-village/databases/compendex',pattern:/^https:\/\/assets\.ctfassets\.net\/.*COMPENDEX.*\.xlsx$/i}]
 const sources={}
 const results=await Promise.allSettled([
  ...providers.map(async(provider,i)=>{
   const url=await find(provider.landing,provider.pattern);sources[provider.origin]=url
   const file=await fetcher(url,0,{binary:true});const sheet=await readMetricWorkbook(file.bytes);const origin=provider.origin
   const result=matchOfficialMetrics(venues,i?{}:sheet,i?sheet:{},{...sources,only:origin})
   await onEntries({...result,origin});return {...result,origin,hash:createHash('sha256').update(file.bytes).digest('hex')}
  }),
  (async()=>{
   const landing='https://www.springernature.com/gp/librarians/licensing/journals-catalog'
   const url=await find(landing,/^https:\/\/cms-resources\.apps\.public\.k8s\.springernature\.io\/.*\/data\//)
   const file=await fetcher(url,0,{binary:true});const sheets=await readMetricWorkbook(file.bytes)
   const rows=Object.values(sheets).flat();const pages=new Map(publisherMetricPages.map(p=>[metricKey(p.name),p]))
   for(const venue of venues.filter(v=>v.kind==='journal')){
    const matches=rows.filter(r=>metricKey(r.A||'')===metricKey(venue.description)&&/^\d+$/.test(r.E||''))
    const ids=[...new Set(matches.map(r=>r.E))]
    if(ids.length===1)pages.set(metricKey(venue.description),{name:venue.description,url:'https://link.springer.com/journal/'+ids[0]})
   }
   const entries={};const errors=[];const queue=[...pages.values()];let index=0
   async function worker(){while(index<queue.length){const p=queue[index++];try{
    const r=parsePublisherMetrics((await fetcher(p.url,0,{extendedTimeout:true})).text,p.url,p.name)
    entries['journal:'+metricKey(r.name)]=r;await onEntries({entries:{['journal:'+metricKey(r.name)]:r},origin:'publisher',checked:r.checked})
   }catch(error){errors.push({source:p.url,reason:error.message})}
   await new Promise(resolve=>setTimeout(resolve,1500))}}
   await Promise.all([worker(),worker()]);return {entries,errors,origin:'publisher'}
  })()
 ])
 const entries={};const errors=[];let metricYear=0,releaseYear=0
 for(const [i,r]of results.entries()){
  if(r.status==='rejected'){errors.push({source:i<2?providers[i].landing:'https://www.springernature.com/gp/librarians/licensing/journals-catalog',reason:r.reason?.message||'Source unavailable'});continue}
  errors.push(...(r.value.errors||[]))
  metricYear=Math.max(metricYear,r.value.metricYear||0);releaseYear=Math.max(releaseYear,r.value.releaseYear||0)
  for(const [key,value]of Object.entries(r.value.entries)){
   const prior=entries[key]||{};entries[key]={...prior,...value,sources:[...(prior.sources||[]),...value.sources]}
   // Index-provider EI statements take priority over publisher statements.
   if(prior.ei==='Indexed')entries[key].ei=prior.ei
  }
 }
 if(!Object.keys(entries).length)throw new Error('No official sources could be updated')
 return {entries,errors,checked:new Date().toISOString(),sources,metricYear,releaseYear,publisherFailures:errors.filter(e=>/springer/.test(e.source)).map(e=>e.source)}
}
