import test from 'node:test'
import assert from 'node:assert/strict'
import { citationKey, uniqueCitationKey } from '../../app/src/Features/WritingAssist/WritingAssistCitationKey.mjs'
import { parseBibliography, citationContexts } from '../../app/src/Features/WritingAssist/WritingAssistBibTeX.mjs'
import { createReferenceService, arxivEvidence } from '../../app/src/Features/WritingAssist/WritingAssistReferenceService.mjs'

test('citation IDs follow author-year-title, preserve compound surnames and disambiguate',()=>{
 assert.equal(citationKey({authors:[{family:'Cao'}],year:2024,title:'Spiking neural networks'}),'cao2024spiking')
 assert.equal(citationKey({authors:[{family:'Ponce-de-León'}],year:2023,title:'Dartagnan'}),'poncedeleon2023dartagnan')
 assert.equal(uniqueCitationKey('cao2024spiking',new Set(['cao2024spiking','cao2024spikinga'])),'cao2024spikingb')
 assert.equal(citationKey({title:'Title'}),'anonymousndtitle')
})
test('BibTeX scanner preserves nested braces, escaped quotes, concatenation and macro uncertainty',()=>{
 const value='% @article{ignored,}\n@string{venue="Journal"}\n@article{cao2024spiking, title={{Spiking} and \\{braces\\}}, author="Cao, A and {Team}", year=2024, journal=venue, pages={1--9}}'
 const parsed=parseBibliography(value)
 assert.equal(parsed.entries.length,1);assert.equal(parsed.entries[0].fields.title,'{Spiking} and \\{braces\\}');assert.deepEqual(parsed.entries[0].unresolved,['journal']);assert.equal(parsed.special[0],'string')
 assert.equal(parseBibliography('@article(x,title="A" # { B},year=2024)').entries[0].fields.title,'A B')
 assert.throws(()=>parseBibliography('@article{x,title={broken}'),{status:422})
 assert.throws(()=>parseBibliography('@article{x,title={a},title={b}}'),{status:422})
})
test('citation contexts exclude comments and nocite, retain exact keys and line locations',()=>{
 const docs=[{path:'main.tex',content:'% \\cite{ignored}\nA claim \\citep[p. 2]{cao2024spiking,other}.\n\\nocite{cao2024spiking}\nUnrelated prose.'}]
 const result=citationContexts(docs,['cao2024spiking'])
 assert.equal(result.contexts.length,1);assert.equal(result.contexts[0].line,2);assert.deepEqual(result.contexts[0].keys,['cao2024spiking']);assert.equal(result.truncated,false)
})
const bib={id:'bib',path:'refs.bib',version:4,content:'@article{cao2024spiking,title={Spiking},author={Cao, A},year={2024},doi={10.1234/spiking}}'}
function fixture(){
 const state={allowed:true,calls:0,submitted:null}
 const service=createReferenceService({canWrite:async()=>state.allowed,snapshot:async()=>[bib,{id:'tex',path:'main.tex',version:3,content:'Claim \\cite{cao2024spiking}.\n'}],literature:{lookup:async()=>{state.calls++;return {title:'Spiking',url:'https://doi.org/10.1234/spiking',sourceUrl:'https://api.crossref.org/works/10.1234%2Fspiking',metadata:{title:'Spiking',author:'Cao, A',year:'2023',doi:'10.1234/spiking'},abstract:'The study reports an experiment.'}}},tasks:{create:async(u,p,instruction,options)=>{state.submitted={instruction,options};return {taskId:'t',status:'running'}}}})
 return {state,service}
}
test('metadata audit is authorized, scoped, read-only and includes differences and unavailable fields',async()=>{
 const {state,service}=fixture();state.allowed=false
 await assert.rejects(service.start('u','p',{mode:'metadata',docId:'bib',keys:['cao2024spiking']}),{status:403});assert.equal(state.calls,0)
 state.allowed=true;await service.start('u','p',{mode:'metadata',docId:'bib',keys:['cao2024spiking']})
 assert.equal(state.submitted.options.reportOnly,true)
 assert.equal(state.submitted.options.referenceReview.entries[0].key,"cao2024spiking")
 assert.equal(state.submitted.options.referenceReview.docId,"bib")
 const documents=state.submitted.options.prepareDocuments([])
 assert.equal(documents.length,2);assert.equal(documents.some(doc=>doc.path==='main.tex'),false)
 const data=JSON.parse(documents[1].content)
 assert.equal(data.evidence[0].fields.find(f=>f.field==='year').status,'review-difference')
 assert.equal(data.evidence[0].fields.find(f=>f.field==='publisher').status,'source-missing')
 assert.equal(data.contexts.contexts.length,0);assert.ok(state.submitted.instruction.length<32000)
})
test('support audit attaches only citation contexts and labels abstract evidence limits',async()=>{
 const {state,service}=fixture();await service.start('u','p',{mode:'claims',docId:'bib',keys:['cao2024spiking']})
 const data=JSON.parse(state.submitted.options.prepareDocuments([])[1].content)
 assert.equal(data.contexts.contexts[0].line,1);assert.equal(data.evidence[0].coverage,'abstract')
 assert.match(state.submitted.instruction,/insufficient evidence/);assert.match(state.submitted.instruction,/do not edit or create any files/i)
})
test('invalid and duplicated selected keys are rejected before source requests',async()=>{
 const {state,service}=fixture()
 await assert.rejects(service.start('u','p',{mode:'metadata',docId:'bib',keys:['missing']}),{status:422})
 await assert.rejects(service.start('u','p',{mode:'claims',docId:'bib',keys:['x','x']}),{status:400});assert.equal(state.calls,0)
})
test('arxiv evidence uses fixed host, no redirects and never treats blocked source as false',async()=>{
 let calls=0
 assert.equal(await arxivEvidence({fields:{url:'http://localhost/2401.12345'}},()=>{calls++}),null);assert.equal(calls,0)
 const value=await arxivEvidence({fields:{eprint:'2401.12345v2'}},async(url,opts)=>{assert.equal(url,'https://arxiv.org/html/2401.12345v2');assert.equal(opts.redirect,'error');return new Response('',{status:403})})
 assert.equal(value.coverage,'unavailable');assert.match(value.reason,/not evidence/)
 const available=await arxivEvidence({fields:{eprint:'2401.12345'}},async()=>new Response('<article><h2>Results</h2><p>Evidence.</p></article>'))
 assert.equal(available.coverage,'full-text');assert.match(available.text,/Evidence/)
})

