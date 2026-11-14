import {readFileSync} from 'node:fs'
export async function sshNodeBridge(body){
 const c=JSON.parse(readFileSync('/etc/overleaf/remote-terminal.json','utf8'))
 const r=await fetch(c.endpoint+'/command',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${c.token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)})
 const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'SSH operation unavailable.'),{status:r.status});return data
}
