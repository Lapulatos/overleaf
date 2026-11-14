import {readFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {Client} from 'ssh2'
import assert from 'node:assert/strict'
const c=JSON.parse(readFileSync(homedir()+'/.local/share/overleaf-acceptance/persistent-terminal/config.json'))
const n=Object.values(c.nodes)[0]
await new Promise((resolve,reject)=>{const ssh=new Client();ssh.on('ready',()=>{ssh.end();reject(Error('Untrusted host key accepted'))});ssh.on('error',e=>{ssh.end();/verification failed|Host denied/.test(e.message)?resolve():reject(Error('Unexpected SSH failure'))});ssh.connect({host:n.host,port:n.port,username:n.username,privateKey:readFileSync(n.keyPath),hostHash:'sha256',hostVerifier:()=>false,readyTimeout:10000})})
let r=await fetch('http://127.0.0.1:47315/command',{method:'POST',body:'{}'});assert.equal(r.status,403)
r=await fetch('http://127.0.0.1:47315/command',{method:'POST',headers:{Authorization:'Bearer '+c.token},body:JSON.stringify({action:'list',nodeId:'not-an-authorized-node'})});assert.equal(r.status,404)
r=await fetch('http://127.0.0.1:47315/command',{method:'POST',headers:{Authorization:'Bearer '+c.token},body:JSON.stringify({action:'attach',nodeId:Object.keys(c.nodes)[0],id:'../../arbitrary'})});assert.equal(r.status,404)
console.log(JSON.stringify({untrustedHostKeyRejected:true,unauthenticatedBridgeRejected:true,unknownNodeRejected:true,pathTraversalRejected:true}))
