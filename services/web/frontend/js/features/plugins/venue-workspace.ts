import {getJSON,postJSON} from '@/infrastructure/fetch-json'
import type {Recommendations} from './venue-recommendations'
type Patch={plan?:Record<string,unknown>;favorites?:string[]}
type Workspace={migrationWarning?:string;userId:string;plan:Record<string,unknown>|null;favorites:string[]|null;recommendation:{taskId:string;result:Recommendations;savedAt:number}|null}
const queues=new Map<string,Promise<unknown>>()
const valid=(id?:string)=>Boolean(id&&/^[a-f0-9]{24}$/i.test(id))
export const favoritesKey=(id?:string)=>'submission-deadlines-tracked:'+(id||'local')
const pendingKey=(id:string)=>'venue-workspace-pending:'+id
function read(key:string){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
export function persistVenueWorkspace(id:string|undefined,patch:Patch){
 if(!id||!valid(id))return Promise.resolve()
 const pending={...(read(pendingKey(id))||{}),...patch};localStorage.setItem(pendingKey(id),JSON.stringify(pending))
 const expectedUserId=localStorage.getItem('venue-workspace-owner:'+id)||undefined
 const job=(queues.get(id)||Promise.resolve()).catch(()=>{}).then(()=>postJSON<Workspace>(`/writing-assist/project/${id}/venue-workspace`,{body:{...pending,expectedUserId}})).then(value=>{if(localStorage.getItem(pendingKey(id))===JSON.stringify(pending))localStorage.removeItem(pendingKey(id));return value}).catch(()=>{window.dispatchEvent(new Event('venue-workspace-save-failed'))})
 queues.set(id,job);return job
}
export async function hydrateVenueWorkspace(id:string){
 await queues.get(id)
 let value=await getJSON<Workspace>(`/writing-assist/project/${id}/venue-workspace`)
 const ownerKey='venue-workspace-owner:'+id,owner=localStorage.getItem(ownerKey)
 if(owner&&owner!==value.userId){for(const key of ['submission-sequence:'+id,favoritesKey(id),'venue-recommendations:'+id,'paper-plan-command:'+id,'paper-plan-result:'+id,pendingKey(id)])localStorage.removeItem(key)}
 localStorage.setItem(ownerKey,value.userId)
 const patch:Patch=read(pendingKey(id))||{}
 if(!value.plan&&!patch.plan)patch.plan=read('submission-sequence:'+id)||undefined
 if(!value.favorites&&!patch.favorites)patch.favorites=read(favoritesKey(id))||(!owner||owner===value.userId?read('submission-deadlines-tracked'):undefined)||undefined
 if(Object.values(patch).some(v=>v!==undefined)){
  // Keep an exact copy before sending legacy browser data to a newer schema.
  const backup='venue-workspace-migration-backup:'+id
  if(!localStorage.getItem(backup))localStorage.setItem(backup,JSON.stringify({userId:value.userId,...patch}))
  try{value=await postJSON<Workspace>(`/writing-assist/project/${id}/venue-workspace`,{body:{...patch,expectedUserId:value.userId}});localStorage.removeItem(pendingKey(id))}
  catch{value={...value,plan:patch.plan||value.plan,favorites:patch.favorites||value.favorites,migrationWarning:'Your browser plan is available, but could not be synchronized. The original data has been backed up in this browser. Retry synchronization after reviewing your plan.'}}
 }
 if(value.plan)localStorage.setItem('submission-sequence:'+id,JSON.stringify(value.plan))
 if(value.favorites)localStorage.setItem(favoritesKey(id),JSON.stringify(value.favorites))
 if(value.recommendation)localStorage.setItem('venue-recommendations:'+id,value.recommendation.taskId)
 return value
}
export function hasWorkspaceProject(id?:string){return valid(id)}
