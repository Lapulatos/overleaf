import { activityText } from './document-activity.mjs'
// Read the validated disposable workspace after a tool finishes. This also
// captures shell/script edits which do not emit a Codex fileChange item.
export function liveChangeTracker(workspace, documents) {
 const original=new Map(documents.map(d=>[d.path,d.content]))
 let previous=new Map(original)
 return async()=>{
  const current=new Map(original)
  for(const change of await workspace.changes()){
   if(change.kind==='delete')current.delete(change.path)
   else current.set(change.path,change.after)
  }
  const result=[];let budget=48000
  for(const path of new Set([...previous.keys(),...current.keys()])){
   const before=previous.get(path),after=current.get(path)
   if(before===after)continue
   const limit=Math.min(12000,Math.floor(budget/2));budget-=Math.min(limit,(before||'').length)+Math.min(limit,(after||'').length)
   result.push({path,kind:before===undefined?'create':after===undefined?'delete':'edit',before:activityText(before||'',workspace.directory,limit),after:activityText(after||'',workspace.directory,limit),truncated:(before||'').length>limit||(after||'').length>limit})
  }
  previous=current
  return result
 }
}
