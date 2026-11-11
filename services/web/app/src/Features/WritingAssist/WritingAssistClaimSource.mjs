import { execFile } from 'node:child_process'
import { parseBibliography } from './WritingAssistBibTeX.mjs'

export async function bounded(response, limit) {
 if (!response.ok) throw Error(`HTTP ${response.status}`)
 const chunks=[];let size=0;const reader=response.body.getReader()
 try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Source exceeds size limit');chunks.push(Buffer.from(value))} }
 finally {await reader.cancel().catch(()=>{})}
 return Buffer.concat(chunks)
}
export function extractPdf(buffer) {
 return new Promise((resolve,reject)=>{
  const child=execFile('pdftotext',['-','-'],{timeout:15000,maxBuffer:6*1024*1024},(error,stdout)=>error?reject(error):resolve(stdout))
  child.stdin.on('error',()=>{});child.stdin.end(buffer)
 })
}
// Construct URLs only on the official ACL host. Never follow redirects or fetch arbitrary bibliography URLs.
export async function aclEvidence(entry, fetcher=fetch, extract=extractPdf) {
 const doi=String(entry.fields.doi||'').replace(/^https?:\/\/(?:dx\.)?doi.org\//i,'')
 let id=doi.match(/^10\.18653\/v1\/([A-Za-z0-9.-]+)$/i)?.[1]
 if(!id)id=String(entry.fields.url||'').match(/^https?:\/\/aclanthology\.org\/([A-Za-z0-9.-]+?)(?:\.pdf)?\/?$/i)?.[1]
 if(!id || !/^(?:[A-Z]\d{2}-\d+|\d{4}\.[a-z0-9.-]+)$/i.test(id))return null
 const url=`https://aclanthology.org/${id}.pdf`
 const options=()=>({redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/pdf,text/plain'}})
 try {
  const buffer=await bounded(await fetcher(url,options()),8*1024*1024)
  if(!buffer.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('Not a PDF')
  const text=String(await extract(buffer)).trim()
  if(text.length<200)throw Error('No extractable text')
  return {url,coverage:text.length>90000?'partial-full-text':'full-text',text:text.slice(0,90000),truncated:text.length>90000}
 } catch {
  try {
   const bib=(await bounded(await fetcher(`https://aclanthology.org/${id}.bib`,options()),1024*1024)).toString('utf8')
   const abstract=parseBibliography(bib).entries[0]?.fields.abstract
   if(abstract)return {url:`https://aclanthology.org/${id}/`,coverage:'abstract',text:abstract.slice(0,20000),reason:'Full text unavailable; abstract only'}
  }catch { /* Return an access limitation, never a claim verdict. */ }
  return {url,coverage:'unavailable',reason:'Could not retrieve the source PDF or abstract. Open the source and check the cited claim manually.'}
 }
}
