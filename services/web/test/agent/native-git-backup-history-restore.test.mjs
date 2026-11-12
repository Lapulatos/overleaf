import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreHistory } from '../../app/src/Features/NativeGit/BackupHistoryRestore.mjs'
const snapshot={files:{}}
const changes=Array.from({length:101},(_,i)=>({operations:[],timestamp:new Date(1700000000000+i).toISOString(),authors:[],v2Authors:['000000000000000000000001']}))
function client(){let state;return {async read(){if(!state)throw Object.assign(Error('missing'),{status:404});return structuredClone(state)},async initialize(s){state={snapshot:s,changes:[]}},async append(batch,cursor){assert.equal(cursor,state.changes.length);state.changes.push(...batch)},get state(){return state}}}
test('interrupted historical import resumes exact prefix without duplicating changes',async()=>{
 const c=client()
 await assert.rejects(restoreHistory({initialSnapshot:snapshot,changes,client:c,checkpoint:async()=>{throw Error('interrupted')}}),/interrupted/)
 assert.equal(c.state.changes.length,100)
 assert.deepEqual(await restoreHistory({initialSnapshot:snapshot,changes,client:c}),{endVersion:101})
 assert.deepEqual(c.state.changes,changes)
})
test('same-length foreign history is refused and retained',async()=>{
 const c=client();await c.initialize(snapshot);await c.append([{...changes[0],v2Authors:['000000000000000000000099']}],0)
 await assert.rejects(restoreHistory({initialSnapshot:snapshot,changes,client:c}),/differs/)
 assert.equal(c.state.changes.length,1)
})
