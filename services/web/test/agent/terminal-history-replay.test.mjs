import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {Terminal}=createRequire(import.meta.url)('../../frontend/js/features/source-control/vendor/xterm.cjs')
const replay=async output=>{const terminal=new Terminal({cols:80,rows:24,disableStdin:true});await new Promise(resolve=>terminal.write(output,resolve));const lines=Array.from({length:terminal.buffer.active.length},(_,i)=>terminal.buffer.active.getLine(i).translateToString(true));terminal.dispose();return lines}
test('history replays carriage returns and erase-line without duplicating prompt',async()=>{
 const lines=await replay('bash-5.2# \r\x1b[2Kbash-5.2# \r\x1b[2Kbash-5.2# ')
 assert.equal(lines[0].trim(),'bash-5.2#');assert.equal(lines.filter(x=>x.trim()).length,1)
})
test('history preserves command lines, colors and cursor overwrite',async()=>{
 const lines=await replay('bash$ echo hello\r\n\x1b[32mhello\x1b[0m\r\nprogress 10%\rprogress 90%\r\nbash$ ')
 assert.deepEqual(lines.slice(0,4).map(x=>x.trim()),['bash$ echo hello','hello','progress 90%','bash$'])
})
