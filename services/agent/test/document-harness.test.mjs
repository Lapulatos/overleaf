import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { runDocumentHarness, disabledMcpConfiguration, disabledPluginConfiguration, assertDisabledMcpServers } from '../src/document-harness.mjs'

const documents = [{ path: 'main.tex', content: 'old\n', version: 9 }]
test('disabled connection inventory is accepted but active and tool-bearing connections fail closed', () => {
 assert.deepEqual(disabledMcpConfiguration({mcp_servers:{private:{token:'secret'}}}), {private:{enabled:false}})
 assert.deepEqual(disabledPluginConfiguration({plugins:{'browser@bundled':{enabled:true,token:'secret'}}}), {'browser@bundled':{enabled:false}})
 assert.deepEqual(disabledPluginConfiguration({}), {})
 assertDisabledMcpServers([{runtimeStatus:'disabled',tools:{}}])
 assert.throws(()=>assertDisabledMcpServers([{runtimeStatus:'ready',tools:{}}]))
 assert.throws(()=>assertDisabledMcpServers([{runtimeStatus:'disabled',tools:{read:{}}}]))
})
function clientFactory({ servers = [], run, capture }) {
 return async opts => {
  capture.directory=opts.cwd
  return {
   async request(method,params) {
    if(method==='config/read')return {config:{mcp_servers:{private:{token:'secret'}},plugins:{'browser@bundled':{enabled:true,token:'secret'}}}}
    if(method==='thread/start') {
     capture.start=params
     return {thread:{id:'thread'},cwd:opts.cwd,activePermissionProfile:{id:'overleaf_task'},instructionSources:[]}
    }
    if(method==='mcpServerStatus/list')return {data:servers}
    if(method==='turn/start') {capture.turn=params;queueMicrotask(()=>run(opts).catch(capture.onError));return {}}
    throw new Error('Unexpected method')
   },
   async close(){capture.closed=true},
  }
 }
}
test('actual workspace edits become versioned proposals and compiler output returns to the turn', async()=>{
 const capture={onError:error=>{throw error}}
 const result=await runDocumentHarness({documents,instruction:'edit',effort:'high',
  createClient:clientFactory({capture,run:async opts=>{
   await writeFile(join(opts.cwd,'main.tex'),'new\n')
   const tool=await opts.onRequest('item/tool/call',{threadId:'thread',tool:'compile_project',arguments:{rootFile:'main.tex'}})
   assert.equal(JSON.parse(tool.contentItems[0].text).success,true)
   opts.onNotification('item/completed',{threadId:'thread',item:{type:'agentMessage',text:'Edited and compiled'}})
   opts.onNotification('turn/completed',{threadId:'thread',turn:{status:'completed'}})
  }}),compiler:async()=>({success:true,log:'ok',pdfBytes:100})})
 assert.equal(result.changes[0].version,9)
 assert.equal(result.changes[0].after,'new\n')
 assert.equal(result.summary,'Edited and compiled')
 assert.equal(result.artifacts.length,1)
 assert.deepEqual(capture.start.config.mcp_servers,{private:{enabled:false}})
 assert.deepEqual(capture.start.config.plugins,{'browser@bundled':{enabled:false}})
 assert.equal(capture.turn.effort,'high')
 assert.equal(capture.closed,true)
 await assert.rejects(access(capture.directory))
})
test('unexpected external connections prevent any model turn',async()=>{
 const capture={}
 await assert.rejects(runDocumentHarness({documents,instruction:'edit',createClient:clientFactory({capture,servers:[{runtimeStatus:'ready',tools:{}}]})}),/external tool/)
 assert.equal(capture.turn,undefined)
 assert.equal(capture.closed,true)
 await assert.rejects(access(capture.directory))
})
test('deadline closes runtime and removes workspace without returning partial proposals',async()=>{
 const capture={onError:error=>{throw error}}
 await assert.rejects(runDocumentHarness({documents,instruction:'edit',timeout:30,createClient:clientFactory({capture,run:async()=>{}})}),/timed out/)
 assert.equal(capture.closed,true)
 await assert.rejects(access(capture.directory))
})
test('cancellation aborts an in-flight compiler and waits for its cleanup',async()=>{
 const capture={onError:()=>{}}
 const controller=new AbortController()
 let compilerStopped=false
 await assert.rejects(runDocumentHarness({documents,instruction:'compile',signal:controller.signal,
  createClient:clientFactory({capture,run:async opts=>{
   await opts.onRequest('item/tool/call',{threadId:'thread',tool:'compile_project',arguments:{rootFile:'main.tex'}})
  }}),
  compiler:({signal})=>new Promise((resolve,reject)=>{
   signal.addEventListener('abort',()=>{compilerStopped=true;reject(new Error('aborted'))},{once:true})
   controller.abort()
  })}),/cancelled/)
 assert.equal(compilerStopped,true)
 assert.equal(capture.closed,true)
 await assert.rejects(access(capture.directory))
})

