import { useState } from 'react'
// Store only dismissed suggestion identities, never manuscript or bibliography text.
// checkedAt scopes decisions to this report; a fresh check starts a fresh review.
export function useReviewDecisions(scope: string) {
 const storageKey=`reference-rejected:${scope}`
 const [state,setState]=useState<{key:string;ids:string[]}>(()=>({key:storageKey,ids:read(storageKey)}))
 const ids=state.key===storageKey?state.ids:read(storageKey)
 function toggle(id:string){
  const next=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]
  try {localStorage.setItem(storageKey,JSON.stringify(next))}catch { /* Keep session interaction usable when storage is unavailable. */ }
  setState({key:storageKey,ids:next})
 }
 return {rejected:new Set(ids),toggle}
}
function read(key:string):string[]{try {const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[]}catch{return []}}
