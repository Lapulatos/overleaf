import test from 'node:test'
import assert from 'node:assert/strict'
import {aclEvidence} from '../../app/src/Features/WritingAssist/WritingAssistClaimSource.mjs'
import {citationContexts} from '../../app/src/Features/WritingAssist/WritingAssistBibTeX.mjs'
test('ACL DOI resolves only to official PDF and extracts bounded evidence',async()=>{
 const text='Verified paper content. '.repeat(20)
 const result=await aclEvidence({fields:{doi:'10.18653/v1/D19-1275'}},async(url,options)=>{assert.equal(url,'https://aclanthology.org/D19-1275.pdf');assert.equal(options.redirect,'error');return new Response('%PDF-1.4 fake')},async()=>text)
 assert.equal(result.coverage,'full-text');assert.equal(result.text,text.trim())
})
test('failed PDF falls back to official abstract and arbitrary hosts are never requested',async()=>{
 const calls=[]
 const result=await aclEvidence({fields:{url:'https://aclanthology.org/D19-1275/'}},async url=>{calls.push(url);return url.endsWith('.pdf')?new Response('',{status:403}):new Response('@article{x,title={Paper},abstract={Only this abstract is available.}}')})
 assert.equal(result.coverage,'abstract');assert.equal(result.text,'Only this abstract is available.');assert.equal(calls.length,2)
 for(const url of ['http://localhost/D19-1275','https://aclanthology.org.evil.test/D19-1275/','https://aclanthology.org/../admin'])assert.equal(await aclEvidence({fields:{url}},()=>{throw Error('must not fetch')}),null)
})
test('citation context keeps the cited sentence and excludes surrounding paragraph',()=>{
 const text='Unrelated introduction. The probe is selective \\citep{hewitt2019designing}. Another unrelated conclusion.'
 const result=citationContexts([{path:'main.tex',content:text}],['hewitt2019designing'])
 assert.equal(result.contexts[0].text,'The probe is selective \\citep{hewitt2019designing}.')
})

test('first sentence retains its first character and exact source text',()=>{
 const result=citationContexts([{path:'main.tex',content:'A claim \\cite{a}. Following sentence.'}],['a'])
 assert.equal(result.contexts[0].text,'A claim \\cite{a}.')
})
