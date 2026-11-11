import test from 'node:test'
import assert from 'node:assert/strict'
import { documentActivity, activityText } from '../src/document-activity.mjs'
test('internal reasoning and unknown notifications are never exposed', () => {
 for (const type of ['reasoning','unknown','userMessage']) assert.equal(documentActivity('item/completed',{id:'x',type,text:'private reasoning'}),null)
 assert.equal(documentActivity('item/reasoning/textDelta',{id:'x',type:'reasoning'}),null)
})
test('command lifecycle exposes bounded public execution facts', () => {
 const item={id:'cmd',type:'commandExecution',command:'cat /tmp/work/main.tex',aggregatedOutput:'ok',exitCode:0}
 assert.deepEqual(documentActivity('item/started',item,'/tmp/work'),{id:'cmd',status:'running',kind:'command',title:'Run command',command:'cat [project]/main.tex'})
 assert.equal(documentActivity('item/completed',item).exitCode,0)
 assert.equal(documentActivity('item/completed',{...item,status:'failed'}).status,'failed')
 assert.equal(documentActivity('item/completed',{...item,exitCode:1}).status,'failed')
})
test('file changes expose paths but not patch payloads', () => {
 const result=documentActivity('item/completed',{id:'f',type:'fileChange',changes:[{path:'/tmp/work/main.tex',diff:'secret manuscript'}]},'/tmp/work')
 assert.deepEqual(result.files,['[project]/main.tex']);assert.ok(!JSON.stringify(result).includes('secret manuscript'))
})
test('public updates survive while credentials and excessive output are filtered', () => {
 assert.equal(documentActivity('item/completed',{id:'m',type:'agentMessage',text:'Checking references'}).text,'Checking references')
 const text=activityText('token=abc password:xyz Bearer private sk-1234567890123456789')
 for (const value of ['abc','xyz','private','sk-123']) assert.ok(!text.includes(value))
 assert.equal(activityText('x'.repeat(5000)).length,4000)
})
