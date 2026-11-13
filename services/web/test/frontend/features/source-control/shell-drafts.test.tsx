import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import ShellDrafts from '@/features/source-control/shell-drafts'
import type { GitApi } from '@/features/source-control/api'
describe('shell drafts',()=>{
 afterEach(cleanup)
 for(const recover of [false,true])it(recover?'requires explicit preservation and blocks unsafe resume':'requires review before apply',async()=>{
  const task={id:'draft',revision:4,state:recover?'recovery-required':'review-ready'},fingerprint='a'.repeat(64)
  const command=sinon.stub().callsFake(async body=>{
   if(body.command==='shellDraftList')return {result:[task]}
   if(body.command==='shellDraftGet')return {result:task}
   if(body.command==='shellDraftHistory')return {result:{output:null}}
   if(body.command==='shellDraftReview')return {result:{task,fingerprint,changes:[{path:"main.tex",status:"modified",beforeBytes:1,afterBytes:2}]}}
   if(body.command==='shellDraftRecoveryPreview')return {result:{task,fingerprint,canResume:false}}
   return {result:{...task,state:recover?'preserved':'applied'}}
  })
  render(<ShellDrafts api={{command} as unknown as GitApi} canApply onClose={()=>{}} />)
  fireEvent.click(screen.getByRole('button',{name:'Manage terminal sessions'}))
  fireEvent.click(await screen.findByRole('button',{name:'Open terminal draft'}))
  await screen.findByRole('region',{name:'Terminal history'})
  fireEvent.click(screen.getByRole('button',{name:'Refresh status'}))
  await waitFor(()=>expect(screen.queryByRole('region',{name:'Terminal history'})).to.equal(null))
  expect(screen.queryByRole('button',{name:'Apply to paper'})).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:recover?'Inspect recovery':'Review changes'}))
  if(recover)expect((await screen.findByRole('button',{name:'Resume application'}) as HTMLButtonElement).disabled).to.equal(true)
  fireEvent.click(await screen.findByRole('button',{name:recover?'Keep current content':'Apply to paper'}))
  const action=recover?'shellDraftRecover':'shellDraftApply'
  await waitFor(()=>expect(command.args.some(([body])=>body.command===action)).to.equal(true))
  const sent=command.args.find(([body])=>body.command===action)![0]
  expect(sent.id).to.equal('draft');expect(sent.revision).to.equal(4);expect(sent.fingerprint).to.equal(fingerprint)
  if(recover)expect(sent.mode).to.equal('preserve-current')
 })
})

describe('shell draft workspace changes',()=>{
 afterEach(cleanup)
 it('ignores old review completion after changing workspace API',async()=>{
  let resolveReview: (value: unknown)=>void = ()=>{}
  const task={id:'old',revision:1,state:'review-ready'}
  const oldCommand=sinon.stub().callsFake(async body=>body.command==='shellDraftList'?{result:[task]}:body.command==='shellDraftGet'?{result:task}:body.command==='shellDraftHistory'?{result:{output:null}}:new Promise(resolve=>{resolveReview=resolve}))
  const nextCommand=sinon.stub().resolves({result:[]})
  const view=render(<ShellDrafts api={{command:oldCommand} as unknown as GitApi} canApply onClose={()=>{}} />)
  fireEvent.click(screen.getByRole('button',{name:'Manage terminal sessions'}));fireEvent.click(await screen.findByRole('button',{name:'Open terminal old'}));await screen.findByRole('region',{name:'Terminal history'});fireEvent.click(screen.getByRole('button',{name:'Refresh status'}));await waitFor(()=>expect(screen.queryByRole('region',{name:'Terminal history'})).to.equal(null))
  fireEvent.click(screen.getByRole('button',{name:'Review changes'}))
  await waitFor(()=>expect(oldCommand.args.some(([b])=>b.command==='shellDraftReview')).to.equal(true))
  view.rerender(<ShellDrafts api={{command:nextCommand} as unknown as GitApi} canApply onClose={()=>{}} />)
  fireEvent.click(screen.getByRole('button',{name:'Manage terminal sessions'}));await screen.findByText('No sessions yet. Create a terminal to get started.')
  resolveReview({result:{task,fingerprint:'a'.repeat(64),changes:[]}})
  await new Promise(resolve=>setTimeout(resolve,20))
  expect(screen.queryByRole('button',{name:'Apply to paper'})).to.equal(null)
  expect(screen.queryByRole('alert')).to.equal(null)
 })
})

describe('shell draft creation and interrupted startup',()=>{
 afterEach(cleanup)
 it('prepares before starting and allows uncertain startup to stop and seal',async()=>{
  const task={id:'draft',revision:3,state:'ready'}
  const command=sinon.stub().callsFake(async body=>{
   if(body.command==='shellDraftList')return {result:[]}
   if(body.command==='shellDraftPrepare')return {result:task}
   if(body.command==='shellDraftStart')throw Error('Runner response lost')
   if(body.command==='shellDraftGet')return {result:{...task,revision:5,state:'recovery-required',failurePhase:'start'}}
   if(body.command==='shellDraftReview')return {result:{task,fingerprint:'a'.repeat(64),changes:[]}}
   if(body.command==='shellDraftSeal')return {result:{...task,revision:8,state:'review-ready'}}
   throw Error('Unexpected command')
  })
  render(<ShellDrafts api={{command} as unknown as GitApi} canApply onClose={()=>{}} />)
  fireEvent.click(screen.getByRole('button',{name:'Manage terminal sessions'}));await waitFor(()=>expect((screen.getByRole('button',{name:'New terminal'}) as HTMLButtonElement).disabled).to.equal(false));fireEvent.click(screen.getByRole('button',{name:'New terminal'}))
  await screen.findByText('Runner response lost')
  expect(command.args.find(([body])=>body.command==='shellDraftStart')![0]).to.deep.equal({command:'shellDraftStart',id:'draft',revision:3})
  fireEvent.click(screen.getByRole('button',{name:'Refresh status'}))
  await screen.findByText('recovery required')
  fireEvent.click(screen.getByRole('button',{name:'Stop and review changes'}))
  await screen.findByRole('region',{name:'Sealed changes'})
  expect(command.args.find(([body])=>body.command==='shellDraftSeal')![0].revision).to.equal(5)
 })
})
