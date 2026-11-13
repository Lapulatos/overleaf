import {expect} from 'chai'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import sinon from 'sinon'
import CollaborationTasks from '@/features/source-control/collaboration-tasks'
import BranchWorkspaces from '@/features/source-control/branch-workspaces'
import MergeBranchPicker from '@/features/source-control/merge-branch-picker'
import type {GitApi} from '@/features/source-control/api'
describe('Consolidated branch and merge workflow',()=>{
 afterEach(cleanup)
 it('offers a source choice instead of an empty merge dropdown',async()=>{
  const command=sinon.stub().resolves({result:[]}),start=sinon.spy()
  render(<CollaborationTasks api={{command} as unknown as GitApi} canApply onClose={()=>{}} onNewMerge={start}/>)
  await screen.findByText('No merge in progress')
  expect(screen.queryByRole('combobox')).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Choose source branch…'}))
  expect(start.calledOnce).to.equal(true)
  expect(command.args.every(([b])=>b.command==='mergeDraftList')).to.equal(true)
 })
 it('archive screen retains archive and restore without duplicate checkout',async()=>{
  const command=sinon.stub().resolves({result:[{workspaceId:'a',branch:'topic',state:'ready'},{workspaceId:'b',branch:'old',state:'archived'}]})
  render(<BranchWorkspaces api={{command} as unknown as GitApi} onClose={()=>{}}/>)
  await screen.findByText('topic')
  expect(screen.queryByRole('link',{name:/Open/})).to.equal(null)
  expect(screen.getByRole('button',{name:'Archive'})).to.exist
  expect(screen.getByRole('button',{name:'Restore'})).to.exist
  expect(screen.getByText(/Git branch are kept/)).to.exist
 })
 it('draft source chooser says preview before any apply',()=>{
  const onMerge=sinon.spy()
  render(<MergeBranchPicker preview branches={[{name:'topic',ref:'refs/heads/topic',commit:'12345678',remote:false,upstream:null,author:'A',email:'',date:'',subject:'Change'}]} target="main" busy={false} error="" onMerge={onMerge} onClose={()=>{}}/>)
  fireEvent.click(screen.getByRole('radio'))
  fireEvent.click(screen.getByRole('button',{name:'Preview changes'}))
  expect(onMerge.calledWith('refs/heads/topic')).to.equal(true)
 })
})
