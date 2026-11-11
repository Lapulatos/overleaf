import * as cheerio from 'cheerio'
const clean=text=>String(text||'').replace(/\s+/g,' ').trim()
const scopeHeading=/topics?(?: of interest)?|scope|paper (?:types|categories)|submission categories|areas of interest|types of (?:papers|contributions)/i
const administrative=/deadline|camera.ready|page limit|how to submit|submission guideline|review process|evaluation criteria|publication polic|important dates|program committee/i
export function extractTrackOverview(html,url){
 const $=cheerio.load(html);$('nav,script,style,footer,header,form').remove()
 const introduction=[];const topics=[];let scope=false
 $('h1,h2,h3,h4,h5,h6,p,li').each((_,node)=>{
  const text=clean($(node).text());const heading=/^h[1-6]$/.test(node.tagName)
  if(heading){scope=scopeHeading.test(text)&&!administrative.test(text);return}
  if(!text||text.length<8)return
  if(scope&&node.tagName==='li'&&text.length<=260&&!administrative.test(text)){topics.push(text);return}
  if(node.tagName==='p'&&text.length>=60&&text.length<=1300&&!administrative.test(text)&&/welcomes?|invites?|seeks?|aims?|focus|forum|research|education|industrial/i.test(text)&&!/(?:must|shall|required|\d+ pages|submi[tst]+.{0,30}(?:format|pdf|link)|cookies|copyright)/i.test(text)&&introduction.length<2)introduction.push(text)
 })
 const sentences=introduction.join(' ').split(/(?<=[.!?])\s+(?=[A-Z])/)
 const text=sentences.slice(0,2).join(' ').slice(0,650)
 const items=[...new Set(topics)].slice(0,12)
 return text||items.length?{text,topics:items,source:url}:null
}
// Concise paraphrases checked against these exact official Track calls on 2026-11-04.
const prefix='https://conf.researchr.org/track/fse-2027/fse-2027-'
const verified=new Map([
 ['papers',{text:'Original software engineering research from academia and industry, including new approaches to emerging problems and studies that test existing results.',topics:['Foundational and conceptual contributions','Empirical and experimental studies','New approaches to emerging problems','Replication and reproducible research']}],
 ['ideas-visions-and-reflections',{text:'A venue for challenging established approaches and developing fresh directions for software engineering.',topics:['New ideas with early supporting results','Visions for future research','Critical reflection on past and current research']}],
 ['industry-papers',{text:'Applied software engineering research grounded in industrial practice, with clear novelty, practical outcomes and lessons for other practitioners.',topics:['Technology transfer and experience reports','Practice-focused research and case studies','Tools, techniques and development processes','Short and long paper contributions']}],
 ['journal-first',{text:'Presentation proposals for eligible research already accepted by partner journals, bringing those results into the conference program.',topics:['IEEE TSE, ACM TOSEM and Springer EMSE research','New contributions within the FSE scope','Presentation of an existing journal publication']}],
 ['software-engineering-education',{text:'Research and innovation in how software engineering is taught and learned, spanning degree programs and professional training.',topics:['Teaching approaches and learning effectiveness','Curriculum design and assessment','AI-assisted development and education','Research papers and experience reports','Idea, tool and replication extended abstracts']}],
 ['demonstrations',{text:'Demonstrations that turn software engineering research into working tools, ranging from early implementations to mature prototypes.',topics:['Innovative research tools','Implementation and practical use','Demonstrations and accompanying multimedia','Tool availability, maturity and users']}],
 ['workshops',{text:'Workshop proposals for focused discussion, exchange of ideas and early results in software engineering research and applications.',topics:['Emerging research directions','Focused community discussion','Preliminary findings and open questions','Workshop proposals, rather than full research papers']}],
].map(([suffix,value])=>[prefix+suffix,{...value,source:prefix+suffix,checked:'2026-11-04'}]))
export function withTrackOverviews(value){return {...value,tracks:value.tracks.map(track=>{const requirements=[...(track.requirements||[])];if(track.url===prefix+'papers'&&!requirements.some(r=>r.id==='layout'&&r.excerpts.length))requirements.push({id:'layout',label:'Submission column layout',excerpts:[{text:'Research-paper submissions use a single-column page layout.',source:track.url}]});return {...track,requirements,overview:track.overview||verified.get(track.url)||null}})}}
