import { useReviewDecisions } from './review-decisions'
import { useEffect, useState } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import type { ReferenceReview, ReferenceFieldChoice } from './agent-task-result'
const labels: Record<string,string> = {title:'Title',author:'Authors',year:'Year',month:'Month',pages:'Pages',publisher:'Publisher',booktitle:'Proceedings / book',journal:'Journal',volume:'Volume',number:'Issue',doi:'DOI',url:'URL',isbn:'ISBN',issn:'ISSN',address:'Publisher address',location:'Conference location',abstract:'Abstract',numpages:'Page count',keywords:'Keywords',series:'Series',articleno:'Article number'}
const id = (key: string,field: string) => JSON.stringify([key,field])
export function ReferenceReviewCard({review,onRepair,onApply,disabled}: {review: ReferenceReview;onRepair:()=>void;onApply:(fields:ReferenceFieldChoice[])=>void;disabled:boolean}) {
 const {rejected,toggle}=useReviewDecisions(`metadata:${review.docId}:${review.checkedAt}`)
 const [selected,setSelected]=useState<Set<string>>(new Set())
 useEffect(()=>setSelected(new Set()),[review])
 const issues=review.entries.map(entry=>({...entry,issues:entry.fields.filter(f=>['review-difference','missing-in-bibliography'].includes(f.status)),unknown:entry.fields.filter(f=>f.status==='unresolved-macro' || (f.status==='source-missing' && f.current))}))
 const available=issues.flatMap(e=>!e.source || e.identity || e.reason || !review.baseHash ? [] : (e.actions || []).filter(a=>e.issues.some(f=>f.field===a.field)).map(f=>({key:e.key,field:f.field})))
 const actionable=available.filter(f=>!rejected.has(id(f.key,f.field)))
 const actionIds=new Set(actionable.map(f=>id(f.key,f.field)))
 const chosen=actionable.filter(f=>selected.has(id(f.key,f.field)))
 const needsSource=issues.filter(e=>!e.source || e.identity || e.reason)
 const visible=issues.filter(e=>e.issues.length>0 || !e.source || e.identity || e.reason)
 const consistent=review.entries.length-visible.length
 const different=issues.flatMap(e=>e.issues).filter(f=>f.status==='review-difference').length
 const sourceConflicts=issues.flatMap(e=>e.issues).filter(f=>f.verificationReason).length
 const missing=issues.flatMap(e=>e.issues).filter(f=>f.status==='missing-in-bibliography').length
 return <section className="paper-reference-review" aria-label="Reference check summary">
  <header className="paper-reference-review-heading"><MaterialIcon type={visible.length?'fact_check':'check_circle'}/><div><h3>{visible.length?'Check results':'No changes needed'}</h3><span>{review.path || 'References'} · {review.entries.length} checked</span></div></header>
  {!!review.appliedCount && <p className="paper-reference-applied" role="status"><MaterialIcon type="check"/>Applied {review.appliedCount} changes</p>}
  <div className="paper-reference-review-counts">{!!sourceConflicts && <span>{sourceConflicts} source conflicts</span>}{!!different && <span>{different} differences</span>}{!!missing && <span>{missing} missing fields</span>}{!!needsSource.length && <span>{needsSource.length} need source confirmation</span>}</div>
  {!!consistent && <p className="paper-reference-consistent">{consistent} checked with no pending corrections</p>}
  {actionable.length>0 && <div className="paper-reference-apply-bar">
   <label><input type="checkbox" aria-label="Select all applicable fields" disabled={disabled} checked={chosen.length===actionable.length} onChange={e=>setSelected(e.target.checked?new Set(actionIds):new Set())}/>{chosen.length} selected</label>
   <button className="btn btn-secondary" type="button" disabled={disabled || !chosen.length} onClick={()=>onApply(chosen)}>Apply selected</button>
   <button type="button" className="paper-reference-primary" disabled={disabled} onClick={()=>onApply(actionable)}>Apply all ({actionable.length})</button>
  </div>}
  {visible.map(entry=><article key={entry.key} className="paper-reference-issue-entry">
   <div className="paper-reference-entry-heading"><strong>{entry.key}</strong>{entry.source && /^https:\/\//.test(entry.source) && <a href={entry.source} target="_blank" rel="noopener noreferrer" title="View verification source">Source <MaterialIcon type="open_in_new"/></a>}</div>
   {entry.verification && <div className="paper-reference-verification"><p><MaterialIcon type={entry.verification.verified?'verified':'help'}/>{entry.verification.summary}</p><details><summary>Verification sources</summary>{entry.verification.sources.map(source=><p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></p>)}{entry.verification.officialUnavailable && <p>The official export could not be retrieved; verification used the DOI record.</p>}</details></div>}
   {entry.issues.map(f=>{
    const fieldId=id(entry.key,f.field)
    const isRejected=rejected.has(fieldId)
    const canApply=actionIds.has(fieldId)
    const conflict=Boolean(f.verificationReason || entry.verification?.blockedFields?.[f.field])
    const crossChecked=!conflict && entry.verification?.verified && entry.verification.crossCheckedFields?.includes(f.field)
    const verificationState=conflict?'conflict':crossChecked?'verified':'unconfirmed'
    const verificationLabel=conflict?'Source conflict':crossChecked?'Cross-verified':'Needs confirmation'
    const verificationHint=conflict?'Sources disagree on this field. Manual confirmation is required.':crossChecked?'This field agrees across the DOI registry and the official publication record.':'This field has not been cross-verified against multiple sources. Manual confirmation is needed.' 
    return <div className={`paper-reference-field${isRejected?' paper-reference-rejected':''}`} key={f.field}>
     {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Focusable status icon exposes the verification description to keyboard users. */}
     <div className="paper-reference-field-heading"><span className="paper-reference-field-label"><span className={`paper-reference-field-verification paper-reference-field-verification-${verificationState}`} role="img" aria-label={verificationLabel} title={`${verificationLabel}: ${verificationHint}`} tabIndex={0}>
      <MaterialIcon type={conflict?'error':crossChecked?'verified':'warning'}/>
     </span>{canApply && <input type="checkbox" aria-label={`Select ${entry.key} ${labels[f.field] || f.field}`} disabled={disabled} checked={selected.has(id(entry.key,f.field))} onChange={e=>setSelected(prev=>{const next=new Set(prev);if(e.target.checked)next.add(id(entry.key,f.field));else next.delete(id(entry.key,f.field));return next})}/>}<b>{labels[f.field] || f.field}</b><span>{isRejected?'Rejected':f.current?'Correction':'Missing'}</span></span>
      {canApply && <button type="button" className="paper-reference-apply-one" title={`Apply ${labels[f.field] || f.field}`} aria-label={`Apply ${entry.key} ${labels[f.field] || f.field}`} disabled={disabled} onClick={()=>onApply([{key:entry.key,field:f.field}])}><MaterialIcon type="check"/>Apply</button>}
      <button type="button" className="paper-reference-apply-one" disabled={disabled} aria-label={`${isRejected?'Undo reject':'Reject'} ${entry.key} ${labels[f.field] || f.field}`} onClick={()=>toggle(fieldId)}><MaterialIcon type={isRejected?'undo':'close'}/>{isRejected?'Undo reject':'Reject'}</button>
     </div>
     {f.current && <div className="paper-reference-value paper-reference-before"><span>Current</span><p>{f.current}</p></div>}
     <div className="paper-reference-value paper-reference-after"><span>{f.current?'Suggested':'Add'}</span><p>{f.found}</p></div>
     {!canApply && !isRejected && review.baseHash && <small>{f.verificationReason || entry.verification?.reason || (f.field==='url' && f.current ? 'An existing source link can be valid alongside a DOI link. It is preserved.' : 'This field has not been verified automatically. Review its source before editing.')}</small>}
    </div>
   })}
   {(!entry.source || entry.identity || entry.reason) && <p className="paper-reference-manual"><MaterialIcon type="help"/>{entry.verification?.reason || (entry.identity?'Multiple title matches. Confirm the DOI and publication version.':entry.reason?.includes('No unique')?'No unique source found. Add a DOI and check again.':'Source unavailable. Check the DOI or try again later.')}</p>}
  </article>)}
  {!review.baseHash && (different>0 || missing>0) && <button className="btn btn-secondary" type="button" disabled={disabled} onClick={onRepair}>Check again to enable field actions</button>}
  {issues.some(e=>e.unknown.length>0) && <details className="paper-reference-unverified"><summary>Existing fields without source evidence</summary>{issues.filter(e=>e.unknown.length>0).map(e=><p key={e.key}>{e.key}: {e.unknown.map(f=>labels[f.field] || f.field).join(', ')}. Not supplied by the source; original values retained.</p>)}</details>}
  {!!rejected.size && <p className="paper-reference-consistent">Rejected suggestions are excluded from Apply all. Decisions are saved in this browser for this report.</p>}
  <footer>Matching fields hidden · {new Date(review.checkedAt).toLocaleString()}</footer>
 </section>
}
