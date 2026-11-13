import { test } from 'node:test'
import assert from 'node:assert/strict'
import { skillUsage } from '../../app/src/Features/Plugins/SkillUsage.mjs'
test('keeps author examples as arguments, independent of command alias',()=>{
 const usage=skillUsage('## Examples\n/old-name Review main.tex for missing evidence.\n/other Ignore this command.','Review papers','old-name')
 assert.deepEqual(usage.examples,['Review main.tex for missing evidence.'])
 assert.match(usage.source,/installed Skill guide/)
})
test('writing examples follow documented modes and stay bounded',()=>{
 const usage=skillUsage('polish compress manuscript','Draft and revise prose','writer')
 assert.equal(usage.examples.length,3)
 assert.ok(usage.examples.some(e=>e.includes('实验结果留空')))
 assert.ok(usage.examples.every(e=>!e.startsWith('/')))
})
test('unknown skills receive honest input template, not invented flags',()=>{
 const usage=skillUsage('','Audit references. Check sources.','audit')
 assert.match(usage.examples[0],/Audit references/)
 assert.match(usage.source,/Suggested/)
 assert.ok(!usage.examples.join('').includes('--'))
})
