import { ProposalDiff } from './proposal-diff'
import { useReviewDecisions } from './review-decisions'
import type { ClaimReview } from './agent-task-result'
const verdicts={supported:'Supported — no edit needed',partial:'Suggested correction',contradicted:'Suggested correction',insufficient:'Needs source evidence'}
export function ClaimReviewCard({review,busy,onApply}:{review:ClaimReview;busy:boolean;onApply:(id:string)=>void}) {
 const {rejected,toggle}=useReviewDecisions(`claims:${review.checkedAt}`)
 const pending=review.items.filter(i=>i.status==='pending' && !rejected.has(i.id))
 return <section className="paper-reference-review" aria-label="Citation suggestions">
  <header className="paper-reference-review-heading"><div><h3>Citation review</h3><span>{pending.length} suggested edits · {review.items.filter(i=>i.verdict==='supported').length} supported · {review.items.filter(i=>i.verdict==='insufficient').length} need evidence</span></div></header>
  {!review.items.length && <p>No citation passages were found for the selected references.</p>}
  {review.items.map(item=>{
   const dismissed=rejected.has(item.id)
   const reason=<p>{item.reason}</p>
   return <article key={item.id} className={`paper-reference-issue-entry${dismissed?' paper-reference-rejected':''}`}>
    <div className="paper-reference-entry-heading"><strong>{item.path}<br/>Line {item.line}{item.before.includes('\n')?`–${item.line+item.before.split('\n').length-1}`:''}</strong><span>{item.status==='accepted'?'Applied':dismissed?'Rejected':verdicts[item.verdict]}</span></div>
    {item.docId && <button type="button" className="paper-reference-location" onClick={()=>window.dispatchEvent(new CustomEvent('reference-locate-citation',{detail:{docId:item.docId,text:item.before}}))}>Go to cited sentence</button>}
    <p className="paper-reference-consistent">{item.keys.join(', ')}</p>
    {item.verdict==='insufficient' ? <><p>Unable to verify this citation. No text change proposed.</p><p className="paper-reference-consistent">Next step: open the source and check this claim, or check again after source access is restored.</p><details><summary>Why verification stopped</summary>{reason}</details></> : reason}
    {item.after ? <><h4>Suggested edit</h4><ProposalDiff before={item.before} after={item.after} startLine={item.line}/></> : <details open className="paper-reference-passage"><summary>Cited sentence</summary><blockquote>{item.before}</blockquote></details>}
    {item.quote && <details open={item.verdict==='supported'} className="paper-reference-passage"> <summary>Source evidence</summary><blockquote>{item.quote}</blockquote></details>}
    <div className="paper-reference-apply-bar">
     {item.source && /^https:\/\//.test(item.source) && <a href={item.source} target="_blank" rel="noopener noreferrer">Open source</a>}
     {item.status==='pending' && item.after && <><button type="button" className="paper-reference-primary" disabled={busy || dismissed} aria-label={`Apply suggestion ${item.id}`} onClick={()=>onApply(item.id)}>Apply</button><button className="btn btn-secondary" type="button" disabled={busy} aria-label={`${dismissed?'Undo reject':'Reject'} suggestion ${item.id}`} onClick={()=>toggle(item.id)}>{dismissed?'Undo reject':'Reject'}</button></>}
    </div>
    {item.note && item.verdict!=='insufficient' && <p className="paper-reference-consistent">{item.note}</p>}
   </article>
  })}
  {!!rejected.size && <p className="paper-reference-consistent">Rejections are saved in this browser for this report.</p>}
 </section>
}
