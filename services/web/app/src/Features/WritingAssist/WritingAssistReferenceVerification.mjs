import { parseBibliography, readableBibText } from './WritingAssistBibTeX.mjs'
export const normalized = value => readableBibText(String(value || '')).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
export const bareDoi = value => readableBibText(String(value || '')).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').trim().toLowerCase()
const sourceFields = citation => citation.bibtex ? parseBibliography(citation.bibtex).entries[0]?.fields || citation.metadata || {} : citation.metadata || {}
export const citationDoi = citation => bareDoi(citation.doi || citation.metadata?.doi || sourceFields(citation).doi)
function names(value) {
 return readableBibText(String(value || '')).split(/\s+and\s+/i).filter(Boolean).map(name=>{
  const parts=name.split(',').map(p=>p.trim());const tokens=name.trim().split(/\s+/)
  return {family:normalized(parts.length>1?parts[0]:tokens.at(-1)),initial:normalized(parts.length>1?parts.at(-1):tokens.length>1?tokens[0]:'').slice(0,1),given:normalized((parts.length>1?parts.at(-1):tokens.length>1?tokens[0]:'').split(/\s+/)[0])}
 })
}
function sameAuthors(a,b) {
 const left=names(a),right=names(b)
 return left.length>0 && left.length===right.length && left.every((n,i)=>n.family===right[i].family && (!n.initial || !right[i].initial || n.initial===right[i].initial))
}
function sourceAuthorsAgree(a,b) {
 const left=names(a),right=names(b)
 return sameAuthors(a,b) && left.every((n,i)=>!n.given || !right[i].given || n.given===right[i].given || n.given.length===1 || right[i].given.length===1)
}
function closeAuthors(a,b) {
 const left=names(a),right=names(b)
 if(left.length<2 || left.length!==right.length)return false
 const mismatches=left.filter((n,i)=>n.family!==right[i].family)
 if(mismatches.length!==1)return false
 return left.every((n,i)=>{
  const other=right[i];if(n.initial && other.initial && n.initial!==other.initial)return false
  if(n.family===other.family)return true
  if(Math.min(n.family.length,other.family.length)<5)return false
  let row=Array.from({length:other.family.length+1},(_,j)=>j)
  for(let x=0;x<n.family.length;x++){const next=[x+1];for(let y=0;y<other.family.length;y++)next.push(Math.min(next[y]+1,row[y+1]+1,row[y]+(n.family[x]===other.family[y]?0:1)));row=next}
  return row.at(-1)<=2
 })
}
function minorTitleDifference(a,b) {
 if(Math.min(a.length,b.length)<12 || Math.max(a.length,b.length)>1000 || Math.abs(a.length-b.length)>2)return false
 let row=Array.from({length:b.length+1},(_,i)=>i)
 for(let x=0;x<a.length;x++){const next=[x+1];for(let y=0;y<b.length;y++)next.push(Math.min(next[y]+1,row[y+1]+1,row[y]+(a[x]===b[y]?0:1)));row=next}
 return row.at(-1)<=2
}
export function candidateMatches(entry,citation) {
 const fields=sourceFields(citation)
 return normalized(entry.fields.title)===normalized(citation.title || fields.title) && sameAuthors(entry.fields.author,fields.author || citation.metadata?.author) && normalized(entry.fields.year)===normalized(citation.year || fields.year)
}
async function officialAcl(doi,fetcher) {
 const id=doi.match(/^10\.18653\/v1\/([a-z0-9.-]+)$/i)?.[1]
 if(!id)return null
 // Legacy ACL identifiers are uppercase in the official export path.
 const canonical=/^[a-z]\d{2}-\d+$/.test(id)?id[0].toUpperCase()+id.slice(1):id
 const url=`https://aclanthology.org/${canonical}.bib`
 try {
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/x-bibtex,text/plain'}})
  if(!response.ok)throw Error('Source unavailable')
  const reader=response.body.getReader();const chunks=[];let size=0
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024)throw Error('Source too large');chunks.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}
  const entries=parseBibliography(Buffer.concat(chunks).toString('utf8')).entries
  if(entries.length!==1 || bareDoi(entries[0].fields.doi)!==doi)throw Error('Source identity mismatch')
  return {url,fields:entries[0].fields}
 }catch {return {url,unavailable:true}}
}
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
function equivalent(field,a,b) {
 if(field==='month'){a=months.includes(String(a).toLowerCase())?String(months.indexOf(String(a).toLowerCase())+1):a;b=months.includes(String(b).toLowerCase())?String(months.indexOf(String(b).toLowerCase())+1):b}
 if(field==='author')return sourceAuthorsAgree(a,b)
 return normalized(a)===normalized(b)
}
export async function verifyReferenceIdentity(entry,citation,{fetcher=fetch,suppliedDoi=''}={}) {
 const fields=sourceFields(citation);const doi=citationDoi(citation) || bareDoi(suppliedDoi)
 const official=doi?await officialAcl(doi,fetcher):null
 const sources=[{label:'DOI registry',url:citation.sourceUrl}].filter(s=>s.url)
 const conflicts={}
 const crossCheckedFields=[]
 let corroborated=false
 if(official?.fields){
  sources.push({label:'ACL Anthology',url:official.url})
  for(const field of ['title','author','year','month','pages','booktitle','journal','volume','number','publisher','address','doi']) {
   const a=fields[field] || citation.metadata?.[field],b=official.fields[field]
   if(a && b && !equivalent(field,a,b))conflicts[field]='The DOI registry and official publication record disagree on this field.'
  }
  for(const field of Object.keys(fields)) {
   const a=fields[field],b=official.fields[field]
   if(a && b && equivalent(field,a,b))crossCheckedFields.push(field)
  }
  corroborated=!['title','author','year','doi'].some(f=>conflicts[f]) && Boolean(official.fields.title && official.fields.author && official.fields.year)
 }
 if(conflicts.pages)conflicts.numpages='Page count cannot be verified because the sources disagree on the page range.'
 const title=normalized(entry.fields.title),sourceTitle=normalized(citation.title || fields.title)
 const titleMatches=Boolean(title && title===sourceTitle)
 const authorsMatch=sameAuthors(entry.fields.author,fields.author || citation.metadata?.author)
 const yearMatches=Boolean(entry.fields.year && normalized(entry.fields.year)===normalized(citation.year || fields.year))
 let verified=Boolean(suppliedDoi) ? titleMatches || (authorsMatch && (!title || (yearMatches && minorTitleDifference(title,sourceTitle)))) || (!entry.fields.title && !entry.fields.author) : titleMatches && (authorsMatch || (corroborated && (!entry.fields.author || closeAuthors(entry.fields.author,fields.author || citation.metadata?.author)))) && (yearMatches || (!entry.fields.year && corroborated))
 if(['title','author','year','doi'].some(f=>conflicts[f]))verified=false
 if(citation.authorsTruncated || !doi)verified=false
 const reason=verified?null:conflicts.title || conflicts.author || conflicts.year || conflicts.doi || (!suppliedDoi && !yearMatches && entry.fields.year?'Publication year differs; the cited version could not be established automatically.':'The candidate could not be matched reliably to the cited title and authors. Confirm the DOI or publication version.')
 return {verified,reason,crossCheckedFields:verified?crossCheckedFields.filter(field=>!conflicts[field]):[],blockedFields:conflicts,sources,summary:verified?(corroborated?'Automatically verified against the DOI registry and ACL Anthology.':`Identity verified using ${[suppliedDoi?'DOI':null,titleMatches?'title':null,authorsMatch?'authors':null,yearMatches?'year':null].filter(Boolean).join(' + ')}.`):'Automatic verification needs more evidence.',officialUnavailable:Boolean(official?.unavailable)}
}
