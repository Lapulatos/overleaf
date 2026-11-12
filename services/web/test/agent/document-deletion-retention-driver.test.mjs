/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDeletionTaskRetention } from '../../app/src/Features/WritingAssist/DocumentDeletionTaskRetention.mjs'

test('retention readiness supports native and buffered Mongoose index cursors', async () => {
  for (const buffered of [false, true]) {
    const cursor = { toArray: async () => [{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }] }
    await createDeletionTaskRetention({ listIndexes: () => buffered ? Promise.resolve(cursor) : cursor }).assertReady()
  }
})
test('buffered indexes still reject the legacy expiration policy', async () => {
  const cursor = { toArray: async () => [{ key: { createdAt: 1 }, expireAfterSeconds: 604800 }] }
  await assert.rejects(createDeletionTaskRetention({ listIndexes: async () => cursor }).assertReady(), { status: 503 })
})

test('migration disables TTL scanning before any retention updates and restores it last', async () => {
  const {migrateDeletionTaskRetention}=await import('../../app/src/Features/WritingAssist/DocumentDeletionTaskRetention.mjs')
  const calls=[];let indexes=[{name:'createdAt_1',key:{createdAt:1},expireAfterSeconds:604800},{name:'expiresAt_1',key:{expiresAt:1},expireAfterSeconds:0}]
  const collection={listIndexes:()=>({toArray:async()=>indexes}),dropIndex:async name=>{calls.push('drop:'+name);indexes=indexes.filter(i=>i.name!==name)},updateMany:async()=>{calls.push('update')},createIndex:async(key,options)=>{calls.push('create');indexes.push({name:'expiresAt_1',key,...options})}}
  await migrateDeletionTaskRetention(collection)
  assert.deepEqual(calls.slice(0,2),['drop:createdAt_1','drop:expiresAt_1'])
  assert.ok(calls.slice(2,-1).every(value=>value==='update'));assert.equal(calls.at(-1),'create')
})

test('interrupted retention migration blocks new claims and can resume without old TTL index',async()=>{
 const {migrateDeletionTaskRetention}=await import('../../app/src/Features/WritingAssist/DocumentDeletionTaskRetention.mjs')
 let fail=true,indexes=[{name:'expiresAt_1',key:{expiresAt:1},expireAfterSeconds:0}]
 const collection={listIndexes:()=>({toArray:async()=>indexes}),dropIndex:async()=>{indexes=[]},updateMany:async()=>{if(fail)throw Error('storage interrupted')},createIndex:async(key,options)=>{indexes=[{name:'expiresAt_1',key,...options}]}}
 await assert.rejects(migrateDeletionTaskRetention(collection),/storage interrupted/)
 await assert.rejects(createDeletionTaskRetention(collection).assertReady(),{status:503})
 fail=false;await migrateDeletionTaskRetention(collection)
 await createDeletionTaskRetention(collection).assertReady()
})

test('unknown TTL policy is refused without changing indexes or records',async()=>{
 const {migrateDeletionTaskRetention}=await import('../../app/src/Features/WritingAssist/DocumentDeletionTaskRetention.mjs')
 let changed=false
 const collection={listIndexes:()=>({toArray:async()=>[{name:'unexpected',key:{lastSeen:1},expireAfterSeconds:10}]}),dropIndex:async()=>{changed=true},updateMany:async()=>{changed=true}}
 await assert.rejects(migrateDeletionTaskRetention(collection),{status:503});assert.equal(changed,false)
})
