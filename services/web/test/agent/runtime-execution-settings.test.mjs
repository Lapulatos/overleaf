import test from 'node:test'
import assert from 'node:assert/strict'
import {executionSettings,defaults,validateCapacity,idleExpired} from '../../app/src/Features/RuntimeNodes/RuntimeExecutionSettings.mjs'
import {limitScript} from '../../app/src/Features/RuntimeNodes/RuntimeTaskLimits.mjs'
test('settings reject invalid idle, shell injection image, invalid quotas and duplicate GPUs',()=>{
 assert(executionSettings.safeParse(defaults).success)
 for(const change of [{idleMinutes:0},{mode:'sleep'},{limits:{...defaults.limits,image:'x;touch /tmp/a'}},{limits:{...defaults.limits,cpu:-1}},{limits:{...defaults.limits,gpuIds:[0,0]}}])assert(!executionSettings.safeParse({...defaults,...change}).success)
})
test('resource capability validation fails closed',()=>{
 const config={...defaults,limits:{...defaults.limits,enabled:true,image:'local:test',cpu:2,memoryGiB:1,gpuIds:[0]}},node={resources:{cpuCount:8,memoryTotal:8*1024**3}},caps={runnerControl:true,docker:true,cpuLimit:true,memoryLimit:true,images:['local:test'],gpuRuntime:true,gpuCount:1}
 assert.doesNotThrow(()=>validateCapacity(config,node,caps))
 for(const changes of [{docker:false},{cpuLimit:false},{memoryLimit:false},{gpuRuntime:false},{images:[]}])assert.throws(()=>validateCapacity(config,node,{...caps,...changes}))
})
test('limited jobs use Docker hard limits and cleanup; SSH shell is not modified',()=>{
 const original=['echo hello'];assert.deepEqual(limitScript(original,{_id:1}),original)
 const script=limitScript(original,{_id:42,executionSettings:{limits:{enabled:true,image:'local:test',cpu:1.5,memoryGiB:.5,threads:2,gpuIds:[0,2]}}}).join('\n')
 for(const value of ['--cpus','1.5','--memory-swap','512m','OMP_NUM_THREADS=2','device=0,2','docker rm -f overleaf-task-42','--pull=never'])assert(script.includes(value),value)
 assert(!script.includes('/var/run/docker.sock'));assert(!script.includes('--privileged'))
})

test('idle expiry never stops a queued/running/canceling task or an always-on Runner',()=>{
 const now=Date.now(),node={executionSettings:{...defaults,mode:'on-demand',idleMinutes:1},runnerIdleSince:new Date(now-61000)}
 assert(idleExpired(node,0,now));for(const active of [1,2,3])assert(!idleExpired(node,active,now))
 assert(!idleExpired({...node,executionSettings:defaults},0,now));assert(!idleExpired({...node,runnerIdleSince:null},0,now));assert(!idleExpired({...node,runnerIdleSince:new Date(now-59000)},0,now))
})