test('missing dependency diagnostics reach the model while task returns an honest no-change report', async () => {
 const capture={onError:error=>{throw error}}
 const diagnostic={kind:'missing-input',file:'setspace.sty',guidance:'Report missing compiler package; stop retries.'}
 const result=await runDocumentHarness({documents,instruction:'compile',
  createClient:clientFactory({capture,run:async opts=>{
   const tool=await opts.onRequest('item/tool/call',{threadId:'thread',tool:'compile_project',arguments:{rootFile:'main.tex'}})
   const payload=JSON.parse(tool.contentItems[0].text)
   assert.equal(payload.success,false)
   assert.deepEqual(payload.diagnostic,diagnostic)
   opts.onNotification('item/completed',{threadId:'thread',item:{type:'agentMessage',text:'Compilation blocked by missing setspace.sty; no manuscript edits.'}})
   opts.onNotification('turn/completed',{threadId:'thread',turn:{status:'completed'}})
  }}),compiler:async()=>({success:false,log:'missing package',pdfBytes:0,diagnostic})})
 assert.deepEqual(result.changes,[])
 assert.match(result.summary,/blocked/)
 assert.match(capture.start.developerInstructions,/Do not repeat an unchanged failed compilation/)
})

test('public command deltas and per-command file diffs arrive before task completion',async()=>{
 const capture={onError:error=>{throw error}},events=[]
 await runDocumentHarness({documents,instruction:'edit in steps',onActivity:event=>events.push(event),createClient:clientFactory({capture,run:async opts=>{
  opts.onNotification('item/started',{threadId:'thread',item:{id:'cmd1',type:'commandExecution',command:'update main.tex'}})
  opts.onNotification('item/commandExecution/outputDelta',{threadId:'thread',itemId:'cmd1',delta:'Editing source'})
  await writeFile(join(opts.cwd,'main.tex'),'first change\n')
  opts.onNotification('item/completed',{threadId:'thread',item:{id:'cmd1',type:'commandExecution',command:'update main.tex',aggregatedOutput:'Done',exitCode:0}})
  for(let i=0;i<100&&!events.some(e=>e.id==='cmd1'&&e.changes);i++)await new Promise(r=>setTimeout(r,5))
  const first=events.find(e=>e.id==='cmd1'&&e.changes);assert.equal(first.changes[0].before,'old\n');assert.equal(first.changes[0].after,'first change\n')
  await writeFile(join(opts.cwd,'main.tex'),'second change\n')
  opts.onNotification('item/completed',{threadId:'thread',item:{id:'cmd2',type:'commandExecution',command:'update again',exitCode:0}})
  for(let i=0;i<100&&!events.some(e=>e.id==='cmd2'&&e.changes);i++)await new Promise(r=>setTimeout(r,5))
  const second=events.find(e=>e.id==='cmd2'&&e.changes);assert.equal(second.changes[0].before,'first change\n');assert.equal(second.changes[0].after,'second change\n')
  assert.ok(events.some(e=>e.output==='Editing source'))
  opts.onNotification('turn/completed',{threadId:'thread',turn:{status:'completed'}})
 }})})
})

test('generic dynamic completion cannot overwrite authoritative compile and fetch failures',async()=>{
 const capture={onError:error=>{throw error}},events=new Map()
 await runDocumentHarness({documents,instruction:'check',onActivity:e=>events.set(e.id,{...events.get(e.id),...e}),compiler:async()=>({success:false,log:'Fatal error: missing class'}),createClient:clientFactory({capture,run:async opts=>{
  await opts.onRequest('item/tool/call',{threadId:'thread',callId:'compile-call',tool:'compile_project',arguments:{rootFile:'main.tex'}})
  opts.onNotification('item/completed',{threadId:'thread',item:{id:'compile-call',type:'dynamicToolCall',tool:'compile_project',status:'completed'}})
  await opts.onRequest('item/tool/call',{threadId:'thread',callId:'fetch-call',tool:'fetch_public_source',arguments:{url:'file:///not-allowed'}})
  opts.onNotification('item/completed',{threadId:'thread',item:{id:'fetch-call',type:'dynamicToolCall',tool:'fetch_public_source',status:'completed'}})
  opts.onNotification('turn/completed',{threadId:'thread',turn:{status:'completed'}})
 }})})
 assert.equal(events.get('compile-call').title,'Compile main.tex');assert.equal(events.get('compile-call').status,'failed');assert.equal(events.get('compile-call').toolSuccess,false)
 assert.equal(events.get('fetch-call').status,'failed');assert.equal(events.get('fetch-call').toolSuccess,false)
})
