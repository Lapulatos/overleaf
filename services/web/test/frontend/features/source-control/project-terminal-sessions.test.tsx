import {expect} from 'chai'
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react'
import sinon from 'sinon'
import ShellDrafts from '@/features/source-control/shell-drafts'
import type {GitApi} from '@/features/source-control/api'
describe('Project-wide terminal sessions',()=>{
 afterEach(cleanup)
 it('searches all source branches and opens another branch history without navigation',async()=>{
  const a={id:'session-a',workspaceId:'a',revision:2,state:'review-ready',sourcePosition:{branch:'topic-alpha',head:'a'.repeat(40),dirty:false}}
  const b={id:'session-b',workspaceId:'b',revision:1,state:'ready',sourcePosition:{branch:'topic-beta',head:'b'.repeat(40),dirty:false}}
  const command=sinon.stub().callsFake(async body=>({result:body.command==='shellDraftList'?[a,b]:body.command==='shellDraftGet'?a:body.command==='shellDraftHistory'?{output:'alpha history'}:{}}))
  render(<ShellDrafts embedded api={{projectId:'b',command} as unknown as GitApi} canApply onClose={()=>{}}/>)
  fireEvent.click(screen.getByRole('button',{name:'Manage terminal sessions'}))
  await screen.findByText('topic-alpha');await screen.findByText('topic-beta')
  fireEvent.change(screen.getByRole('textbox',{name:'Search terminal sessions'}),{target:{value:'topic-alpha'}})
  expect(screen.queryByText('topic-beta')).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Open terminal session-'}))
  await screen.findByLabelText('Read-only terminal history')
  expect(command.args.some(([body])=>body.command==='shellDraftPrepare')).to.equal(false)
 })
 it('creates in the current workspace rather than automatically taking another branch shell',async()=>{
  const command=sinon.stub().callsFake(async body=>({result:body.command==='shellDraftList'?[{id:'old-a',workspaceId:'a',state:'running',sessionStatus:'connected'}]:{id:'new-b',workspaceId:'b',revision:1,state:'ready'}}))
  render(<ShellDrafts embedded autoStart api={{projectId:'b',command} as unknown as GitApi} canApply onClose={()=>{}}/>)
  await waitFor(()=>expect(command.args.some(([body])=>body.command==='shellDraftStart' && body.id==='new-b')).to.equal(true))
  expect(command.args.some(([body])=>body.command==='shellDraftPoll' && body.id==='old-a')).to.equal(false)
 })
})