test('retired formatting mode never creates a style-changing task or attachment', async () => {
 const {state,service}=fixture();await assert.rejects(service.start('u','p',{mode:'format'}),{status:410})
 assert.equal(state.submitted,null)
})

test('clipboard HTML outside entries is skipped without interpreting embedded @ records', () => {
 const text='@article{x,title={A < B},url={https://doi.org/10.1234/x}}<a class="easyScholarDOI" href="https://invalid"><svg><image href="data:image/png;base64,xyz@broken" /></svg></a>\n@book{y,title={Next}}'
 const parsed=parseBibliography(text)
 assert.equal(parsed.entries.length,2);assert.equal(parsed.entries[0].fields.title,'A < B')
 assert.equal(parsed.markup.length,1);assert.equal(parsed.entries[0].raw.includes('easyScholar'),false)
 assert.throws(()=>parseBibliography('@book{x,title={A}}<a href="x">broken'),{status:422})
})

test('completion preserves unknown fields, macros, existing keys and offers a versioned review only', async () => {
 const { completeEntry } = await import('../../app/src/Features/WritingAssist/WritingAssistReferenceCompletion.mjs')
 const { citationFromWork } = await import('../../app/src/Features/WritingAssist/WritingAssistLiteratureService.mjs')
 const citation=citationFromWork({DOI:'10.1234/test',title:['Correct'],author:[{family:'Farzan',given:'Azadeh'}],published:{'date-parts':[[2022,6]]},type:'proceedings-article','container-title':['Proceedings'],page:'506–521',ISBN:['123'],publisher:'ACM',abstract:'<jats:p>Verified abstract.</jats:p>'})
 const doc={id:'bib',path:'refs.bib',version:8,content:'@inproceedings{old,title={Wrong},year={2021},doi={10.1234/test},custom={retain},publisher=pub}\n<a><svg>data:image/png;base64,xxx</svg></a>'}
 const entry=parseBibliography(doc.content).entries[0]
 const completed=completeEntry(entry,citation)
 const parsed=parseBibliography(completed.raw).entries[0]
 assert.equal(parsed.key,'old');assert.equal(parsed.fields.custom,'retain');assert.equal(parsed.fields.publisher,'pub')
 assert.equal(parsed.fields.pages,'506--521');assert.equal(parsed.fields.numpages,'16');assert.equal(parsed.fields.isbn,'123');assert.equal(parsed.fields.abstract,'Verified abstract.')
 let saved
 const service=createReferenceService({canWrite:async()=>true,snapshot:async()=>[doc],literature:{lookup:async()=>citation},store:{create:async t=>{saved=t}},tasks:{get:async()=>saved}})
 const result=await service.start('u','p',{mode:'complete',docId:'bib',keys:['old']})
 assert.equal(result.proposals.length,1);assert.equal(result.proposals[0].status,'pending');assert.equal(result.proposals[0].version,8)
 assert.equal(result.proposals[0].before,doc.content);assert.equal(result.proposals[0].after.includes('<svg>'),false)
 assert.match(result.summary,/https:\/\/api.crossref.org/)
})

