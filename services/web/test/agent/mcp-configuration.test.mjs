import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configuration, publicService } from '../../app/src/Features/Mcp/McpConfiguration.mjs'
const http = { name: 'Docs', transport: 'http', url: 'https://example.org/mcp' }
test('HTTP config normalizes display fields and defaults description', () => {
  assert.deepEqual(configuration.parse({ ...http, name: ' Docs ' }), { ...http, description: '' })
})
test('invalid protocol, credentials, fragments and unknown security fields rejected', () => {
  for (const url of ['file:///tmp/x','javascript:alert(1)','not-a-url','https://user:pass@example.org/mcp','https://example.org/mcp#token']) assert.equal(configuration.safeParse({ ...http, url }).success, false)
  for (const field of ['userId','enabled','status','headers']) assert.equal(configuration.safeParse({ ...http, [field]: 'injected' }).success, false)
})
test('stdio preserves argument boundaries without interpreting command text', () => {
  const value = { name:'Local',transport:'stdio',command:'npx',args:['-y','package-name','argument with spaces'] }
  assert.deepEqual(configuration.parse(value), { ...value, description:'' })
  assert.equal(configuration.safeParse({ ...value,args:['x\u0000y'] }).success,false)
  assert.equal(configuration.safeParse({ ...value,command:'npx\nwhoami' }).success,false)
  assert.equal(configuration.safeParse({ ...value,args:Array(51).fill('a') }).success,false)
})
test('transport must not retain stale fields and limits are enforced', () => {
  for (const input of [{...http,command:'npx'},{...http,name:' '},{...http,name:'x'.repeat(101)},{...http,description:'x'.repeat(501)}]) assert.equal(configuration.safeParse(input).success,false)
})
test('public record omits ownership and never claims connection', () => {
 const record=publicService({_id:'id',userId:'secret',...http,description:'',revision:0,command:'stale',status:'connected'})
 assert.equal(record.status,'disconnected');assert.equal(record.userId,undefined);assert.equal(record.command,undefined)
})
