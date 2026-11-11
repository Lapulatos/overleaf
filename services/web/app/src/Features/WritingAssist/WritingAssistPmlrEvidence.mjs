import {bounded,extractPdf} from './WritingAssistClaimSource.mjs'
import {candidateMatches,normalized} from './WritingAssistReferenceVerification.mjs'
const decode=s=>String(s||'').replace(/&(?:amp|quot|apos|nbsp|#39|#x27);/gi,x=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&nbsp;':' ','&#39;':"'",'&#x27;':"'"})[x.toLowerCase()]).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
const options=()=>({redirect:'error',signal:AbortSignal.timeout(15000)})
// Resolve papers from the cited PMLR volume, not an invented DOI or guessed author slug.
export async function pmlrEvidence(entry,fetcher=fetch,extract=extractPdf,cache=new Map()) {
 let match=String(entry.fields.url||'').match(/^https?:\/\/proceedings\.mlr\.press\/v(\d{1,4})\/([a-z0-9-]+)\.html$/i)
 const volume=match?.[1] || (/PMLR|machine learning research/i.test(`${entry.fields.publisher||''} ${entry.fields.series||''}`) && /^\d{1,4}$/.test(entry.fields.volume||'') ? entry.fields.volume:null)
 if(!volume)return null
 let page=match?`https://proceedings.mlr.press/v${volume}/${match[2]}.html`:null
 const indexUrl=`https://proceedings.mlr.press/v${volume}/`
 let abstract=''
 try {
  if(!page){
   if(!cache.has(indexUrl))cache.set(indexUrl,(async()=> (await bounded(await fetcher(indexUrl,options()),4*1024*1024)).toString('utf8'))())
   const html=await cache.get(indexUrl);const candidates=[]
   for(const paper of html.matchAll(/<div\b[^>]*class=["']paper["'][^>]*>([\s\S]*?)<\/div>/gi)) {
    const title=decode(paper[1].match(/<p\b[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    if(normalized(title)!==normalized(entry.fields.title))continue
    const url=paper[1].match(/href=["']https?:\/\/proceedings\.mlr\.press\/v\d+\/[a-z0-9-]+\.html["']/i)?.[0].slice(6,-1)
    if(url && new URL(url).pathname.startsWith(`/v${volume}/`))candidates.push(url.replace(/^http:/,'https:'))
   }
   if(new Set(candidates).size!==1)return {url:indexUrl,coverage:'unavailable',reason:'No unique matching title in the official PMLR volume.'}
   page=candidates[0]
  }
  const html=(await bounded(await fetcher(page,options()),2*1024*1024)).toString('utf8')
  const meta=name=>[...html.matchAll(/<meta\b[^>]*>/gi)].flatMap(m=>{
   const attrs=Object.fromEntries([...m[0].matchAll(/([\w_-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(a=>[a[1].toLowerCase(),decode(a[3])]))
   return attrs.name===name?[attrs.content||'']:[]
  })
  const title=meta('citation_title')[0];const year=meta('citation_publication_date')[0]?.slice(0,4)
  const author=meta('citation_author').join(' and ')
  if(!candidateMatches(entry,{title,year,metadata:{title,year,author}}))return {url:page,coverage:'unavailable',reason:'The official PMLR record does not match the cited title, authors and year.'}
  abstract=decode(html.match(/<div\b[^>]*id=["']abstract["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
  const slug=new URL(page).pathname.match(/\/([a-z0-9-]+)\.html$/i)[1]
  const pdf=`https://proceedings.mlr.press/v${volume}/${slug}/${slug}.pdf`
  // The fetched page must explicitly advertise this same-host PDF.
  if(!meta('citation_pdf_url').some(url=>url.replace(/^http:/,'https:')===pdf))throw Error('No verified PDF link')
  const buffer=await bounded(await fetcher(pdf,options()),8*1024*1024)
  if(!buffer.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('Not PDF')
  const text=String(await extract(buffer)).trim();if(text.length<200)throw Error('No source text')
  return {url:pdf,landingUrl:page,coverage:text.length>90000?'partial-full-text':'full-text',text:text.slice(0,90000),truncated:text.length>90000}
 }catch {
  return abstract?{url:page,coverage:'abstract',text:abstract,reason:'PDF unavailable; official abstract only'}:{url:page||indexUrl,coverage:'unavailable',reason:'Official PMLR source could not be retrieved.'}
 }
}
