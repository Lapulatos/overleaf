import CollaborationTasks from './collaboration-tasks'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { gitApi, errorMessage, type GitApi, type GitCommand } from './api'
import { withSavedEditor } from './editor-operation'
import { parseGitCommand, prepareGitCommand } from './git-slash-command'

export function useGitCommand(projectId:string, api?:GitApi) {
 const scope=useRef(projectId);scope.current=projectId
 const backend=useMemo(()=>api||gitApi(projectId),[projectId,api]),editor=useContext(EditorManagerContext)
 const [entries,setEntries]=useState<{input:string;output:string;review?:{id:string;canApply:boolean}}[]>([])
 const [review,setReview]=useState<{id:string;canApply:boolean}>()
 const [pending,setPending]=useState<{input:string;body:GitCommand;preview:unknown}>()
 const [busy,setBusy]=useState(false),lock=useRef(false)
 useEffect(()=>{setEntries([]);setPending(undefined);setReview(undefined)},[projectId])
 const assertScope=()=>{if(scope.current!==projectId)throw Error('Project changed. Submit the Git command again.')}
 const add=(input:string,output:string,review?:{id:string;canApply:boolean})=>{if(scope.current===projectId)setEntries(old=>[...old.slice(-19),{input,output,review}])}
 const saved=async<T,>(action:()=>Promise<T>)=>{
  assertScope()
  if(!editor)throw Error('Open this project in the editor before running Git commands.')
  return withSavedEditor(editor.openDocs,busy=>window.dispatchEvent(new CustomEvent('native-git-local-write-state',{detail:{busy}})),()=>{assertScope();return action()})
 }
 const execute=async(input:string,body:GitCommand)=>{
  const response=await saved(()=>body.command==='$init'?backend.initialize():body.command==='$status'?backend.status():backend.command(body))
  assertScope()
  const task=response.result as {id?:unknown;state?:unknown}|undefined
  if(response.reviewRequired && typeof task?.id==='string') {
   add(input,`Remote updates fetched. Shared merge task: ${task.id}\nStatus: ${String(task.state)}\nFiles have not been updated. Review and apply the merge task to update this branch.`,{id:task.id,canApply:response.collaboration?.apply===true})
  } else add(input,JSON.stringify(response.result ?? response,null,2).slice(0,30000))
  window.dispatchEvent(new Event('native-git-command-completed'))
 }
 const start=async(input:string)=>{
  if(lock.current||pending)throw Error('Finish or cancel the pending Git command first.')
  lock.current=true;setBusy(true)
  try {
   const parsed=parseGitCommand(input)
   if(parsed.help){add(input,parsed.help);return}
   const body=parsed.body!
   const prepared=await saved(()=>prepareGitCommand(backend,body))
   assertScope()
   if(parsed.read)await execute(input,prepared.body)
   else {
    const policy=(await backend.command({command:'accessPolicy'})).result as {mode:string}
    assertScope()
    if(policy.mode==='read-only')throw Error('Read Only mode blocks this operation. Change permissions in Paper Assistant first.')
    const risky=['reset','undoCommit','discard','deleteBranch','deleteTag','dropStash','removeRemote','rebase','revert','push','pushTags','sync','clone','continueOperation'].includes(body.command)||body.amend
    if(policy.mode==='full-access'||(policy.mode==='auto-review'&&!risky))await execute(input,prepared.body)
    else setPending({input,body:prepared.body,preview:prepared.preview})
   }
  } catch(error){add(input,errorMessage(error));throw error} finally {lock.current=false;setBusy(false)}
 }
 const confirm=async()=>{
  if(!pending||lock.current)return
  lock.current=true;setBusy(true)
  try{await execute(pending.input,pending.body);setPending(undefined)}catch(error){add(pending.input,errorMessage(error));setPending(undefined)}finally{lock.current=false;setBusy(false)}
 }
 const panel=(entries.length||pending)?<section aria-label="Git command results" style={{padding:12,borderBottom:'1px solid #ddd',maxHeight:360,overflow:'auto'}}>
  <strong>Git commands</strong>
  <button type="button" disabled={busy} onClick={()=>setEntries([])}>Clear output</button>
  {entries.map((entry,index)=><details key={index} open={index===entries.length-1}><summary>{entry.input}</summary><pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{entry.output}</pre>{entry.review&&<button type="button" disabled={busy} onClick={()=>setReview(entry.review)}>Review merge task</button>}</details>)}
  {pending&&<div role="alert"><strong>Confirm {pending.input}</strong><pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{JSON.stringify({operation:pending.body,affectedState:pending.preview},null,2)}</pre><button type="button" disabled={busy} onClick={()=>void confirm()}>Run Git operation</button><button type="button" disabled={busy} onClick={()=>{add(pending.input,'Cancelled; no operation executed.');setPending(undefined)}}>Cancel</button></div>}
 </section>:null
 return {start,panel:<>{panel}{review&&<CollaborationTasks key={projectId} api={backend} canApply={review.canApply} selectedId={review.id} onClose={()=>setReview(undefined)}/>}</>,busy}
}
