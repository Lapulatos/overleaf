import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createModelCatalog,readModelCatalog} from '../src/model-catalog.mjs'
const model={model:'available-model',displayName:'Available',isDefault:true,defaultReasoningEffort:'low',supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'high'}]}
test('model catalog follows pagination and returns only public selection metadata',async()=>{
 let count=0
 const models=await readModelCatalog({request:async()=>({data:[{...model,model:`model-${++count}`,internal:'not exposed'}],nextCursor:count===1?'next':null})})
 assert.equal(models.length,2);assert.deepEqual(models[0].efforts,['low','high']);assert.equal(models[0].internal,undefined)
})
test('concurrent catalog requests share one runtime and close it after reading',async()=>{
 let opened=0,closed=0
 const get=createModelCatalog({createClient:async()=>{opened++;return{request:async()=>({data:[model],nextCursor:null}),close:async()=>{closed++}}}})
 const [a,b]=await Promise.all([get(),get()]);assert.deepEqual(a,b);await get();assert.equal(opened,1);assert.equal(closed,1)
})
test('failed catalog requests do not cache failure and always close runtime',async()=>{
 let closed=0
 const get=createModelCatalog({createClient:async()=>({request:async()=>{throw new Error('unavailable')},close:async()=>{closed++}})})
 await assert.rejects(get());await assert.rejects(get());assert.equal(closed,2)
})
