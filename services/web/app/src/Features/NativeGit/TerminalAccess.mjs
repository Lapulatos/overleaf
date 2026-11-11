import { randomUUID } from 'node:crypto'
const approvals=new Map()
export function approveTerminal(key,directories) {
 for(const [id,grant] of approvals)if(grant.expires<Date.now()||grant.key===key)approvals.delete(id)
 const id=randomUUID();approvals.set(id,{key,directories,expires:Date.now()+60000});return {approval:id}
}
export function consumeTerminalApproval(key,id,directories) {
 const grant=approvals.get(id);approvals.delete(id)
 if(!grant||grant.key!==key||grant.expires<Date.now()||JSON.stringify(grant.directories)!==JSON.stringify(directories))throw Object.assign(new Error('Approve the exact extra directories before starting this session.'),{status:403})
}
export async function terminalRequest(body) {
 const endpoint=process.env.OVERLEAF_NATIVE_GIT_TERMINAL_ENDPOINT
 if(!endpoint)throw Object.assign(new Error('Isolated terminal runner is not configured. Shell access remains disabled.'),{status:503})
 const response=await fetch(endpoint+'/terminal',{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Token':process.env.OVERLEAF_TERMINAL_RUNNER_TOKEN},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})
 const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'Terminal runner refused the operation'),{status:409});return result
}
