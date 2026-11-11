import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import { useProjectContext } from '@/shared/context/project-context'
import SubmissionDeadlines from './submission-deadlines'
const WorkspaceContext=createContext<{active:boolean;open:()=>void;close:()=>void;toolbarHost:HTMLDivElement|null}|null>(null)
export const useSubmissionWorkspace=()=>useContext(WorkspaceContext)
export function SubmissionWorkspaceButton(){const workspace=useContext(WorkspaceContext);return workspace?<button type="button" className="toggle-switch-label submission-editor-tab" aria-pressed={workspace.active} onClick={()=>workspace.open()}><span>Venues</span></button>:null}
export function SubmissionWorkspace({children}:{children:ReactNode}){
 const {projectId}=useProjectContext()
 const [toolbarHost,setToolbarHost]=useState<HTMLDivElement|null>(null);const [opened,setOpened]=useState(false);const [active,setActive]=useState(false)
 const {setIsOpen}=useRailContext()
 const open=()=>{setOpened(true);setActive(true);setIsOpen(false)}
 useEffect(()=>{const listener=()=>{setOpened(true);setActive(true);setIsOpen(false)};window.addEventListener('paper-open-submissions',listener);window.addEventListener('paper-open-plan',listener);if(new URLSearchParams(window.location.search).get('openPlan')==='1')listener();return()=>{window.removeEventListener('paper-open-submissions',listener);window.removeEventListener('paper-open-plan',listener)}},[setIsOpen])
 return <WorkspaceContext.Provider value={{active,open,close:()=>setActive(false),toolbarHost}}><div className="submission-workspace">
  <div ref={setToolbarHost} className="submission-shared-toolbar" hidden={!active}/>
  <div className="submission-editor-surface" hidden={active}>{children}</div>
  {opened&&<section className="submission-workspace-surface" hidden={!active} aria-label="Venue workspace">

   <SubmissionDeadlines projectId={projectId} onBack={()=>setActive(false)} workspace/>
  </section>}
 </div></WorkspaceContext.Provider>
}
