import { AgentError } from './WritingAssistAgentService.mjs'
import { parseBibliography } from './WritingAssistBibTeX.mjs'

const escape = value => String(value).replace(/[\\{}%&#_$~^]/g, char => ({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','&':'\\&','#':'\\#','_':'\\_','$':'\\$','~':'\\textasciitilde{}','^':'\\textasciicircum{}'})[char])
const plain = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
const typeMap = { JOUR:'article', JFULL:'article', CONF:'inproceedings', CPAPER:'inproceedings', CHAP:'incollection', BOOK:'book', THES:'phdthesis', RPRT:'techreport', ELEC:'misc', GEN:'misc', 'Journal Article':'article', 'Conference Paper':'inproceedings', 'Conference Proceedings':'proceedings', 'Book Section':'incollection', Book:'book', Thesis:'phdthesis', Report:'techreport', 'article-journal':'article', 'paper-conference':'inproceedings', chapter:'incollection', book:'book', thesis:'phdthesis', report:'techreport', webpage:'misc' }
function serialize(type, fields, index) {
 if (!fields.title) throw new AgentError(422, `Reference ${index+1} has no title; complete it before importing`)
 return `@${type}{import${index+1},\n${Object.entries(fields).filter(([,v])=>v).map(([k,v])=>`  ${k} = {${escape(v)}}`).join(',\n')}\n}`
}
function tagged(input, endnote, warnings) {
 const records=[]
 let current=null; let last=''
 const finish=()=>{if(current){records.push(current);current=null;last=''}}
 for(const line of input.split(/\r?\n/)) {
  const m=line.match(endnote ? /^%([A-Za-z0-9@!&])\s+(.*)$/ : /^([A-Z0-9]{2})\s{2}-\s?(.*)$/)
  if(m){
   const [,tag,value]=m
   if(tag===(endnote?'0':'TY')) {if(current && !endnote) throw new AgentError(422,'RIS record is missing its ER terminator');finish();current={}}
   if(!current) throw new AgentError(422,'Reference record must start with TY or %0')
   if(!endnote && tag==='ER'){finish();continue}
   ;(current[tag] ||= []).push(value.trim());last=tag
  } else if(!line.trim()) { if(endnote) finish() }
  else if(current && last && /^\s/.test(line)) current[last][current[last].length-1]+=' '+line.trim()
  else throw new AgentError(422,'Unrecognized reference line; use RIS, EndNote tagged text, CSL-JSON or BibTeX')
 }
 if(current && !endnote) throw new AgentError(422,'RIS record is missing its ER terminator')
 finish()
 return records.map((record,index)=>{
  const first=(...tags)=>tags.flatMap(t=>record[t]||[]).find(Boolean)||''
  const many=(...tags)=>tags.flatMap(t=>record[t]||[])
  const kind=first(endnote?'0':'TY'); const type=typeMap[kind]||'misc'
  if(!typeMap[kind]) warnings.push(`Reference ${index+1}: unsupported type ${kind}; converted to misc`)
  const f={title:first(...(endnote?['T']:['TI','T1','CT'])),author:many(...(endnote?['A']:['AU','A1'])).join(' and ')}
  const year=first(...(endnote?['D']:['PY','Y1','DA'])).match(/\b\d{4}\b/)
  if(year) f.year=year[0]
  const venue=first(...(endnote?['J','B']:['T2','JF','JO','JA','BT']))
  if(venue) f[type==='article'?'journal':'booktitle']=venue
  const pairs=endnote?{publisher:['I'],address:['C'],volume:['V'],number:['N'],pages:['P'],doi:['R'],url:['U'],abstract:['X'],keywords:['K'],isbn:['@'],note:['Z'],editor:['E']}:{publisher:['PB'],address:['CY'],volume:['VL'],number:['IS'],doi:['DO'],url:['UR'],abstract:['AB','N2'],keywords:['KW'],note:['N1'],editor:['ED','A2']}
  for(const [field,tags] of Object.entries(pairs)) {
   const values=many(...tags);if(values.length) f[field]=values.join(field==='editor'?' and ':field==='keywords'?', ':'; ')
  }
  if(!endnote){
   const start=first('SP'); const end=first('EP');if(start) f.pages=end?`${start}--${end}`:start
   const serial=first('SN');if(serial) f[type==='article'?'issn':'isbn']=serial
  } else if(type==='article' && f.isbn) {f.issn=f.isbn;delete f.isbn}
  if(f.pages) f.pages=f.pages.replace(/(\d)\s*[-–—]+\s*(?=\d)/g,'$1--')
  const known=new Set(endnote?['0','T','A','D','J','B','I','C','V','N','P','R','U','X','K','@','Z','E']:['TY','TI','T1','CT','AU','A1','PY','Y1','DA','T2','JF','JO','JA','BT','PB','CY','VL','IS','DO','UR','AB','N2','KW','N1','ED','A2','SP','EP','SN','ID'])
  const unknown=Object.keys(record).filter(k=>!known.has(k));if(unknown.length) warnings.push(`Reference ${index+1}: fields requiring manual review: ${unknown.join(', ')}`)
  return serialize(type,f,index)
 }).join('\n\n')
}
function csl(input,warnings){
 let data
 try{data=JSON.parse(input)}catch{throw new AgentError(422,'Invalid CSL-JSON')}
 const records=Array.isArray(data)?data:[data]
 return records.map((r,index)=>{
  if(!r || typeof r!=='object' || Array.isArray(r) || !r.type) throw new AgentError(422,'Use CSL-JSON items with type and title fields')
  const type=typeMap[r.type]||'misc'; const f={title:plain(r.title)}
  for(const field of ['author','editor']) {
   if(r[field] && !Array.isArray(r[field])) throw new AgentError(422,`Invalid CSL ${field} list`)
   const names=(r[field]||[]).map(a=>{
    if(!a || typeof a!=='object') throw new AgentError(422,'Invalid CSL author')
    return a.literal ? plain(a.literal) : [plain(a.family),plain(a.given)].filter(Boolean).join(', ')
   });if(names.length) f[field]=names.join(' and ')
  }
  const date=r.issued?.['date-parts']?.[0]
  if(date?.[0]) f.year=plain(date[0]);if(date?.[1]) f.month=plain(date[1])
  const mapping={'container-title':type==='article'?'journal':'booktitle',publisher:'publisher','publisher-place':'address',DOI:'doi',URL:'url',ISBN:'isbn',ISSN:'issn',volume:'volume',issue:'number',page:'pages',abstract:'abstract',keyword:'keywords','event-place':'location','collection-title':'series',note:'note'}
  for(const [from,to] of Object.entries(mapping)) if(plain(r[from])) f[to]=plain(r[from])
  if(f.pages) f.pages=f.pages.replace(/(\d)\s*[-–—]+\s*(?=\d)/g,'$1--')
  const known=new Set(['id','type','title','author','editor','issued',...Object.keys(mapping)])
  const unknown=Object.keys(r).filter(k=>!known.has(k));if(unknown.length) warnings.push(`Reference ${index+1}: fields requiring manual review: ${unknown.join(', ')}`)
  return serialize(type,f,index)
 }).join('\n\n')
}
export function parseReferenceFile(input) {
 if(typeof input!=='string' || input.length>200000) throw new AgentError(422,'Choose a reference file smaller than 200 KB')
 const text=input.replace(/^\uFEFF/,'').trim(); const warnings=[]
 let format,bibtex
 if(/^TY\s{2}-/.test(text)){format='RIS';bibtex=tagged(text,false,warnings)}
 else if(/^%0\s/.test(text)){format='EndNote tagged';bibtex=tagged(text,true,warnings)}
 else if((text.startsWith('[') || text.startsWith('{'))){format='CSL-JSON';bibtex=csl(text,warnings)}
 else if(/@(?:article|book|inproceedings|incollection|misc|proceedings|techreport|phdthesis|mastersthesis|unpublished|online|inbook|manual|booklet|collection|string|comment|preamble)\s*[{(]/i.test(text)){format='BibTeX';bibtex=text}
 else throw new AgentError(422,'Unsupported file. Export BibTeX, RIS, EndNote tagged text or CSL-JSON; PDF and Word are not supported here.')
 const parsed=parseBibliography(bibtex)
 if(!parsed.entries.length || parsed.entries.length>50) throw new AgentError(422,'Import 1–50 references at a time')
 return {...parsed,format,warnings}
}
