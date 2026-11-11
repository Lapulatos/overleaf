import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const exec=promisify(execFile),suffix=Date.now(),volume=`native-git-review-fixture-${suffix}`,container=`native-git-review-fixture-${suffix}`,token=randomUUID(),image='overleaf-agent-acceptance:20261111-native-git-candidate-r48',project='a'.repeat(24),user='b'.repeat(24),root=`/var/lib/overleaf/native-git/${project}`,directory=root+'/worktrees/test',commonDirectory=root+'/repository/.git'
let runner
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const request=async(body,auth=token)=>{const response=await fetch('http://127.0.0.1:47329/terminal',{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Token':auth},body:JSON.stringify({project,user,...body})});return {status:response.status,...await response.json()}}
try{
 await exec('docker',['volume','create',volume])
 await exec('docker',['run','--rm','--network','none','--mount',`type=volume,src=${volume},dst=/var/lib/overleaf`,'--entrypoint','python3',image,'-c',`import os\nos.makedirs('${directory}/.git')\nos.makedirs('${commonDirectory}')\nfor p in ['${directory}','${directory}/.git','${commonDirectory}']:os.chown(p,33,33)`])
 await exec('docker',['create','--name',container,'--mount',`type=volume,src=${volume},dst=/var/lib/overleaf`,image])
 runner=spawn('node',['services/agent/src/repository-terminal-runner.mjs'],{env:{...process.env,OVERLEAF_TERMINAL_RUNNER_TOKEN:token,OVERLEAF_TERMINAL_PORT:'47329',OVERLEAF_TERMINAL_CONTAINER:container},stdio:'ignore'})
 for(let i=0;i<30;i++){try{await request({action:'revoke'});break}catch{await sleep(100)}}
 assert.equal((await request({action:'open'},'wrong')).status,403)
 const session=await request({action:'open',mode:'auto-review',directory,commonDirectory})
 assert.equal(session.status,200);assert.ok(session.id)
 const id=session.id
 assert.equal((await request({action:'input',id,input:'touch bypass\n'})).status,409)
 assert.equal((await request({action:'run',id,text:'pwd'})).automatic,true)
 const pending=await request({action:'run',id,text:'touch approved-file'})
 assert.equal(pending.approvalRequired,true)
 assert.equal((await request({action:'run',id,text:'touch approved-file',approval:pending.approval})).status,200)
 assert.equal((await request({action:'run',id,text:'touch approved-file',approval:pending.approval})).status,409)
 await request({action:'run',id,text:'ls'})
 let output=''
 for(let i=0;i<80;i++){output+=(await request({action:'poll',id})).output||'';if(output.includes('approved-file\r\n[Exit'))break;await sleep(100)}
 assert.match(output,/approved-file\r\n\[Exit/)
 assert.ok(!output.includes('bypass'))
 await request({action:'revoke'})
 assert.equal((await request({action:'poll',id})).status,409)
 await sleep(2000)
 console.log(JSON.stringify({authenticated:true,rawInputBlocked:true,automaticCommand:true,approvedWrite:true,replayBlocked:true,revoke:true}))
}finally{
 if(runner){runner.kill();await sleep(300)}
 await exec('docker',['rm','--force',container]).catch(()=>{})
 await exec('docker',['volume','rm',volume]).catch(()=>{})
}