test('completion does not edit an ambiguous title-only candidate or invent missing source fields', async () => {
 let saved
 const service=createReferenceService({canWrite:async()=>true,snapshot:async()=>[{id:'b',path:'x.bib',version:1,content:'@book{x,title={Same},year={2020}}'}],literature:{search:async()=>({results:[{title:'Same',metadata:{year:'2024'},sourceUrl:'https://api.crossref.org/works/x'}]})},store:{create:async t=>{saved=t}},tasks:{get:async()=>saved}})
 const result=await service.start('u','p',{mode:'complete',docId:'b',keys:['x']})
 assert.equal(result.proposals.length,0);assert.match(result.summary,/Publication year differs/)
})

test('ACM-shaped metadata enriches BibTeX only and preserves journal style and manuscript', async () => {
 const original={id:'b',path:'references.bib',version:2,content:'@inproceedings{farzan2022sound,title={Sound sequentialization for concurrent program verification},doi={10.1145/3519939.3523727}}'}
 const main={id:'m',path:'main.tex',version:9,content:'\\documentclass{sn-jnl}\n\\bibliographystyle{sn-basic}\n\\bibliography{references}'}
 const bst={id:'s',path:'sn-basic.bst',version:1,content:'original journal style'}
 const before=JSON.stringify([original,main,bst]);let saved
 const sourceFields={author:'Farzan, Azadeh and Klumpp, Dominik and Podelski, Andreas',title:'Sound sequentialization for concurrent program verification',year:'2022',isbn:'9781450392655',publisher:'Association for Computing Machinery',address:'New York, NY, USA',url:'https://doi.org/10.1145/3519939.3523727',doi:'10.1145/3519939.3523727',abstract:'Supplied source abstract.',booktitle:'Proceedings of the 43rd ACM SIGPLAN International Conference on Programming Language Design and Implementation',pages:'506--521',numpages:'16',keywords:'Concurrency, Partial Order Reduction, Sequentialization',location:'San Diego, CA, USA',series:'PLDI 2022'}
 const citation={sourceUrl:'https://doi.org/10.1145/3519939.3523727',metadata:sourceFields,bibtex:'@inproceedings{source,\n'+Object.entries(sourceFields).map(([k,v])=>`${k}={${v}}`).join(',\n')+'\n}'}
 const service=createReferenceService({canWrite:async()=>true,snapshot:async()=>[original,main,bst],literature:{lookup:async()=>citation},store:{create:async t=>{saved=t}},tasks:{get:async()=>saved,create:async()=>{throw Error('No formatting agent may run')}}})
 const result=await service.start('u','p',{mode:'complete',docId:'b',keys:['farzan2022sound']})
 assert.deepEqual(result.proposals.map(p=>p.path),['references.bib'])
 assert.deepEqual(result.documents.map(p=>p.path),['references.bib'])
 const entry=parseBibliography(result.proposals[0].after).entries[0]
 assert.equal(entry.key,'farzan2022sound');assert.deepEqual(entry.fields,sourceFields)
 assert.equal(JSON.stringify([original,main,bst]),before)
})

test('citation full text lookup still runs when metadata has no exact title match',async()=>{
 let submitted
 const doc={id:'b',path:'r.bib',version:1,content:'@misc{m,title={Mamba},eprint={2312.00752v2}}'}
 const service=createReferenceService({canWrite:async()=>true,snapshot:async()=>[doc,{id:'t',path:'main.tex',version:1,content:'A claim \\cite{m}.'}],literature:{search:async()=>({results:[]})},fetcher:async()=>new Response('<article><p>Exact source text with enough detail for a citation review.</p></article>'),tasks:{create:async(u,p,prompt,options)=>{submitted=options;return {taskId:'t'}}}})
 await service.start('u','p',{mode:'claims',docId:'b',keys:['m']})
 assert.equal(submitted.claimInput.evidence[0].fullText.coverage,'full-text')
 assert.match(submitted.claimInput.evidence[0].fullText.text,/Exact source text/)
})
