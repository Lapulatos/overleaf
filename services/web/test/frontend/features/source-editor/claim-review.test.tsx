import {expect} from 'chai'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {ClaimReviewCard} from '@/features/source-editor/extensions/writing-assist/claim-review'
import {AssistantMessage} from '@/features/source-editor/extensions/writing-assist/agent-messages'
import type {ClaimReview} from '@/features/source-editor/extensions/writing-assist/agent-task-result'
describe('Citation suggestion cards',function(){
 afterEach(()=>{cleanup();localStorage.clear()})
 it('shows a diff and one action per validated correction, none for missing evidence',function(){
  const calls:string[]=[];const review:ClaimReview={checkedAt:'now',items:[{id:'c0',docId:'doc0',path:'main.tex',line:8,keys:['a'],before:'Always works.',after:'Sometimes works.',verdict:'partial',reason:'The source limits the result.',source:'https://example.org',quote:'A source passage.',status:'pending',note:null},{id:'c1',path:'main.tex',line:12,keys:['b'],before:'Another claim.',after:null,verdict:'insufficient',reason:'No text available.',source:null,quote:null,status:'review',note:'Source evidence is insufficient.'}]}
  render(<ClaimReviewCard review={review} busy={false} onApply={id=>calls.push(id)}/>);
  expect(screen.getByRole('region',{name:'Line diff'})).to.exist
  expect(screen.getAllByRole('button',{name:/Apply suggestion/})).to.have.length(1)
  fireEvent.click(screen.getByRole('button',{name:'Apply suggestion c0'}));expect(calls).to.deep.equal(['c0'])
  fireEvent.click(screen.getByRole('button',{name:'Reject suggestion c0'}));expect(screen.getByRole('button',{name:'Apply suggestion c0'}).hasAttribute('disabled')).to.equal(true)
  fireEvent.click(screen.getByRole('button',{name:'Undo reject suggestion c0'}));expect(screen.getByRole('button',{name:'Apply suggestion c0'}).hasAttribute('disabled')).to.equal(false)
  expect(screen.getByText('Needs source evidence')).to.exist
  const events:unknown[]=[];const listener=(event:Event)=>events.push((event as CustomEvent).detail)
  window.addEventListener('reference-locate-citation',listener)
  fireEvent.click(screen.getByRole('button',{name:'Go to cited sentence'}));window.removeEventListener('reference-locate-citation',listener)
  expect(events).to.deep.equal([{docId:'doc0',text:'Always works.'}])
  expect(screen.getByText('Another claim.').closest('details')?.open).to.equal(true)
 })
 it('renders Markdown tables and removes unsafe HTML',function(){
  render(<AssistantMessage text={'| Field | Result |\n|---|---|\n| Title | Correct |\n\n<script>alert(1)</script><img src=x onerror=alert(1)>'}/>);
  expect(screen.getByRole('table')).to.exist;expect(screen.getByRole('columnheader',{name:'Field'})).to.exist
  expect(document.querySelector('script')).to.equal(null);expect(document.querySelector('img')).to.equal(null)
 })
})
