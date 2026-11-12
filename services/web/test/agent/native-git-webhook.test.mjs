import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {configureWebhook,receiveWebhook,readWebhook,publicWebhook,githubRepository} from '../../app/src/Features/NativeGit/GitHubWebhook.mjs'
import {discoveryScheduleId} from '../../app/src/Features/NativeGit/RemoteDiscoverySchedule.mjs'
function store(){const rows=new Map();return {async read(id){if(!rows.has(id))throw Object.assign(Error(),{code:'ENOENT'});return structuredClone(rows.get(id))},async write(v){rows.set(v.id,structuredClone(v))}}}
async function fixture(){
 const config=store(),schedules=store(),url='https://github.com/example/paper.git'
 await schedules.write({id:discoveryScheduleId,revision:1,enabled:true,ownerId:'owner',remote:'origin',url,state:'scheduled',nextAt:1000})
 const args={store:config,schedules,ownerId:'owner',projectId:'project',remoteUrl:async()=>url,encryptor:{encryptJson:async x=>JSON.stringify(x),decryptToJson:async x=>JSON.parse(x)}}
 const setup=await configureWebhook({...args,command:{revision:0,enabled:true}})
 const send=(payload={},extras={})=>{const body=Buffer.from(JSON.stringify({repository:{id:42,full_name:'example/paper'},...payload}));return receiveWebhook({...args,body,hookId:setup.path.split('/').at(-1),signature:'sha256='+createHmac('sha256',setup.secret).update(body).digest('hex'),delivery:'delivery-1',event:'push',now:()=>100,...extras})}
 return {args,setup,send}
}
test('signature, exact repository binding and stored identity are checked before scheduling',async()=>{
 const f=await fixture();await assert.rejects(f.send({}, {signature:'sha256='+'0'.repeat(64)}),{status:401});assert.equal((await f.args.schedules.read(discoveryScheduleId)).nextAt,1000)
 await assert.rejects(f.send({repository:{id:42,full_name:'other/paper'}}),{status:403})
 assert.equal((await f.send()).queued,true)
 await assert.rejects(f.send({repository:{id:43,full_name:'example/paper'}},{delivery:'delivery-2'}),{status:403})
 assert.equal(publicWebhook(await readWebhook(f.args.store)).secret,undefined)
})
test('same delivery or body with a new delivery is deduplicated; ping does not fetch',async()=>{
 const f=await fixture();assert.equal((await f.send({}, {event:'ping'})).queued,false)
 assert.equal((await f.args.schedules.read(discoveryScheduleId)).nextAt,1000)
 assert.equal((await f.send({after:'new'},{delivery:'push-1'})).queued,true)
 const revision=(await f.args.schedules.read(discoveryScheduleId)).revision
 assert.equal((await f.send({after:'new'},{delivery:'push-2'})).duplicate,true)
 assert.equal((await f.args.schedules.read(discoveryScheduleId)).revision,revision)
})
test('out-of-order commits are only wake-up hints; no payload target is persisted to schedule',async()=>{
 const f=await fixture();await f.send({after:'new',before:'old'});await f.send({after:'old',before:'older'},{delivery:'delivery-2'})
 const policy=await f.args.schedules.read(discoveryScheduleId);assert.equal(policy.nextAt,100);assert.equal(policy.after,undefined);assert.equal(policy.ref,undefined)
})
test('disabled checks, changed owner/remote, rotated secret and disabled webhook refuse delivery',async()=>{
 const f=await fixture();await assert.rejects(f.send({}, {ownerId:'other'}),{status:404})
 await assert.rejects(f.send({}, {remoteUrl:async()=> 'https://github.com/other/paper.git'}),{status:409})
 const next=await configureWebhook({...f.args,command:{revision:1,enabled:true}});assert.notEqual(next.secret,f.setup.secret);await assert.rejects(f.send(),{status:404})
 await configureWebhook({...f.args,command:{revision:2,enabled:false}});await assert.rejects(f.send(),{status:404})
})
test('receipt write failure cannot lose accepted wake-up; retry remains safe',async()=>{
 const f=await fixture(),write=f.args.store.write;let fail=true
 f.args.store.write=async value=>{if(fail){fail=false;throw Error('simulated crash')}return write(value)}
 await assert.rejects(f.send(),/simulated crash/);assert.equal((await f.args.schedules.read(discoveryScheduleId)).nextAt,100)
 assert.equal((await f.send()).queued,true)
})
test('only github.com canonical remotes can be bound',()=>{
 assert.equal(githubRepository('git@github.com:Example/Paper.git'),'example/paper')
 assert.equal(githubRepository('https://github.com/example/paper'),'example/paper')
 assert.throws(()=>githubRepository('https://github.com.attacker.test/example/paper'))
 assert.throws(()=>githubRepository('https://user:secret@github.com/example/paper'))
})
