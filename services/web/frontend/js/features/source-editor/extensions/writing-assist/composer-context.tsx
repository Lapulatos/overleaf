import { useEffect, useState } from 'react'
import { getJSON } from '@/infrastructure/fetch-json'
import { matchScore } from '@/features/plugins/plugin-groups'
import { usePlugins } from '@/features/plugins/plugin-library'
import { mentionText, referencedScope } from './composer-mentions'
import MaterialIcon from '@/shared/components/material-icon'
export type ScopeItem = {kind:'file'|'folder';path:string}
export type ComposerChoice = {id:string;label:string;description?:string;scope?:ScopeItem;skill?:string;command?:string;terminal?:string}
export function ComposerContext({projectId,value,caret,scope,skills,onScope,onSkills,onReplace,disabled}:{projectId:string;value:string;caret:number;scope:ScopeItem[];skills:string[];onScope:(s:ScopeItem[])=>void;onSkills:(s:string[])=>void;onReplace:(value:string,caret:number)=>void;disabled:boolean}){
 const {plugins,error:pluginError}=usePlugins()
 const [terminals,setTerminals]=useState<{reference:string;id:string;name:string;location:string;state:string}[]>([])
 useEffect(()=>{const c=new AbortController();getJSON<typeof terminals>(`/writing-assist/project/${projectId}/terminal-sessions`,{signal:c.signal}).then(setTerminals).catch(()=>{});return()=>c.abort()},[projectId,value.includes('@')])
 const [limit,setLimit]=useState(50)
 const [entries,setEntries]=useState<ScopeItem[]>([]); const [error,setError]=useState(''); const [active,setActive]=useState(0); const [closed,setClosed]=useState('')
 const token=value.slice(0,caret).match(/(?:^|[^\w@])([@/])([^\s]*)$/)
 const marker=token?.[1]; const query=token?.[2].toLowerCase() || ''; const signature=`${caret}:${value}`
 useEffect(()=>{setActive(0);setLimit(50)},[query,marker])
 useEffect(()=>{if(marker!=='@')return;const c=new AbortController();getJSON<ScopeItem[]>(`/writing-assist/project/${projectId}/context`,{signal:c.signal}).then(v=>{if(!c.signal.aborted){setEntries(v);setError('')}}).catch(()=>{if(!c.signal.aborted)setError('Could not load project files. Type @ again to retry.')});return()=>c.abort()},[projectId,marker])
 const allChoices:ComposerChoice[]=marker==='@'?[...terminals.map(t=>({t,score:Math.max(matchScore(t.name,query),matchScore(t.id,query),matchScore(t.location,query),matchScore(t.reference,query))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(({t})=>({id:t.reference,label:t.name,description:`${t.location} · ${t.state} · ${t.id}`,terminal:t.reference})),...entries.map(entry=>({entry,score:Math.max(matchScore(entry.path,query),matchScore(entry.path.split('/').at(-1)||'',query))})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score || Number(a.entry.kind==='folder')-Number(b.entry.kind==='folder') || a.entry.path.localeCompare(b.entry.path)).map(({entry:e})=>({id:e.kind+e.path,label:e.path+(e.kind==='folder'?'/':''),scope:e}))]:marker==='/'?[...('git'.startsWith(query)?[{id:'builtin-git-command',label:'git',description:'Git operations · /git help lists commands and parameters',command:'git help'}]:[]),...('plan'.startsWith(query)?[{id:'builtin-plan-command',label:'plan',description:'Current project · add your submission requirements after /plan',command:'plan'},...(query==='plan'?[{id:'plan-project',label:'plan · project ID',description:`Use project ${projectId}`,command:`plan project=${projectId}`},{id:'plan-quality',label:'plan · quality first',description:'Plan 18 months; prioritize high-quality publications, then speed.',command:'plan Plan 18 months; prioritize high-quality publications, then speed.'},{id:'plan-conferences',label:'plan · conferences',description:'Find suitable conference Tracks within 12 months.',command:'plan Recommend suitable conference Tracks within 12 months.'}]:[])]:[]),...plugins.filter(p=>p.enabled&&Math.max(matchScore(p.command,query),matchScore(p.name,query))>0&&!skills.includes(p.command)).sort((a,b)=>Math.max(matchScore(b.command,query),matchScore(b.name,query))-Math.max(matchScore(a.command,query),matchScore(a.name,query))).map(p=>({id:p.id,label:p.command,description:p.description,skill:p.command}))]:[]
 const choices=allChoices.slice(0,limit)
 useEffect(()=>{const next=referencedScope(value,[...scope,...entries]);if(JSON.stringify(next)!==JSON.stringify(scope))onScope(next)},[value,entries,scope,onScope])
 useEffect(()=>{const present=skills.filter(command=>value.split(/\s+/).includes('/'+command));if(present.length!==skills.length)onSkills(present)},[value,skills,onSkills])
 useEffect(()=>{document.querySelector('.paper-context-picker [aria-selected=true]')?.scrollIntoView?.({block:'nearest'})},[active])
 const visible=Boolean(token && closed!==signature && !disabled && !(marker==='/' && query==='goal'))
 const selectedCommand=value.slice(0,caret).match(/(?:^|\s)\/([a-z0-9-]+)\s+[^/]*$/)?.[1]
 const helpCommand=visible && marker==='/' ? choices[active]?.skill : selectedCommand
 const helpPlugin=visible && marker==='@' ? undefined : plugins.find(p=>p.enabled && p.command===helpCommand)
 const [dismissedHelp,setDismissedHelp]=useState('')
 function fillExample(example:string){
  if(!helpPlugin)return
  const command='/'+helpPlugin.command
  const start=visible ? caret-(token?.[2].length||0)-1 : value.lastIndexOf(command,caret)
  const end=visible ? caret : value.length
  const text=command+' '+example
  onSkills([...new Set([...skills,helpPlugin.command])].slice(0,5))
  onReplace(value.slice(0,start)+text+value.slice(end),start+text.length)
  setDismissedHelp(helpPlugin.command)
 }
 function select(choice:ComposerChoice){
  const start=caret-(token?.[2].length||0)-1
  if(choice.terminal){const text='@'+choice.terminal+' ';onReplace(value.slice(0,start)+text+value.slice(caret),start+text.length);setClosed(signature);return}
  if(choice.command || choice.skill){
   if(choice.skill){if(skills.length>=5)return;onSkills([...skills,choice.skill])}
   const text='/'+(choice.command || choice.skill)+' '
   onReplace(value.slice(0,start)+text+value.slice(caret),start+text.length)
   setClosed(signature);return
  }
  if(choice.scope){
   if(scope.length>=30 && !scope.some(s=>s.kind===choice.scope!.kind&&s.path===choice.scope!.path)){setError('You can reference up to 30 different files or folders.');return}
   const text=mentionText(choice.scope)+' '
   if(value.length-(caret-start)+text.length>32000){setError('The message is too long. Shorten it before adding references.');return}
   onScope([...scope,choice.scope]);
   onReplace(value.slice(0,start)+text+value.slice(caret),start+text.length);setClosed(signature)
  }
 }

 useEffect(()=>{if(!visible)return;const handler=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.id!=='paper-assistant-instruction')return;if(e.key==='Escape'){e.preventDefault();setClosed(signature)}else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setActive(n=>Math.max(0,Math.min(choices.length-1,n+(e.key==='ArrowDown'?1:-1))))}else if(['Enter','Tab'].includes(e.key)&&choices.length&&!e.isComposing){e.preventDefault();select(choices[Math.min(active,choices.length-1)])}};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler)})
 return <>
  {visible && <div className="paper-context-results">
  {marker==='@' && !!choices.length && <div className="paper-context-count" role="status">{choices.length} of {allChoices.length} files, folders and terminals · Search name, path or Session ID</div>}
  <div className="paper-context-picker" role="listbox" aria-label={marker==='@'?'Files, folders and terminal sessions':'Skills and commands'}>
   {choices.map((choice,index)=><button className="btn btn-secondary" role="option" aria-label={choice.label} aria-selected={active===index} type="button" key={choice.id} onMouseDown={e=>e.preventDefault()} onClick={()=>select(choice)}><MaterialIcon type={choice.terminal?'terminal':choice.skill?'extension':choice.scope?.kind==='folder'?'folder':'description'}/><span><strong>{marker==='/'?'/':''}{choice.label}</strong>{choice.description&&<small>{choice.description}</small>}</span></button>)}
   {error&&choices.length>0&&<p role="status">{error}</p>}
   {!choices.length&&<p>{(marker==='@'?error:pluginError)||'No matches.'}</p>}
  </div>
  {choices.length<allChoices.length && <button type="button" className="btn btn-secondary paper-context-more" onMouseDown={e=>e.preventDefault()} onClick={()=>setLimit(n=>n+50)}>Show more ({allChoices.length-choices.length} remaining)</button>}
  </div>}
  {!disabled && helpPlugin?.usage && (visible || dismissedHelp!==helpPlugin.command) && <aside className="paper-command-help" aria-label="Skill usage">
   <div><strong>/{helpPlugin.command} <span>[task] [material] [requirements]</span></strong><button type="button" aria-label="Dismiss Skill help" onClick={()=>{setDismissedHelp(helpPlugin.command);setClosed(signature)}}><MaterialIcon type="close"/></button></div>
   <p>{helpPlugin.usage.input}</p>
   {helpPlugin.usage.examples.slice(0,2).map(example=><button type="button" className="paper-command-example" key={example} onMouseDown={e=>e.preventDefault()} onClick={()=>fillExample(example)} title="Insert example without sending"><MaterialIcon type="input"/><span>/{helpPlugin.command} {example}</span></button>)}
   <small>{helpPlugin.usage.source} · Click an example to edit it before sending.</small>
  </aside>}
 </>
}
