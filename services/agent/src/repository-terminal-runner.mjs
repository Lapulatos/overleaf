import http from 'node:http'
import {randomUUID} from 'node:crypto'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { terminalContainerArgs } from '../../web/app/src/Features/NativeGit/TerminalContainer.mjs'
import { openTerminal, pollTerminal, writeTerminal, closeTerminal, closeOwnerTerminals, runReviewedTerminal } from '../../web/app/src/Features/NativeGit/RepositoryTerminal.mjs'
import { TerminalReviews } from '../../web/app/src/Features/NativeGit/TerminalReview.mjs'
const reviews = new TerminalReviews(), owners = new Map()
const exec = promisify(execFile)
const container = process.env.OVERLEAF_TERMINAL_CONTAINER || 'overleaf-deletion-acceptance-candidate-web-1'
const token = process.env.OVERLEAF_TERMINAL_RUNNER_TOKEN
if (!token) throw new Error('Runner authentication is required')
async function open(body,key) {
 const info=JSON.parse((await exec('docker',['inspect',container])).stdout)[0]
 const volume=info.Mounts.find(m=>m.Destination==='/var/lib/overleaf'&&m.Type==='volume')?.Name
 if(!volume)throw Error('Repository volume is unavailable')
 const args=terminalContainerArgs(body,volume,info.Image)
 for(const [id,owner] of owners)if(owner.key===key){owners.delete(id);reviews.revoke(id)}
 const name='native-git-shell-'+randomUUID()
 args.splice(1,0,'--name',name)
 const session=openTerminal(body.directory,key,()=>{
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']})
  child.once('exit',()=>{void exec('docker',['rm','--force',name]).catch(()=>{})})
  return child
 })
 owners.set(session.id,{key,mode:body.mode});return session
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'||req.url!=='/terminal'||req.headers['x-agent-token']!==token){res.writeHead(403);res.end('{}');return}
 try {
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Request too large')}
  const b=JSON.parse(raw)
  if(!/^[a-f0-9]{24}$/.test(b.project)||!/^[a-f0-9]{24}$/.test(b.user))throw Error('Invalid session owner')
  const key=`${b.project}:${b.user}`
  let result
  if(b.action==='open')result=await open(b,key)
  else if(b.action==='revoke'){for(const [id,owner] of owners)if(owner.key===key){owners.delete(id);reviews.revoke(id)}result=closeOwnerTerminals(key)}
  else if(b.action==='poll')result=pollTerminal(b.id,key)
  else if(b.action==='close'){result=closeTerminal(b.id,key);owners.delete(b.id);reviews.revoke(b.id)}
  else if(b.action==='run'){
   const owner=owners.get(b.id);if(!owner||owner.key!==key||owner.mode!=='auto-review')throw Error('Reviewed session required')
   const decision=reviews.authorize(b.id,key,b.text,b.approval)
   result=decision.approvalRequired?decision:{...runReviewedTerminal(b.id,key,decision.command),automatic:decision.automatic}
  }
  else if(b.action==='input'&&typeof b.input==='string'&&b.input.length<=65536){if(owners.get(b.id)?.mode==='auto-review')throw Error('Raw input is disabled in reviewed mode');result=writeTerminal(b.id,key,b.input)}
  else if(b.action==='resize'&&Number.isInteger(b.cols)&&b.cols>=2&&b.cols<=500&&Number.isInteger(b.rows)&&b.rows>=2&&b.rows<=200)result=writeTerminal(b.id,key,undefined,b.cols,b.rows)
  else throw Error('Invalid terminal action')
  res.end(JSON.stringify(result))
 }catch(error){res.writeHead(409);res.end(JSON.stringify({error:error.message}))}
}).listen(Number(process.env.OVERLEAF_TERMINAL_PORT || 47292),'0.0.0.0')

function shutdown() {
 server.close()
 for(const key of new Set([...owners.values()].map(owner=>owner.key)))closeOwnerTerminals(key)
 setTimeout(()=>process.exit(0),2500).unref()
}
process.once('SIGTERM',shutdown)
process.once('SIGINT',shutdown)
