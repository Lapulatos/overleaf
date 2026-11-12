import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import sinon from 'sinon'
import GitPresenceList, { PresenceMarkers } from '@/features/source-control/git-presence-list'
const base={sessionId:'tabA',userId:'same-user',workspaceId:'workspace',epoch:1,sequence:1,displayName:'Alice',branch:'unpublished',head:'a'.repeat(40),dirty:true,viewedCommit:'b'.repeat(40),online:true,lastSeen:1000}
describe('Graph collaborator positions',()=>{
 afterEach(cleanup)
 it('keeps same-user tabs and editing/history positions separate, locates without checkout',()=>{
  const locate=sinon.spy()
  render(<GitPresenceList sessions={[base,{...base,sessionId:'tabB',branch:'main',viewedCommit:null}]} loaded={new Set()} onLocate={locate}/>)
  expect(screen.getAllByText('Alice')).to.have.length(1)
  fireEvent.click(screen.getByRole('button',{name:'Editing unpublished · Working Changes'}))
  expect(locate.firstCall.args).to.deep.equal([base.head])
  fireEvent.click(screen.getByRole('button',{name:'Viewing history bbbbbbbb'}))
  expect(locate.secondCall.args).to.deep.equal([base.viewedCommit])
  expect(screen.getByRole('button',{name:'Editing unpublished · Working Changes'}).title).to.contain('outside')
 })
 it('shows offline time and disables location for a branch without commits',()=>{
  render(<GitPresenceList sessions={[{...base,online:false,head:null,viewedCommit:null}]} loaded={new Set()} onLocate={()=>{throw Error('no commit')}}/>)
  fireEvent.click(screen.getByText('Alice'))
  fireEvent.click(screen.getByText('Offline sessions (1)'))
  expect(screen.getByText(/Last seen/)).to.exist
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).to.equal(true)
 })
 it('marks both editing and history viewing when they share a node',()=>{
  const {container}=render(<PresenceMarkers sessions={[{...base,viewedCommit:base.head}]} hash={base.head}/>)
  expect(container.querySelectorAll('.native-git-presence-avatar')).to.have.length(2)
  expect(screen.getByTitle(/viewing history/)).to.exist
  expect(screen.getByTitle(/editing/)).to.exist
 })
})

describe('collaborator session groups',()=>{
 afterEach(cleanup)
 it('does not merge different users with the same name and collapses retained offline sessions',()=>{
  const sessions=[base,{...base,sessionId:'old-tab',online:false},{...base,userId:'another-user',sessionId:'other-tab'}]
  const {container}=render(<GitPresenceList sessions={sessions} loaded={new Set()} onLocate={()=>{}} />)
  expect(container.querySelectorAll('.native-git-presence-user')).to.have.length(2)
  expect(container.querySelectorAll('[data-session-id]')).to.have.length(3)
  const offline=container.querySelector('.native-git-presence-offline') as HTMLDetailsElement
  expect(offline.open).to.equal(false)
  expect(offline.contains(screen.getByRole('button',{name:/Last editing/}))).to.equal(true)
  fireEvent.click(screen.getByText('Offline sessions (1)'))
  expect(offline.open).to.equal(true)
 })
 it('moves a disconnected session to last-seen history while preserving another live tab',()=>{
  const other={...base,sessionId:'tabB',branch:'second'}
  const view=render(<GitPresenceList sessions={[base,other]} loaded={new Set()} onLocate={()=>{}} />)
  view.rerender(<GitPresenceList sessions={[{...base,online:false},other]} loaded={new Set()} onLocate={()=>{}} />)
  expect(screen.getByRole('button',{name:'Editing second · Working Changes'})).to.exist
  expect(screen.queryByRole('button',{name:'Editing unpublished · Working Changes'})).to.equal(null)
  expect(screen.getByText('Offline sessions (1)')).to.exist
 })
})

describe('grouped Graph node markers',()=>{
 afterEach(cleanup)
 it('bounds repeated offline avatars while retaining separate roles and all session identities',()=>{
  const old=Array.from({length:100},(_,i)=>({...base,sessionId:`old-${i}`,online:false,viewedCommit:null}))
  const {container}=render(<PresenceMarkers sessions={[...old,{...base,viewedCommit:base.head}]} hash={base.head}/>)
  expect(container.querySelectorAll('.native-git-presence-avatar')).to.have.length(3)
  const offline=container.querySelector('.is-offline')!
  expect(offline.textContent).to.contain('×100')
  expect(offline.getAttribute('title')).to.contain('session old-99')
  expect(offline.getAttribute('aria-label')).to.contain('last editing')
  expect(screen.getByLabelText(/Alice · editing · Working Changes based on this commit/)).to.exist
  expect(screen.getByLabelText(/Alice · viewing history/)).to.exist
 })
 it('keeps equal display names and clean versus dirty editing distinct',()=>{
  const {container}=render(<PresenceMarkers sessions={[base,{...base,sessionId:'clean',dirty:false},{...base,sessionId:'different-user',userId:'other'}]} hash={base.head}/>)
  expect(container.querySelectorAll('.native-git-presence-avatar')).to.have.length(3)
 })
})
