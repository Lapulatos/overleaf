import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,stat,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createSourceNetwork} from '../src/source-network.mjs'
test('only owner changes persistent proxy settings; credentials are not returned or carried to another proxy',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'source-network-'));const owner='a'.repeat(24);const configPath=join(dir,'operator.json');await writeFile(configPath,JSON.stringify({ownerUserId:owner,stateDirectory:dir}));const applied=[]
 try{const service=await createSourceNetwork({maintenanceConfig:configPath},{applyPolicy:p=>applied.push(p),fetcher:async url=>({url})});assert.throws(()=>service.status('other'),/owner/);await assert.rejects(service.save('other',{mode:'direct'}),/owner/)
 const saved=await service.save(owner,{mode:'custom',url:'http://127.0.0.1:7890',username:'test-user',password:'private-test-secret'});assert.equal(saved.hasPassword,true);assert.equal(JSON.stringify(saved).includes('private-test-secret'),false);assert.equal((await stat(join(dir,'source-network.json'))).mode&0o777,0o600)
 const restarted=await createSourceNetwork({maintenanceConfig:configPath},{applyPolicy:()=>{}});assert.equal(restarted.status(owner).url,saved.url)
 await service.save(owner,{mode:'custom',url:'http://127.0.0.1:7891',username:'test-user'});assert.equal(service.status(owner).hasPassword,false)
 await assert.rejects(service.save(owner,{mode:'custom',url:'file:///tmp'}),/HTTP/);assert.equal((await service.test(owner,'https://publisher.example')).ok,true);await assert.rejects(service.test(owner,'http://localhost'),/public/)
 const stored=JSON.parse(await readFile(join(dir,'source-network.json'),'utf8'));assert.equal(stored.password,'')
 }finally{await rm(dir,{recursive:true,force:true})}
})
