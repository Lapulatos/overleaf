import test from 'node:test'
import assert from 'node:assert/strict'
import {compilationEvidence,sourceFailure} from '@overleaf/validation-tools/agent-tool-evidence.mjs'
import {sourceFailureDetails} from '../../app/src/Features/SubmissionDeadlines/PublicPage.mjs'
test('legacy PDF inspection proves compilation but generic completed alone does not',()=>{
 const compile={kind:'tool',title:'compile_project',status:'completed',output:'truncated log'}
 assert.equal(compilationEvidence([compile]).compiled,false)
 const inspect={kind:'tool',title:'inspect_compiled_pdf',status:'completed',output:'Rendered manuscript text'}
 assert.equal(compilationEvidence([compile,inspect]).compiled,true)
 assert.equal(compilationEvidence([compile,inspect,{...compile,toolSuccess:false}]).compiled,false)
})
test('HTTP403 is distinguishable from missing template, DNS and timeout',()=>{
 const result=sourceFailureDetails(Object.assign(Error('Source returned HTTP 403'),{status:403,url:'https://publisher.example/template'}))
 assert.equal(result.kind,'access-denied');assert.equal(result.url,'https://publisher.example/template');assert.match(result.explanation,/does not show/)
 assert.equal(sourceFailureDetails(Error('Source returned HTTP 404')).kind,'not-found')
 assert.equal(sourceFailureDetails(Object.assign(Error('DNS'),{code:'ENOTFOUND'})).kind,'dns')
 assert.equal(sourceFailureDetails(Error('read ETIMEDOUT')).kind,'timeout')
 assert.equal(sourceFailure({title:'fetch_public_source',status:'completed',output:JSON.stringify(result)}).httpStatus,403)
})

test('long conference programs do not truncate the identified call-for-papers section',async()=>{
 const {readableSourcePage}=await import('../../app/src/Features/SubmissionDeadlines/PublicPage.mjs')
 const result=readableSourcePage('<html><body><div>'+('Schedule '.repeat(15000))+'</div><section id="call-for-papers"><p>Use anonymous review mode and the official LaTeX template. '+('Author instruction '.repeat(10))+'</p><a href="/template.zip">Download template</a></section><script>do not include this script</script></body></html>','https://conference.example/track')
 assert.match(result.text.slice(0,1000),/anonymous review/);assert.match(result.text.slice(0,1000),/https:\/\/conference.example\/template.zip/);assert.doesNotMatch(result.text,/do not include this script/)
})

test('configured proxy respects NO_PROXY and pins CONNECT destination to validated public IP',async()=>{
 const {configuredSourceProxy,pinnedProxyOptions}=await import('../../app/src/Features/SubmissionDeadlines/PublicPage.mjs')
 const env={HTTPS_PROXY:'http://127.0.0.1:8080',NO_PROXY:'.internal.example,localhost'}
 assert.equal(configuredSourceProxy('https://publisher.example',env).hostname,'127.0.0.1')
 assert.equal(configuredSourceProxy('https://host.internal.example',env),null)
 assert.equal(configuredSourceProxy('https://publisher.example',{...env,NO_PROXY:'*'}),null)
 assert.deepEqual(pinnedProxyOptions({host:'publisher.example',port:443,secureEndpoint:true},'93.184.216.34','publisher.example'),{host:'93.184.216.34',port:443,secureEndpoint:true,servername:'publisher.example'})
 assert.equal(sourceFailureDetails(Object.assign(Error('Source returned HTTP 403'),{status:403,proxyFailure:true})).kind,'proxy-access-denied')
})
