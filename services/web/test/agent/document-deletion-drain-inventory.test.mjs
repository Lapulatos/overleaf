/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { deletionDrainInventory } from '../../app/src/Features/WritingAssist/DocumentDeletionDrainInventory.mjs'
const projectId='a'.repeat(24)
const ticket=()=>({projectId,docId:'b'.repeat(24),userId:'c'.repeat(24),taskId:randomUUID(),proposalId:randomUUID(),operationId:randomUUID(),expectedVersion:3,baseHash:'d'.repeat(64),path:'chapter.tex'})
test('crash gap ticket becomes an admitted row, matching receipts retain execution state',()=>{
 const t=ticket();const r={...t,state:'committing'}
 assert.deepEqual(deletionDrainInventory(projectId,[],[t]),[{...t,state:'admitted'}])
 assert.deepEqual(deletionDrainInventory(projectId,[r],[t]),[r])
 assert.deepEqual(deletionDrainInventory(projectId,[r],[]),[r])
})
test('different operation or snapshot cannot hide behind an existing receipt',()=>{
 for(const change of [{operationId:randomUUID()},{taskId:randomUUID()},{expectedVersion:4},{path:'other.tex'}]) {
  const t=ticket();assert.throws(()=>deletionDrainInventory(projectId,[{...t,state:'committed',...change}],[t]),{status:409})
 }
})
test('duplicate and cross-project entries are rejected',()=>{
 const t=ticket();const r={...t,state:'committed'}
 for(const [receipts,tickets] of [[[r,r],[]],[[],[t,t]],[[{...r,projectId:'e'.repeat(24)}],[]],[[],[{...t,projectId:'e'.repeat(24)}]]]) {
  assert.throws(()=>deletionDrainInventory(projectId,receipts,tickets),{status:409})
 }
})
