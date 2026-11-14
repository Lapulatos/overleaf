import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createTerminalTools,terminalToolDefinitions} from '../src/terminal-session-tools.mjs'
async function fixture(action,run){
 const calls=[];const server=createServer(async(req,res)=>{let text='';for await(const b of req)text+=b;const body=JSON.parse(text);calls.push(body);assert.equal(req.headers.authorization,'Bearer private-test-token');res.setHeader('Content-Type','application/json');const result=action(body,calls.length);res.end(JSON.stringify(result))})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const directory=await mkdtemp(join(tmpdir(),'terminal-tool-test-'))
 const tool=createTerminalTools({url:`http://127.0.0.1:${server.address().port}`,id:'grant',token:'private-test-token'},{directory,signal:new AbortController().signal,onProgress:()=>{}})
 try{await run(tool,calls,directory)}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true})}
}
test('terminal tools expose four bounded actions',()=>{assert.equal(terminalToolDefinitions.length,4);for(const d of terminalToolDefinitions)assert.equal(d.inputSchema.additionalProperties,false)})
test('file reads return text or binary metadata without raw base64',async()=>fixture(()=>({files:[{path:'a.txt',data:Buffer.from('hello').toString('base64'),sha256:'a'},{path:'b.bin',data:Buffer.from([0,255]).toString('base64'),sha256:'b'}]}),async tool=>{const r=await tool('read_terminal_files',{reference:'terminal/ssh/id',paths:['a.txt','b.bin']});assert.equal(r.files[0].text,'hello');assert.equal(r.files[1].binary,true);assert.equal(r.files[1].data,undefined)}))
test('project transfer exports actual bytes and polls approval without resubmitting',async()=>fixture((b)=>b.action==='poll'?{state:'completed',result:{completed:['sample.txt']}}:{state:'pending',operationId:'op'},async(tool,calls,directory)=>{await writeFile(join(directory,'sample.txt'),'actual bytes');const result=await tool('transfer_terminal_files',{source:'project',destination:'terminal/ssh/id',paths:['sample.txt']});assert.deepEqual(result.completed,['sample.txt']);assert.equal(Buffer.from(calls[0].files[0].data,'base64').toString(),'actual bytes');assert.equal(calls.filter(c=>c.action==='copy').length,1);assert.equal(calls[1].action,'poll')}))
test('uncertain command failure is not retried',async()=>fixture(()=>({state:'failed',error:'Inspect session before retrying'}),async(tool,calls)=>{await assert.rejects(()=>tool('execute_terminal_command',{reference:'terminal/ssh/id',command:'echo x'}),/Inspect session/);assert.equal(calls.length,1)}))
