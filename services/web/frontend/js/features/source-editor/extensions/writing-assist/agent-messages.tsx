import {issueClarifications,IssueClarificationForms} from './issue-clarification'
import {sourceFailure} from '@overleaf/validation-tools/agent-tool-evidence.mjs'
import { ProposalDiff } from './proposal-diff'
import { useState, useRef, useEffect, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

export type SourceSelection = { path: string; startLine: number; endLine: number }
export type Activity = { toolName?:string;toolSuccess?:boolean; changes?:{path:string;kind:string;before:string;after:string;truncated?:boolean}[];outputTruncated?:boolean;previewUnavailable?:boolean;truncated?:boolean;at?:string; id: string; kind: string; title: string; status: string; command?: string; output?: string; exitCode?: number | null; files?: string[]; text?: string }

export function MessageCopyButton({ text, label = 'Copy message' }: { text: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch { setStatus('failed') }
  }
  return <span className="paper-message-copy">
    <button className="btn btn-secondary" type="button" aria-label={label} title={status === 'copied' ? 'Copied' : label} onClick={copy}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
      {status === 'copied' && <span className="visually-hidden">Copied</span>}
    </button>
    <span role="status">{status === 'failed' ? 'Clipboard access failed. Select the text and copy it with Ctrl/Cmd+C.' : ''}</span>
  </span>
}

export function MessageAvatar({ assistant = false }: { assistant?: boolean }) {
  return <span className={`paper-message-avatar ${assistant ? 'paper-message-avatar-assistant' : 'paper-message-avatar-user'}`} role="img" aria-label={assistant ? 'Paper Assistant' : 'You'}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {assistant ? <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="M20 2v4M18 4h4" /></> : <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
    </svg>
  </span>
}

export function UserMessage({ instruction, sourceSelection }: { instruction: string; sourceSelection?: SourceSelection }) {
  return <div className="paper-user-message"><MessageAvatar /><p>{instruction}</p>
    {sourceSelection && <div className="paper-selection-reference">{sourceSelection.path} · L{sourceSelection.startLine}{sourceSelection.endLine !== sourceSelection.startLine ? `–${sourceSelection.endLine}` : ''}</div>}
    <MessageCopyButton text={instruction} label="Copy your message" />
  </div>
}
export function AssistantMessage({ text, compact = false }: { text: string; compact?: boolean }) {
  const [linkNotice,setLinkNotice]=useState('')
  const content=useRef<HTMLDivElement>(null)
  const openLink=useCallback((event:MouseEvent)=>{
    const anchor=(event.target as HTMLElement).closest('a');if(!anchor)return
    const href=anchor.getAttribute('href')||''
    if(/^(https?:|mailto:)/i.test(href)){anchor.setAttribute('target','_blank');anchor.setAttribute('rel','noopener noreferrer');return}
    event.preventDefault();setLinkNotice('')
    let path;try{path=decodeURIComponent(href.split(/[?#]/)[0]).replace(/^\.\//,'').replace(/^\//,'')}catch{setLinkNotice('This file link is invalid.');return}
    if(!path||path.split('/').some(part=>!part||part==='..')||/^[a-z]+:/i.test(path)){setLinkNotice('This link does not point to an available project file.');return}
    const request=new CustomEvent('paper-open-project-file',{cancelable:true,detail:{path,onError:(text:string)=>setLinkNotice(text)}})
    if(window.dispatchEvent(request))setLinkNotice('The project editor is not available here.')
  },[])
  const clarification=issueClarifications(text)
  const html = DOMPurify.sanitize(marked.parse(clarification.text, {gfm:true,mangle:false,headerIds:false}), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'del', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'title', 'start'],
  })
  useEffect(()=>{const node=content.current;node?.addEventListener('click',openLink);return()=>node?.removeEventListener('click',openLink)},[html,openLink])
  return <div className="paper-assistant-message"><div ref={content} dangerouslySetInnerHTML={{ __html: html }} /><IssueClarificationForms requests={clarification.requests}/>{linkNotice&&<p className="paper-file-link-notice" role="status">{linkNotice}</p>}{!compact&&<MessageCopyButton text={clarification.text} label="Copy assistant message" />}</div>
}
export function AgentActivity({ activity = [], running = false }: { activity?: Activity[]; running?: boolean }) {
  if (!activity.length) return null
  return <ol className="paper-execution-timeline" aria-label="Execution timeline">
    {activity.map(raw=>{const failure=sourceFailure(raw);const item=failure?{...raw,status:'failed'}:raw;return <li key={item.id} className={`paper-execution-event paper-execution-${item.kind}`}>
      {item.kind==='message'?<AssistantMessage text={item.text || ''}/>:<>
        <div className="paper-execution-heading"><span aria-hidden="true">{item.kind==='files'?'±':item.status==='running'?'◌':item.status==='failed'?'!':'✓'}</span><strong>{item.command || item.title}</strong><span className="paper-task-status">{item.status}{item.exitCode!=null?` · exit ${item.exitCode}`:''}</span></div>
        {(item.command||item.output||item.text||item.exitCode!=null)&&<details><summary>Details</summary>{item.command&&(item.command.length>180||item.command.includes("\n"))&&<pre className="paper-command-output" aria-label="Full command">{item.command}</pre>}{item.outputTruncated&&<p>Output excerpt (truncated).</p>}{failure?<div className="paper-source-failure"><strong>{failure.httpStatus||failure.error?.includes('403')?'Source access failed':'Source retrieval failed'}{failure.httpStatus?` · HTTP ${failure.httpStatus}`:''}</strong><p>{failure.explanation||failure.error}</p>{failure.url&&/^https?:\/\//i.test(failure.url)&&<a href={failure.url} target="_blank" rel="noopener noreferrer">Source URL ↗</a>}<p>{failure.nextStep}</p></div>:item.output&&<pre className="paper-command-output">{item.output}</pre>}{item.text&&<AssistantMessage text={item.text}/>} {item.exitCode!=null&&<small>Exit code: {item.exitCode}</small>}</details>}
        {!item.changes?.length&&item.files?.map(path=><code key={path}>{path}</code>)}
        {item.changes?.map((change,index)=><details className="paper-live-edit" key={`${change.path}-${index}`} open><summary>{change.path} · {change.kind} · Snapshot change</summary>{change.truncated?<p>Large change: live preview is partial. Full final changes appear after the task finishes.</p>:null}{(change.before||change.after)&&<ProposalDiff before={change.before} after={change.after}/>}</details>)}
        {(item.previewUnavailable||item.truncated)&&<p>Live details are incomplete. Review the final task changes when available.</p>}
      </>}
    </li>})}
    {running&&<li className="paper-execution-wait" role="status">Working… New actions appear here as they happen.</li>}
  </ol>
}
