export type IssueResolution={status:'unresolved'|'resolved';method?:string;updatedAt?:string;summary?:string;evidence?:string[];blockers?:string[];notice?:string}
export function issueCommand(command:string,id:string){
 window.dispatchEvent(new CustomEvent('paper-plugin-command',{detail:{command,input:id,replace:true}}))
}
export function ReportIssueActions({id,resolved,total}:{id:string;resolved:number;total:number}){
 return <div className="track-report-actions"><div><strong>Report ID</strong> <code>{id}</code><span>{resolved} / {total} resolved</span></div><button type="button" disabled={resolved===total} onClick={()=>issueCommand('resolve-report',id)}>Process unresolved issues</button><p>Use <code>/resolve-report {id}</code> in Paper Assistant to work through the remaining issues.</p></div>
}
export function FindingIssueActions({id,resolution}:{id:string;resolution?:IssueResolution}){
 const resolved=resolution?.status==='resolved'
 return <div className="track-issue-actions">{resolution?.summary&&<p>{resolution.summary}</p>}{!!resolution?.evidence?.length&&<ul>{resolution.evidence.map((text,i)=><li key={i}>{text}</li>)}</ul>}{!resolved&&!!resolution?.blockers?.length&&<aside><strong>Needs your input</strong><ul>{resolution.blockers.map((text,i)=><li key={i}>{text}</li>)}</ul></aside>}{resolution?.notice&&<p>{resolution.notice}</p>}<code>{id}</code><div><button type="button" onClick={()=>issueCommand('resolve-issue',id)}>Investigate / fix</button><button type="button" onClick={()=>issueCommand(resolved?'reopen-issue':'close-issue',id)}>{resolved?'Reopen in Assistant':'Mark resolved in Assistant'}</button></div></div>
}
