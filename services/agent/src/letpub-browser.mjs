import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const execute=promisify(execFile)
const script=`on run argv
 tell application "Google Chrome"
  repeat with w in windows
   repeat with t in tabs of w
    if URL of t starts with "https://www.letpub.com.cn/" then return execute t javascript (item 1 of argv)
   end repeat
  end repeat
 end tell
 error "Open a signed-in LetPub tab in Chrome first"
end run`
export function validateLetPubUrl(value){
 const u=new URL(value)
 if(u.origin!=='https://www.letpub.com.cn'||u.pathname!=='/index.php'||u.username||u.password||u.searchParams.get('page')!=='journalapp'||!['search','detail'].includes(u.searchParams.get('view')))throw new Error('Only LetPub journal search and detail pages are supported')
 for(const key of u.searchParams.keys())if(!['page','view','journalid','searchname'].includes(key))throw new Error('Unsupported LetPub query')
 return u.href
}
export async function fetchLetPubInBrowser(value,{run}={}){
 const url=validateLetPubUrl(value)
 run ||= async js=>(await execute('osascript',['-e',script,js],{maxBuffer:3000000,timeout:30000})).stdout.trim()
 const key='__paperAssistantMetrics'+Math.random().toString(36).slice(2)
 try{
 await run(`window[${JSON.stringify(key)}]={pending:true};fetch(${JSON.stringify(url)},{credentials:'same-origin',signal:AbortSignal.timeout(22000)}).then(async r=>{if(!r.ok)throw new Error('HTTP '+r.status);window[${JSON.stringify(key)}]={text:await r.text()}}).catch(e=>window[${JSON.stringify(key)}]={error:e.message});'started'`)
 for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,500));const result=JSON.parse(await run(`JSON.stringify(window[${JSON.stringify(key)}])`));if(result.pending)continue;if(result.error)throw new Error(result.error);if(typeof result.text!=='string'||result.text.length>2000000)throw new Error('Invalid LetPub response');return {url,text:result.text}}
 throw new Error('LetPub read timed out')
 }finally{await run(`delete window[${JSON.stringify(key)}];'cleared'`).catch(()=>{})}
}
