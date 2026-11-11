import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileWithRetry } from '../../frontend/js/features/pdf-preview/util/compile-with-retry.ts'

test('reload retries both transient statuses and preserves successful response', async () => {
  const results = [{status:'compile-in-progress'}, {status:'too-recently-compiled'}, {status:'success',outputFiles:['pdf']}]
  const waits=[]
  const result=await compileWithRetry(async()=>results.shift(),true,new AbortController().signal,async ms=>waits.push(ms))
  assert.deepEqual(result,{status:'success',outputFiles:['pdf']})
  assert.deepEqual(waits,[1000,2000])
})
for (const [automatic,status] of [[false,'compile-in-progress'],[false,'too-recently-compiled'],[true,'failure'],[true,'success']]) {
  test(`no retry for automatic=${automatic}, status=${status}`, async()=>{
    let calls=0
    const result=await compileWithRetry(async()=>{calls++;return {status}},automatic,new AbortController().signal,async()=>assert.fail('unexpected wait'))
    assert.equal(result.status,status);assert.equal(calls,1)
  })
}
test('persistent contention returns error after three retries',async()=>{
  let calls=0;const waits=[]
  const result=await compileWithRetry(async()=>{calls++;return {status:'compile-in-progress'}},true,new AbortController().signal,async ms=>waits.push(ms))
  assert.equal(result.status,'compile-in-progress');assert.equal(calls,4);assert.deepEqual(waits,[1000,2000,4000])
})
test('page cancellation stops a pending retry without another request',async()=>{
  const controller=new AbortController();let calls=0
  const pending=compileWithRetry(async()=>{calls++;setTimeout(()=>controller.abort(),10);return {status:'too-recently-compiled'}},true,controller.signal)
  await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,1)
})
