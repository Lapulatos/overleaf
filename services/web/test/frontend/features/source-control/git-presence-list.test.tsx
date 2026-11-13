import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import sinon from 'sinon'
import GitPresenceList, { PresenceMarkers } from '@/features/source-control/git-presence-list'
const base={sessionId:'tabA',userId:'same-user',workspaceId:'workspace',epoch:1,sequence:1,displayName:'Alice',branch:'unpublished',head:'a'.repeat(40),dirty:true,viewedCommit:null,online:true,lastSeen:1000}
describe('Compact collaborator positions',()=>{
 afterEach(cleanup)
 it('starts collapsed, hides connection identifiers and keeps distinct online branches locatable',()=>{
  const locate=sinon.spy()
  const {container}=render(<GitPresenceList sessions={[base,{...base,sessionId:'tabB',branch:'main'}]} loaded={new Set()} onLocate={locate}/>)
  expect((container.querySelector('details') as HTMLDetailsElement).open).to.equal(false)
  fireEvent.click(container.querySelector('summary')!)
  fireEvent.click(screen.getByRole('button',{name:/unpublished/}))
  expect(locate.firstCall.args).to.deep.equal([base.head])
  expect(container.textContent).not.to.contain('tabA')
  expect(container.textContent).not.to.contain('Session')
 })
 it('shows one current avatar per person and omits old connections from graph nodes',()=>{
  const sessions=[base,{...base,sessionId:'second'},{...base,userId:'bob',displayName:'Bob',sessionId:'bob'},...Array.from({length:30},(_,i)=>({...base,sessionId:`old${i}`,online:false}))]
  const {container}=render(<PresenceMarkers sessions={sessions} hash={base.head}/>)
  expect(container.querySelectorAll('.native-git-person-avatar')).to.have.length(2)
  expect(container.textContent).not.to.contain('×')
 })
 it('omits graph markers when everyone at the node is offline',()=>{
  const {container}=render(<PresenceMarkers sessions={[{...base,online:false}]} hash={base.head}/>)
  expect(container.firstChild).to.equal(null)
 })
})
