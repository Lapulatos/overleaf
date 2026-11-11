import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyReferenceIdentity} from '../../app/src/Features/WritingAssist/WritingAssistReferenceVerification.mjs'
import {createReferenceService} from '../../app/src/Features/WritingAssist/WritingAssistReferenceService.mjs'
const title="The Internal State of an LLM Knows When It's Lying"
const doi='10.18653/v1/2023.findings-emnlp.68'
const fields={title,author:'Azaria, Amos and Mitchell, Tom',year:'2023',doi,pages:'967--976',publisher:'Association for Computational Linguistics',address:'Stroudsburg, PA, USA',url:`https://doi.org/${doi}`}
const bib=fields=>'@inproceedings{x,'+Object.entries(fields).map(([k,v])=>`${k}={${v}}`).join(',')+'}'
const citation={title,doi,year:2023,sourceUrl:'https://api.crossref.org/works/'+doi,metadata:fields,bibtex:bib(fields)}
const entry={fields:{title,author:fields.author,year:'2023'}}
const official=async(url,options)=>{assert.equal(url,'https://aclanthology.org/2023.findings-emnlp.68.bib');assert.equal(options.redirect,'error');return new Response(bib({...fields,address:'Singapore'}))}
test('missing DOI is automatically verified with title/authors/year and two real records',async()=>{
 const result=await verifyReferenceIdentity(entry,citation,{fetcher:official})
 assert.equal(result.verified,true);assert.equal(result.sources.length,2);assert.match(result.summary,/ACL Anthology/);assert.ok(result.blockedFields.address);assert.equal(result.blockedFields.doi,undefined);assert.ok(result.crossCheckedFields.includes('doi'));assert.ok(!result.crossCheckedFields.includes('address'))
})
test('a conflicting year/version or same-title different authors stays unresolved',async()=>{
 for(const change of [{year:'2022'},{author:'Other, Person'}]){
  const result=await verifyReferenceIdentity({fields:{...entry.fields,...change}},citation,{fetcher:official});assert.equal(result.verified,false)
 }
 const conflict=await verifyReferenceIdentity(entry,citation,{fetcher:async()=>new Response(bib({...fields,year:'2024'}))});assert.equal(conflict.verified,false)
})
test('unavailable publisher is not a bibliographic error; validated DOI identity still works',async()=>{
 const result=await verifyReferenceIdentity(entry,citation,{fetcher:async()=>new Response('',{status:403})});assert.equal(result.verified,true);assert.equal(result.officialUnavailable,true);assert.equal(result.sources.length,1)
})
test('metadata audit verifies a title search result by DOI lookup and enables unconflicted fields',async()=>{
 let options;let lookups=0
 const service=createReferenceService({canWrite:async()=>true,snapshot:async()=>[{id:'b',path:'refs.bib',content:bib(entry.fields)}],fetcher:official,literature:{search:async()=>({results:[citation]}),lookup:async(u,p,id)=>{assert.equal(id,doi);lookups++;return citation}},tasks:{create:async(u,p,prompt,value)=>{options=value;return {taskId:'t'}}}})
 await service.start('u','p',{mode:'metadata',docId:'b',keys:['x']})
 const result=options.referenceReview.entries[0]
 assert.equal(lookups,1);assert.equal(result.identity,null);assert.equal(result.reason,null);assert.equal(result.verification.verified,true)
 assert.ok(result.actions.some(a=>a.field==='doi'));assert.ok(result.actions.some(a=>a.field==='url'));assert.equal(result.actions.some(a=>a.field==='address'),false)
 assert.match(result.fields.find(f=>f.field==='address').verificationReason,/disagree/)
})
test('an unrelated supplied DOI is recovered using matching title, authors and year',async()=>{
 let options
 const unrelated={...citation,doi:'10.1234/wrong',title:'Unrelated',metadata:{title:'Unrelated',author:'Other, Author',year:'2020',doi:'10.1234/wrong'},bibtex:bib({title:'Unrelated',author:'Other, Author',year:'2020',doi:'10.1234/wrong'})}
 const service=createReferenceService({canWrite:async()=>true,snapshot:async()=>[{id:'b',path:'refs.bib',content:bib({...entry.fields,doi:'10.1234/wrong',url:'https://doi.org/10.1234/wrong'})}],fetcher:official,literature:{search:async()=>({results:[citation]}),lookup:async(u,p,id)=>id===doi?citation:unrelated},tasks:{create:async(u,p,prompt,value)=>{options=value;return {taskId:'t'}}}})
 await service.start('u','p',{mode:'metadata',docId:'b',keys:['x']})
 const result=options.referenceReview.entries[0];assert.equal(result.verification.verified,true);assert.equal(result.actions.find(a=>a.field==='doi').after,doi);assert.equal(result.actions.find(a=>a.field==='url').after,`https://doi.org/${doi}`)
})
test('a minor author spelling error can be resolved by agreeing official and registry records',async()=>{
 const result=await verifyReferenceIdentity({fields:{...entry.fields,author:'Azaira, Amos and Mitchell, Tom'}},citation,{fetcher:official});assert.equal(result.verified,true)
 const clash=await verifyReferenceIdentity(entry,citation,{fetcher:async()=>new Response(bib({...fields,author:'Azaria, Alice and Mitchell, Tom'}))});assert.equal(clash.verified,false);assert.ok(clash.blockedFields.author)
})
test('a different paper by the same authors is not validated just because its DOI resolves',async()=>{
 const different={...citation,title:'An entirely different research paper',metadata:{...fields,title:'An entirely different research paper'},bibtex:bib({...fields,title:'An entirely different research paper'})}
 const result=await verifyReferenceIdentity(entry,different,{suppliedDoi:doi,fetcher:async()=>new Response('',{status:403})});assert.equal(result.verified,false)
})
