import {useState} from 'react'
import MaterialIcon from '@/shared/components/material-icon'
export default function TerminalSessionReference({kind,id}:{kind:'ssh'|'paper';id:string}){
 const [copied,setCopied]=useState(false),[failed,setFailed]=useState(false)
 const reference=`@terminal/${kind}/${id}`
 return <span className="terminal-session-reference"><code title={reference}>ID {id}</code><button type="button" title={copied?'Copied Session reference':'Copy Session reference for Paper Assistant'} aria-label="Copy Session reference" onClick={async()=>{try{await navigator.clipboard.writeText(reference);setCopied(true);setFailed(false);setTimeout(()=>setCopied(false),1800)}catch{setFailed(true)}}}><MaterialIcon type={copied?'check':'content_copy'}/></button>{failed&&<small role="status">Copy failed. Select the ID to copy.</small>}</span>
}
