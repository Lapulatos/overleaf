/* eslint-disable mocha/no-global-tests -- Uses the Node test runner. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSourceSelection } from '../../app/src/Features/WritingAssist/WritingAssistSelection.mjs'
const docs=[{id:'doc',path:'tex/main.tex',version:7,content:'first\nsecond\nthird'}]
test('server derives exact file and inclusive line range, excluding a trailing newline',()=>{
 assert.deepEqual(resolveSourceSelection(docs,{docId:'doc',from:6,to:13,text:'second\n'}),{docId:'doc',path:'tex/main.tex',version:7,from:6,to:13,text:'second\n',startLine:2,endLine:2})
 assert.equal(resolveSourceSelection(docs,{docId:'doc',from:6,to:18,text:'second\nthird'}).endLine,3)
 assert.equal(resolveSourceSelection(docs,undefined),undefined)
})
test('stale, out-of-project and malformed selection is rejected',()=>{
 const valid={docId:'doc',from:6,to:12,text:'second'}
 for(const change of [{text:'changed'},{docId:'foreign'},{from:-1},{to:999},{to:6},{from:1.2}]) {
  assert.throws(()=>resolveSourceSelection(docs,{...valid,...change}),{status:409})
 }
})
