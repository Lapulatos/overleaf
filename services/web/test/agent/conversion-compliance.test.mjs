import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {assessCompliance,requiredChecks} from '../../app/src/Features/SubmissionDeadlines/ConversionCompliance.mjs'
function fixture(){
 const files=new Map([['main.tex',Buffer.from('\\documentclass[review,anonymous]{acmart}\n\\begin{document}Text\\end{document}')]])
 const url='https://publisher.example/author-guide'
 const audit={version:1,venueId:'v',stage:'initial submission',rootPath:'main.tex',documentClass:{name:'acmart',options:['anonymous','review']},files:[{path:'main.tex',sha256:createHash('sha256').update(files.get('main.tex')).digest('hex')}],checks:requiredChecks.map(id=>({id,status:'passed',requirement:'Applicable initial submission rule',before:'Original conference mode',after:'Checked final output',action:'Adjusted and checked',files:['main.tex'],sources:[{url,quote:'Use the review template.'}]}))}
 const task={status:'completed',activity:[{kind:'tool',title:'Read official source / template',status:'completed',output:JSON.stringify({url,text:'Use the review template.'})},{kind:'tool',title:'Compile main.tex',status:'completed'},{kind:'tool',title:'inspect_compiled_pdf',status:'completed',output:'PDF text'}]}
 const run=()=>{files.set('submission-compliance.json',Buffer.from(JSON.stringify(audit)));return assessCompliance(files,task,'v','main.tex')}
 return {files,audit,task,run}
}
test('complete audit with fetched evidence and final file hashes permits automatic import',()=>assert.equal(fixture().run().ready,true))
test('successful compilation alone never permits automatic import',()=>{const f=fixture();assert.equal(assessCompliance(f.files,f.task,'v','main.tex').ready,false)})
test('unknown anonymity or missing mandatory category blocks automatic import',()=>{const f=fixture();f.audit.checks.find(c=>c.id==='anonymity').status='unverified';assert.equal(f.run().ready,false);f.audit.checks=[];assert.equal(f.run().ready,false)})
test('stale audit, invented source and mismatched target cannot pass',()=>{for(const mutate of [f=>f.files.set('main.tex',Buffer.from('changed')),f=>f.audit.venueId='other',f=>f.audit.checks[0].sources[0].url='https://unfetched.example',f=>f.audit.documentClass.options=['sigconf'],f=>f.audit.files=[]]){const f=fixture();mutate(f);assert.equal(f.run().ready,false)}})
test('failed last compilation blocks an otherwise complete audit',()=>{const f=fixture();f.task.activity.push({kind:'tool',title:'Compile main.tex',status:'failed'});assert.equal(f.run().ready,false)})
test('missing applicability cannot be disguised as not-applicable for anonymity',()=>{const f=fixture();f.audit.checks.find(c=>c.id==='anonymity').status='not-applicable';assert.equal(f.run().ready,false)})

test('malformed model audit is a draft, not a server error',()=>{const f=fixture();f.audit.files=[null];f.audit.checks=[null];assert.equal(f.run().ready,false)})

test('previous-edition compliance remains provisional with a visible year',()=>{const f=fixture();f.audit.checks[0].basis={kind:'previous-edition',year:2026,url:'https://publisher.example/author-guide'};const r=f.run();assert.equal(r.ready,false);assert.equal(r.checks[0].status,'provisional');assert.equal(r.checks[0].severity,'warning');assert.equal(r.checks[0].basis.year,2026)})
