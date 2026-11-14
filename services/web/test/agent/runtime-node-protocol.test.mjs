import test from 'node:test'
import assert from 'node:assert/strict'
import { registration, heartbeat, publicNode, hash, secret } from '../../app/src/Features/RuntimeNodes/NodeProtocol.mjs'
const resources={scope:'host',cpuCount:8,memoryTotal:1000,memoryAvailable:500,diskTotal:5000,diskFree:3000,load1:0.5,docker:{available:false,cpuCount:null,memoryTotal:null,version:null},gpu:'not-probed'}
test('resource reports reject extra fields, invalid sizes and unavailable memory exceeding total',()=>{
 assert(registration.safeParse({identity:{hostname:'node',platform:'linux',arch:'arm64'},resources}).success)
 for(const value of [{...resources,cpuCount:0},{...resources,memoryAvailable:1001},{...resources,memoryTotal:Infinity},{...resources,command:'rm -rf /'}])assert(!heartbeat.safeParse({sequence:1,resources:value}).success)
 assert(!heartbeat.safeParse({sequence:-1,resources}).success)
})
test('status uses server heartbeat and expiry; revoked wins; secrets never returned',()=>{
 const now=Date.now(),node={_id:'1',name:'node',registeredAt:new Date(now),lastSeenAt:new Date(now),credentialHash:'secret',enrollmentHash:'secret'}
 assert.equal(publicNode(node,now).status,'online')
 assert.equal(publicNode(node,now+45001).status,'offline')
 assert.equal(publicNode({...node,revokedAt:new Date(now)},now).status,'revoked')
 assert.equal(publicNode({enrollmentExpiresAt:new Date(now+1000)},now).status,'pending')
 assert.equal(publicNode({enrollmentExpiresAt:new Date(now-1)},now).status,'expired')
 assert(!JSON.stringify(publicNode(node,now)).includes('secret'))
})
test('high entropy tokens are opaque and hashed deterministically',()=>{
 const a=secret(),b=secret();assert.match(a,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a,b);assert.equal(hash(a),hash(a));assert.notEqual(hash(a),hash(b))
})
test('Runner, SSH and telemetry statuses are independent; missing Runner heartbeat is offline',()=>{
 const now=Date.now(),node={registeredAt:new Date(now),protocol:'gitlab-runner',sshConfigured:true,sshReachable:true,sshLastCheckedAt:new Date(now),lastSeenAt:new Date(now)}
 const v=publicNode(node,now);assert.equal(v.status,'offline');assert.deepEqual(v.connections,{runner:'offline',ssh:'online',monitor:'live'})
 assert.equal(publicNode({...node,runnerLastSeenAt:new Date(now)},now).connections.runner,'online')
 assert.equal(publicNode(node,now+45001).connections.ssh,'unknown')
 assert.deepEqual(publicNode({...node,revokedAt:new Date(now)},now).connections,{runner:'revoked',ssh:'revoked',monitor:'revoked'})
})
