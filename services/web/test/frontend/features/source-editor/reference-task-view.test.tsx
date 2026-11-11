import {expect} from 'chai'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {ReferenceTaskView} from '@/features/source-editor/extensions/writing-assist/reference-task-view'
import type {Task,ReferenceFieldChoice} from '@/features/source-editor/extensions/writing-assist/agent-task-result'
describe('Reference pending file preview',()=>{
 afterEach(()=>{cleanup();localStorage.clear()})
 it('allows individual Apply and Reject while a combined preview is pending',()=>{
  const calls:ReferenceFieldChoice[][]=[]
  const task:Task={taskId:'review',status:'completed',instruction:'Preview fixes',summary:'',output:'',proposals:[{id:'p',path:'refs.bib',docId:'b',before:'old',after:'new',status:'pending'}],referenceReview:{docId:'b',baseHash:'hash',keys:['a'],checkedAt:'today',entries:[{key:'a',source:'https://example.org',identity:null,reason:null,actions:[{field:'year',before:'2020',after:'2024'}],fields:[{field:'year',current:'2020',found:'2024',status:'review-difference'}]}]}}
  render(<ReferenceTaskView task={task} busy={false} onFields={fields=>calls.push(fields)} onClaim={()=>{}} onRepair={()=>{}} act={()=>{throw Error('Whole-file accept must not be required')}}/>)
  const apply=screen.getByRole('button',{name:'Apply a Year'});expect(apply.hasAttribute('disabled')).to.equal(false);fireEvent.click(apply);expect(calls).to.deep.equal([[{key:'a',field:'year'}]])
  expect(screen.getByRole('button',{name:'Reject a Year'}).hasAttribute('disabled')).to.equal(false)
  expect(screen.queryByRole('button',{name:'Accept change'})).to.equal(null)
 })
})
