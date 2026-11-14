import {Client} from 'ssh2'
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs'
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto'
import {connect as tcpConnect} from 'node:net'
import {fileURLToPath} from 'node:url'
const failure=(message,status=409)=>Object.assign(Error(message),{status})
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const helper=readFileSync(new URL('./node-setup.py',import.meta.url),'utf8')
const payloadFiles=()=>Object.fromEntries([['session.py',new URL('./session.py',import.meta.url)],['files.py',new URL('./files.py',import.meta.url)],['monitor.py',new URL('../web/app/src/Features/RuntimeNodes/agent.py',import.meta.url)]].map(([n,p])=>[n,readFileSync(p,'utf8').replace('import tomllib\n','')]))
export function createSshNodes(config,configPath,connect){
 const file=configPath+'.managed',key=createHash('sha256').update(config.token).digest(),managed={},tunnels=new Map(),samples=new Map(),inflight=new Map()
 if(existsSync(file)){const b=JSON.parse(readFileSync(file));const d=createDecipheriv('aes-256-gcm',key,Buffer.from(b.iv,'hex'));d.setAuthTag(Buffer.from(b.tag,'hex'));Object.assign(managed,JSON.parse(Buffer.concat([d.update(Buffer.from(b.data,'hex')),d.final()])))}
 for(const [id,n]of Object.entries(managed))if(!n.disabled)config.nodes[id]=n
 function save(){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([c.update(JSON.stringify(managed)),c.final()]);const temp=file+'.tmp';writeFileSync(temp,JSON.stringify({iv:iv.toString('hex'),tag:c.getAuthTag().toString('hex'),data:data.toString('hex')}),{mode:0o600});renameSync(temp,file)}
 function validate(v){if(!v||typeof v.host!=='string'||v.host.length>253||! /^[a-zA-Z0-9.:-]+$/.test(v.host)||!Number.isInteger(v.port)||v.port<1||v.port>65535||typeof v.username!=='string'||! /^[a-zA-Z0-9_.-]{1,64}$/.test(v.username))throw failure('Enter a host, SSH port and username.',400)}
 async function exec(node,body){const c=await connect(node);try{return await new Promise((resolve,reject)=>{c.exec("python3 -c "+"'"+helper.replaceAll("'","'\\''")+"'",(e,s)=>{if(e)return reject(failure('SSH setup unavailable.'));let out='';const timer=setTimeout(()=>{s.close();reject(failure('SSH setup timed out.'))},45000);s.on('data',b=>{out+=b;if(out.length>2000000)s.close()});s.on('close',()=>{clearTimeout(timer);try{const result=JSON.parse(out);if(result.error)throw failure(result.error);resolve(result)}catch(err){reject(err.status?err:failure('SSH setup failed. Python 3.8+, tmux and GitLab Runner are required for Runner mode.'))}});s.end(JSON.stringify(body))})})}finally{c.end()}}
 async function probe(v){validate(v);return new Promise((resolve,reject)=>{const c=new Client();let fingerprint;c.on('error',()=>{c.end();fingerprint?resolve({fingerprint}):reject(failure('Cannot reach the SSH service.',503))});c.on('ready',()=>c.end());c.connect({host:v.host,port:v.port,username:v.username,readyTimeout:8000,hostHash:'sha256',hostVerifier:h=>{fingerprint='SHA256:'+Buffer.from(h,'hex').toString('base64').replace(/=+$/,'');return false}})})}
 async function tunnel(id){if(tunnels.has(id))return tunnels.get(id).port;const n=managed[id];if(!n||n.disabled)throw failure('SSH node unavailable.');const allowed=config.coordinatorPorts||[18081,18082];if(!allowed.includes(n.coordinatorPort))throw failure('Coordinator is not allowed by the SSH adapter.');const c=await connect(n);try{const port=await new Promise((resolve,reject)=>{c.on('tcp connection',(info,accept,rejectChannel)=>{if(info.destIP!=='127.0.0.1'){rejectChannel();return}const s=accept(),socket=tcpConnect({host:'127.0.0.1',port:n.coordinatorPort});socket.on('error',()=>s.destroy());s.on('error',()=>socket.destroy());s.on('close',()=>socket.destroy());socket.on('close',()=>s.destroy());s.pipe(socket).pipe(s)});c.forwardIn('127.0.0.1',n.tunnelPort||0,(e,p)=>e?reject(failure('SSH server refused reverse forwarding. Enable AllowTcpForwarding for this account.')):resolve(p))});tunnels.set(id,{connection:c,port});n.tunnelPort=port;save();c.on('close',()=>{if(tunnels.get(id)?.connection===c)tunnels.delete(id)});return port}catch(e){c.end();throw e}}
 async function restore(id){if(inflight.has(id))return inflight.get(id);const p=(async()=>{const n=managed[id];const port=await tunnel(id);if(!n.externalRunner&&!n.runnerSleeping)await exec(n,{action:'runner',id,port,token:n.runnerToken,name:n.name})})().finally(()=>inflight.delete(id));inflight.set(id,p);return p}
 const timer=setInterval(()=>{for(const [id,n]of Object.entries(managed))if(n.runnerEnabled&&!n.disabled&&!tunnels.has(id))void restore(id).catch(()=>{})},10000);timer.unref()
 const api=async(body)=>{
  const {action,nodeId:id}=body
  if(action==='node-probe')return probe(body.ssh)
  if(!uuid.test(id))throw failure('Invalid node identity.',400)
  if(action==='node-adopt'){
   const old=config.nodes[id];if(!old||managed[id])throw failure('Existing static node required.');
   if(!(config.coordinatorPorts||[18081,18082]).includes(body.coordinatorPort)||!Number.isInteger(body.tunnelPort)||body.tunnelPort<1024||body.tunnelPort>65535)throw failure('Invalid forwarding ports.');
   const result=await exec(old,{action:'setup',files:payloadFiles()});
   const n={...old,name:body.name,externalRunner:true,runnerEnabled:true,coordinatorPort:body.coordinatorPort,tunnelPort:body.tunnelPort};managed[id]=n;config.nodes[id]=n;save();await restore(id);return {adopted:true,ssh:{host:n.host,port:n.port,username:n.username}}
  }
  if(action==='node-health'){
   const n=managed[id]||config.nodes[id];if(!n||n.disabled)throw failure('SSH node unavailable.',404)
   const old=samples.get('health-'+id);if(old&&Date.now()-old.at<10000)return old.value
   let reachable=false;try{const c=await connect(n);c.end();reachable=true}catch{}
   const value={reachable,checkedAt:new Date().toISOString()};samples.set('health-'+id,{at:Date.now(),value});return value
  }
  if(action==='node-add'){
   if(managed[id]||config.nodes[id])throw failure('Node already exists.');const v=body.ssh;validate(v)
   if(typeof v.fingerprint!=='string'||!/^SHA256:[A-Za-z0-9+/]{43}$/.test(v.fingerprint))throw failure('Verify the SHA256 host fingerprint first.',400)
   const n={host:v.host,port:v.port,username:v.username,hostKeySha256:[Buffer.from(v.fingerprint.slice(7),'base64').toString('hex')],name:body.name}
   if(v.auth==='server-key'){const path=Object.values(config.nodes).find(n=>n.keyPath)?.keyPath;if(!path)throw failure('No server key configured. Paste a dedicated private key instead.');n.keyPath=path}
   else if(v.auth==='private-key'&&typeof v.privateKey==='string'&&v.privateKey.length<=32768){n.privateKey=v.privateKey;if(v.passphrase)n.passphrase=v.passphrase}
   else if(v.auth==='password'&&typeof v.password==='string'&&v.password.length<=1024)n.password=v.password
   else throw failure('Choose an SSH authentication method.',400)
   const result=await exec(n,{action:'setup',files:payloadFiles()});if(!/^\/[a-zA-Z0-9_./-]+$/.test(result.home))throw failure('Unsupported remote home directory.');n.helper=result.home+'/.local/share/overleaf-terminals/session.py';managed[id]=n;config.nodes[id]=n;save();return {...result,ssh:{host:n.host,port:n.port,username:n.username,fingerprint:v.fingerprint}}
  }
  const n=managed[id];if(!n)throw failure('SSH node is not configured.',404)
  if(action==='node-revoke'){if(n.disabled&&!n.keyPath&&!n.privateKey&&!n.password)return {revoked:true};n.disabled=true;n.runnerEnabled=false;save();tunnels.get(id)?.connection.end();tunnels.delete(id);delete config.nodes[id];await exec(n,{action:'stop-runner',id});for(const field of ['password','privateKey','passphrase','keyPath','runnerToken'])delete n[field];save();return {revoked:true}}
  if(n.disabled)throw failure('Node access revoked.',403)
  if(action==='node-capabilities')return {...await exec(n,{action:'capabilities'}),runnerControl:Boolean(n.externalRunner||n.runnerToken)}
  if(action==='node-wake'){
   if(!n.externalRunner&&!n.runnerToken)throw failure('Register Runner first.')
   n.runnerSleeping=false;save();await restore(id)
   if(n.externalRunner)await exec(n,{action:'external-start',coordinatorPort:n.coordinatorPort})
   return {awake:true}
  }
  if(action==='node-sleep'){
   if(inflight.has(id))await inflight.get(id)
   if(n.externalRunner)await exec(n,{action:'external-stop',coordinatorPort:n.coordinatorPort})
   else await exec(n,{action:'stop-runner',id})
   n.runnerSleeping=true;save();return {standby:true}
  }
  if(action==='node-runner'){
   if(!/^glrt-[a-f0-9-]{36}\.[A-Za-z0-9_-]+$/.test(body.token))throw failure('Invalid Runner credential.',400)
   n.coordinatorPort=body.coordinatorPort;n.runnerToken=body.token;save();try{await restore(id);n.runnerEnabled=true;save();return {registered:true,tunnelPort:n.tunnelPort}}catch(e){tunnels.get(id)?.connection.end();tunnels.delete(id);throw e}
  }
  if(action==='node-status'){
   const old=samples.get(id);if(old&&Date.now()-old.at<5000)return old.value
   if(inflight.has('sample-'+id))return inflight.get('sample-'+id)
   const p=exec(n,{action:'sample'}).then(result=>{const value={...result,tunnel:n.runnerEnabled?(tunnels.has(id)?'connected':'reconnecting'):'disabled'};samples.set(id,{at:Date.now(),value});return value}).finally(()=>inflight.delete('sample-'+id));inflight.set('sample-'+id,p);return p
  }
  throw failure('Unsupported SSH node operation.',400)
 }
 api.close=()=>{clearInterval(timer);for(const v of tunnels.values())v.connection.end()}
 return api
}
