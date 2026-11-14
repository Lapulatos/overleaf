// Transport/lifecycle adapter only: ssh2 implements SSH + PTY; tmux owns shells.
import http from 'node:http'
import {createSshNodes} from './ssh-nodes.mjs'
import {readFileSync} from 'node:fs'
import {randomUUID,timingSafeEqual} from 'node:crypto'
import {StringDecoder} from 'node:string_decoder'
import {Client} from 'ssh2'
const config=JSON.parse(readFileSync(process.env.OVERLEAF_REMOTE_TERMINAL_CONFIG,'utf8'))
const clients=new Map(), uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
function connect(node){return new Promise((resolve,reject)=>{const c=new Client();c.once('ready',()=>resolve(c)).on('error',()=>{c.end();reject(fail('SSH connection unavailable or host key mismatch',503))});c.connect({host:node.host,port:node.port,username:node.username,privateKey:node.keyPath?readFileSync(node.keyPath):node.privateKey,password:node.password,passphrase:node.passphrase,hostHash:'sha256',hostVerifier:key=>node.hostKeySha256.some(expected=>equal(key,expected)),readyTimeout:10000,keepaliveInterval:10000,keepaliveCountMax:3})})}
async function remote(node,action,nodeId,id='',payload){
 const c=await connect(node)
 try{return await new Promise((resolve,reject)=>{c.exec(`python3 ${node.helper} ${action} ${nodeId}${id?' '+id:''}`,(error,stream)=>{if(error)return reject(fail('Remote session unavailable',503));let output='';const timer=setTimeout(()=>{stream.close();reject(fail('Remote operation timed out',504))},12000);stream.on('data',b=>{output+=b.toString();if(output.length>8_000_000){stream.close();reject(fail('History too large',413))}});if(payload)stream.end(JSON.stringify(payload));stream.on('close',code=>{clearTimeout(timer);try{if(code)throw Error();resolve(JSON.parse(output))}catch{reject(fail('Remote session operation failed',409))}})})})}finally{c.end()}
}
function detach(id){const v=clients.get(id);if(v){v.stream?.close();v.connection.end();clients.delete(id)}}
function owner(client,nodeId,id){const v=clients.get(client);if(!v||v.nodeId!==nodeId||v.id!==id)throw fail('Reconnect this session',409);v.seen=Date.now();return v}
const manageNodes=createSshNodes(config,process.env.OVERLEAF_REMOTE_TERMINAL_CONFIG,connect)
async function action(body){
 if(typeof body.action==='string'&&body.action.startsWith('node-'))return manageNodes(body)
 const {nodeId,id,action}=body,node=config.nodes[nodeId]
 if(!node||!uuid.test(nodeId)||id&&!uuid.test(id))throw fail('Unknown node or session',404)
 if(['list','create','status','history','stop','remove','files','agent-command'].includes(action)){
  if(action==='create'){
   const listing=await remote(node,'list',nodeId);if(listing.sessions.filter(s=>s.state==='running').length>=12)throw fail('Stop an unused session before creating more',409)
  }
  if(action==='stop'||action==='remove')for(const [key,v] of clients)if(v.nodeId===nodeId&&v.id===id)detach(key)
  return remote(node,action,nodeId,id,body.filesRequest)
 }
 if(action==='attach'){
  if(clients.size>=24)throw fail('Too many terminal connections',409)
  const state=await remote(node,'status',nodeId,id);if(state?.state!=='running')throw fail('This session has ended. Open its history.',409)
  const c=await connect(node),client=randomUUID();
  return new Promise((resolve,reject)=>{c.exec(`tmux -L overleaf-terminals attach-session -t ${id}`,{pty:{term:'xterm-256color',cols:100,rows:24}},(error,stream)=>{
   if(error){c.end();return reject(fail('Terminal attach failed',503))}
   const v={connection:c,stream,nodeId,id,seen:Date.now(),text:'',start:0,end:0,closed:false,decoder:new StringDecoder('utf8'),seq:0};clients.set(client,v)
   const append=b=>{const text=v.decoder.write(b);v.text+=text;v.end+=text.length;if(v.text.length>1_048_576){const n=v.text.length-1_048_576;v.text=v.text.slice(n);v.start+=n}}
   stream.on('data',append);stream.stderr.on('data',append);stream.on('close',()=>{v.closed=true;c.end()});c.on('close',()=>{v.closed=true});
   resolve({client,directory:state.directory})
  })})
 }
 if(action==='detach'){const v=clients.get(body.client);if(v&&(v.nodeId!==nodeId||v.id!==id))throw fail('Wrong session',403);detach(body.client);return {detached:true}}
 const v=owner(body.client,nodeId,id)
 if(action==='poll'){
  const cursor=Number(body.cursor||0);if(!Number.isSafeInteger(cursor)||cursor<0||cursor>v.end)throw fail('Invalid output cursor')
  return {output:v.text.slice(Math.max(cursor,v.start)-v.start),cursor:v.end,truncated:cursor<v.start,disconnected:v.closed}
 }
 if(v.closed)throw fail('Reconnect this session',409)
 if(action==='input'){
  if(typeof body.input!=='string'||Buffer.byteLength(body.input)>16384||!Number.isSafeInteger(body.seq))throw fail('Invalid terminal input')
  if(body.seq===v.seq)return {accepted:true}
  if(body.seq!==v.seq+1)throw fail('Input sequence changed. Reconnect.',409)
  v.stream.write(body.input);v.seq=body.seq;return {accepted:true}
 }
 if(action==='resize'){
  const {cols,rows}=body;if(!Number.isInteger(cols)||cols<2||cols>500||!Number.isInteger(rows)||rows<2||rows>200)throw fail('Invalid terminal dimensions')
  v.stream.setWindow(rows,cols,0,0);return {resized:true}
 }
 throw fail('Unsupported terminal operation')
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'||req.url!=='/command'){res.writeHead(404);return res.end('{}')}
 if(!equal(req.headers.authorization,`Bearer ${config.token}`)){res.writeHead(403);return res.end('{}')}
 try{let size=0,chunks=[];for await(const b of req){size+=b.length;if(size>8_000_000)throw fail('Request too large',413);chunks.push(b)}const result=await action(JSON.parse(Buffer.concat(chunks).toString()));res.end(JSON.stringify(result))}catch(e){res.writeHead(e.status||503);res.end(JSON.stringify({error:e.status?e.message:'Remote terminal unavailable'}))}
})
setInterval(()=>{for(const [id,v] of clients)if(Date.now()-v.seen>30000)detach(id)},5000).unref()
server.listen(config.port,'127.0.0.1',()=>console.log('Remote terminal adapter ready'))
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{manageNodes.close();for(const id of clients.keys())detach(id);server.close(()=>process.exit())})
