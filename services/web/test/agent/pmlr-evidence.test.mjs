import test from 'node:test'
import assert from 'node:assert/strict'
import {pmlrEvidence} from '../../app/src/Features/WritingAssist/WritingAssistPmlrEvidence.mjs'
import {createReferenceService} from '../../app/src/Features/WritingAssist/WritingAssistReferenceService.mjs'
import {buildClaimReview} from '../../app/src/Features/WritingAssist/WritingAssistClaimReview.mjs'
const title='Calibrate Before Use: Improving Few-Shot Performance of Language Models'
const entry={fields:{title,author:'Zhao, Zihao and Wallace, Eric',year:'2021',volume:'139',publisher:'PMLR'}}
const index=`<div class="paper"><p class="title">${title}</p><a href="https://proceedings.mlr.press/v139/zhao21c.html">abs</a></div>`
const html=`<meta name="citation_title" content="${title}"><meta name="citation_publication_date" content="2021/07/01"><meta name="citation_author" content="Zihao Zhao"><meta name="citation_author" content="Eric Wallace"><meta name="citation_pdf_url" content="http://proceedings.mlr.press/v139/zhao21c/zhao21c.pdf"><div id="abstract">This official abstract describes contextual calibration improving accuracy.</div>`
const source='Contextual calibration improves accuracy. '.repeat(20)
function fetcher(url,options){assert.equal(options.redirect,'error');return Promise.resolve(new Response(url.endsWith('.pdf')?'%PDF-1.4':url.endsWith('.html')?html:index))}
test('discovers a no-DOI/no-URL PMLR paper by volume and validates identity before PDF extraction',async()=>{
 const result=await pmlrEvidence(entry,fetcher,async()=>source)
 assert.equal(result.coverage,'full-text');assert.equal(result.text,source.trim());assert.equal(result.url,'https://proceedings.mlr.press/v139/zhao21c/zhao21c.pdf')
})
test('rejects wrong authors and never fetches arbitrary bibliography URLs',async()=>{
 const result=await pmlrEvidence({fields:{...entry.fields,author:'Wrong, Person'}},fetcher,()=>{throw Error('must not extract')});assert.equal(result.coverage,'unavailable')
 assert.equal(await pmlrEvidence({fields:{url:'http://localhost/private'}},()=>{throw Error('must not fetch')}),null)
})
test('falls back to verified official abstract when PDF is blocked',async()=>{
 const result=await pmlrEvidence(entry,(url,options)=>url.endsWith('.pdf')?new Response('',{status:403}):fetcher(url,options))
 assert.equal(result.coverage,'abstract');assert.match(result.text,/calibration improving accuracy/)
})
test('citation audit continues into PMLR after DOI search has no candidate',async()=>{
 let input;const bib='@inproceedings{z,'+Object.entries(entry.fields).map(([k,v])=>`${k}={${v}}`).join(',')+'}'
 const service=createReferenceService({canWrite:async()=>true,snapshot:async()=>[{id:'b',path:'refs.bib',content:bib},{id:'m',path:'intro.tex',content:'Claim \\cite{z}.'}],literature:{search:async()=>({results:[]})},fetcher:(url,options)=>url.endsWith('.pdf')?new Response('',{status:403}):fetcher(url,options),tasks:{create:async(u,p,prompt,options)=>{input=options.claimInput;return {taskId:'t'}}}})
 await service.start('u','p',{mode:'claims',docId:'b',keys:['z']})
 assert.equal(input.evidence[0].coverage,'abstract');assert.match(input.evidence[0].source.url,/proceedings.mlr.press/);assert.equal(input.evidence[0].reason,undefined)
})
test('review location uses the sentence start line, not the citation command line',()=>{
 const before='Contextual calibration\nimproves accuracy\n\\cite{z}.';const content='\n'.repeat(76)+before
 const review=buildClaimReview({checkedAt:'now',documents:[{id:'doc',path:'tex/02_related_work.tex',content}],contexts:[{id:'context-0',path:'tex/02_related_work.tex',line:79,keys:['z'],text:before}],evidence:[]},'{}')
 assert.equal(review.items[0].line,77);assert.equal(review.items[0].docId,'doc')
})
