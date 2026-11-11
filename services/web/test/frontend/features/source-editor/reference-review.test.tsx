import { expect } from 'chai'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReferenceReviewCard } from '@/features/source-editor/extensions/writing-assist/reference-review'
import type { ReferenceReview,ReferenceFieldChoice } from '@/features/source-editor/extensions/writing-assist/agent-task-result'
const review:ReferenceReview={docId:'b',baseHash:'hash',keys:['a','b'],checkedAt:'2026-11-01T10:00:00Z',entries:[{key:'a',source:'https://api.crossref.org/x',identity:null,reason:null,fields:[{field:'year',current:'2020',found:'2024',status:'review-difference'},{field:'publisher',current:'',found:'ACM',status:'missing-in-bibliography'},{field:'title',current:'Do not render me',found:'Do not render me',status:'matches'}],actions:[{field:'year',before:'2020',after:'2024'},{field:'publisher',before:'',after:'ACM'}]},{key:'b',source:null,identity:null,reason:'No unique exact-title candidate',fields:[],actions:[]}]}
describe('Issue-only reference review',function(){
 afterEach(function(){localStorage.clear()})
 it('supports selected and all fields and separates unknown sources',function(){
  const calls:ReferenceFieldChoice[][]=[]
  render(<ReferenceReviewCard review={review} onRepair={()=>{}} onApply={fields=>calls.push(fields)} disabled={false}/>)
  expect(screen.queryByText('Do not render me')).to.equal(null)
  expect(screen.getAllByRole('img',{name:'Needs confirmation'}).length).to.be.greaterThan(0)
  expect(screen.getByText('No unique source found. Add a DOI and check again.')).to.exist
  expect(screen.getByRole('button',{name:'Apply selected'}).hasAttribute('disabled')).to.equal(true)
  fireEvent.click(screen.getByRole('checkbox',{name:'Select a Year'}));fireEvent.click(screen.getByRole('button',{name:'Apply selected'}))
  expect(calls[0]).to.deep.equal([{key:'a',field:'year'}])
  fireEvent.click(screen.getByRole('button',{name:'Apply all (2)'}))
  expect(calls[1]).to.deep.equal([{key:'a',field:'year'},{key:'a',field:'publisher'}])
 })
 it('rejects individual fields, excludes them from Apply all, persists and allows undo',function(){
  const calls:ReferenceFieldChoice[][]=[]
  const props={review,onRepair:()=>{},onApply:(fields:ReferenceFieldChoice[])=>calls.push(fields),disabled:false}
  const view=render(<ReferenceReviewCard {...props}/>)
  fireEvent.click(screen.getByRole('button',{name:'Reject a Year'}))
  expect(screen.queryByRole('button',{name:'Apply a Year'})).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Apply all (1)'}));expect(calls[0]).to.deep.equal([{key:'a',field:'publisher'}])
  view.unmount();render(<ReferenceReviewCard {...props}/>)
  fireEvent.click(screen.getByRole('button',{name:'Undo reject a Year'}))
  expect(screen.getByRole('button',{name:'Apply all (2)'})).to.exist
 })
 it('enables verified DOI completion while explaining only the conflicting field',function(){
  const verified:ReferenceReview={...review,entries:[{key:'a',source:'https://api.crossref.org/x',identity:null,reason:null,verification:{crossCheckedFields:['doi'],verified:true,reason:null,summary:'Automatically verified against the DOI registry and ACL Anthology.',sources:[{label:'ACL Anthology',url:'https://aclanthology.org/x.bib'}]},fields:[{field:'doi',current:'',found:'10.1234/a',status:'missing-in-bibliography'},{field:'address',current:'',found:'A',status:'missing-in-bibliography',verificationReason:'Publication records disagree.'}],actions:[{field:'doi',before:'',after:'10.1234/a'}]}]}
  render(<ReferenceReviewCard review={verified} onRepair={()=>{}} onApply={()=>{}} disabled={false}/>)
  expect(screen.getByRole('button',{name:'Apply a DOI'})).to.exist
  expect(screen.getByRole('img',{name:'Cross-verified'})).to.exist
  expect(screen.getByRole('img',{name:'Source conflict'})).to.exist
  expect(screen.queryByRole('button',{name:'Apply a Publisher address'})).to.equal(null)
  expect(screen.getByText('Publication records disagree.')).to.exist
  expect(screen.getByText('Automatically verified against the DOI registry and ACL Anthology.')).to.exist
 })
 it('never enables direct apply for legacy evidence without snapshot protection',function(){
  render(<ReferenceReviewCard review={{...review,baseHash:undefined}} onRepair={()=>{}} onApply={()=>{throw Error('not allowed')}} disabled={false}/>)
  expect(screen.queryByRole('button',{name:/Apply all/})).to.equal(null)
  expect(screen.getByRole('button',{name:'Check again to enable field actions'})).to.exist
 })
})
