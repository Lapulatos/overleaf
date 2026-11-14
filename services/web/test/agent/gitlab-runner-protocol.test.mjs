import test from 'node:test'
import assert from 'node:assert/strict'
import { runnerRequest } from '../../app/src/Features/RuntimeNodes/GitLabRunnerProtocol.mjs'
import { resources, publicNode } from '../../app/src/Features/RuntimeNodes/NodeProtocol.mjs'
const token='glrt-12345678-1234-1234-1234-123456789012.'+'a'.repeat(43)
test('official manager request accepted; legacy tokens and unbound system IDs rejected',()=>{
 assert(runnerRequest.safeParse({token,system_id:'s_123456789012',info:{version:'19.3.6',features:{},executor:'shell'},last_update:'x'}).success)
 for(const req of [{token,system_id:''},{token:'legacy',system_id:'s_123456789012'},{token}])assert(!runnerRequest.safeParse(req).success)
})
test('resource monitoring cannot keep an offline Runner online',()=>{
 const now=Date.now(), node={protocol:'gitlab-runner',registeredAt:new Date(now-100000),lastSeenAt:new Date(now),runnerLastSeenAt:new Date(now-60000)}
 assert.equal(publicNode(node,now).status,'offline')
 node.runnerLastSeenAt=new Date(now);assert.equal(publicNode(node,now).status,'online')
})
test('CPU/GPU percentages and VRAM bounds are validated; unavailable is distinct from zero',()=>{
 const report={scope:'host',cpuCount:8,memoryTotal:100,memoryAvailable:50,diskTotal:null,diskFree:null,load1:0,docker:{available:false,cpuCount:null,memoryTotal:null,version:null},gpu:'not-probed',usage:{cpuPercent:0,sampleSeconds:.3,gpu:{status:'available',reason:'driver',devices:[{name:'GPU',utilization:0,memoryUsed:1,memoryTotal:2}]}}}
 assert(resources.safeParse(report).success)
 report.usage.cpuPercent=101;assert(!resources.safeParse(report).success)
 report.usage.cpuPercent=null;report.usage.gpu.devices[0].utilization=null;assert(resources.safeParse(report).success)
 report.usage.gpu.devices[0].memoryUsed=3;assert(!resources.safeParse(report).success)
})
