import {expect} from 'chai'
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react'
import sinon from 'sinon'
import ShellDrafts from '@/features/source-control/shell-drafts'
import type {GitApi} from '@/features/source-control/api'
describe('Terminal session bulk deletion',()=>{
 afterEach(cleanup)
 for(const failure of [false,true])it(failure?'retains failed sessions selected after partial deletion':'selects only filtered sessions and deletes after confirmation',async()=>{
  let tasks=[{id:'aaaa1111',name:'Build one',revision:2,state:'ready'},{id:'bbbb2222',name:'Build two',revision:3,state:'ready'},{id:'cccc3333',name:'Other',revision:1,state:'ready'}]
  const command=sinon.stub().callsFake(async body=>{
   if(body.command==='shellDraftList')return {result:tasks}
   if(body.command==='shellDraftDelete'){
    if(failure && body.id==='bbbb2222')throw Error('Could not stop terminal')
    tasks=tasks.filter(t=>t.id!==body.id);return {result:{removed:true}}
   }
   throw Error('Unexpected operation')
  })
  render(<ShellDrafts embedded api={{command} as unknown as GitApi} canApply onClose={()=>{}}/>)
  fireEvent.click(screen.getByRole('button',{name:'Manage terminal sessions'}))
  await screen.findByRole('checkbox',{name:'Select terminal aaaa1111'})
  fireEvent.change(screen.getByRole('textbox',{name:'Search terminal sessions'}),{target:{value:'Build'}})
  fireEvent.click(screen.getByRole('checkbox',{name:'Select all visible terminal sessions'}))
  fireEvent.click(screen.getByRole('button',{name:'Delete selected sessions'}))
  expect(command.args.filter(([b])=>b.command==='shellDraftDelete')).to.have.length(0)
  const confirm=screen.getByRole('button',{name:'Delete 2 sessions'});expect(confirm.className).to.equal('native-git-session-confirm-delete')
  fireEvent.click(confirm)
  await waitFor(()=>expect(command.args.filter(([b])=>b.command==='shellDraftDelete')).to.have.length(2))
  await waitFor(()=>expect(screen.queryByRole('checkbox',{name:'Select terminal aaaa1111'})).to.equal(null))
  expect(tasks.some(t=>t.id==='cccc3333')).to.equal(true)
  if(failure){expect(await screen.findAllByText(/1 deleted; 1 could not be deleted/)).to.have.length(1);expect(screen.queryByText(/Could not stop terminal/)).to.equal(null);expect((screen.getByRole('checkbox',{name:'Select terminal bbbb2222'}) as HTMLInputElement).checked).to.equal(true)}
  else await waitFor(()=>expect(screen.queryByRole('checkbox',{name:'Select terminal bbbb2222'})).to.equal(null))
 })
})

describe('Terminal session double-click',()=>{
 afterEach(cleanup)
 it('opens a row while preserving name editing and checkbox selection',async()=>{
  const task={id:'dddd4444',name:'History session',createdBy:'alice',ownerDisplayName:'Alice Example',revision:1,state:'review-ready'}
  const command=sinon.stub().callsFake(async body=>{
   if(body.command==='shellDraftList')return {result:[task]}
   if(body.command==='shellDraftGet')return {result:task}
   if(body.command==='shellDraftHistory')return {result:{output:'Saved terminal output'}}
   throw Error('Unexpected operation')
  })
  render(<ShellDrafts embedded api={{command} as unknown as GitApi} canApply onClose={()=>{}}/>)
  fireEvent.click(screen.getByRole('button',{name:'Manage terminal sessions'}))
  const name=await screen.findByText('History session')
  expect(screen.getByLabelText('Alice Example').title).to.equal('Alice Example')
  expect(screen.queryByText('Alice Example')).to.equal(null)
  expect(screen.getByText('AE')).to.exist
  fireEvent.doubleClick(screen.getByRole('checkbox',{name:'Select terminal dddd4444'}))
  fireEvent.doubleClick(name)
  const input=screen.getByRole('textbox',{name:'Terminal name'})
  expect(command.args.filter(([b])=>b.command==='shellDraftGet')).to.have.length(0)
  fireEvent.keyDown(input,{key:'Escape'})
  fireEvent.doubleClick(screen.getByText('History session').closest('.native-git-session-card')!)
  await screen.findByLabelText('Read-only terminal history')
  expect(command.args.filter(([b])=>b.command==='shellDraftGet')).to.have.length(1)
 })
})
