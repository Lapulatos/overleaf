import {expect} from 'chai'
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react'
import sinon from 'sinon'
import {GraphSettingsDialog,defaultGraphSettings} from '@/features/source-control/graph-settings'
describe('Git graph settings action audit',()=>{
 afterEach(cleanup)
 it('saves actual changed graph options, identity override and remote visibility',async()=>{
  const command=sinon.stub().callsFake(async c=>c.command==='remotes'?{result:[{name:'origin',refs:{fetch:'https://read.test/repo',push:'https://write.test/repo'}}]}:{result:c.settings})
  const save=sinon.spy(),close=sinon.spy()
  render(<GraphSettingsDialog api={{command,status:sinon.stub(),initialize:sinon.stub()}} value={defaultGraphSettings} branches={[]} onSave={save} onClose={close} onCredentials={()=>{}}/>)
  fireEvent.click(await screen.findByRole('checkbox',{name:'origin'}))
  fireEvent.click(screen.getByRole('checkbox',{name:'Show Tags'}))
  fireEvent.click(screen.getByRole('checkbox',{name:'Only follow the first parent of commits'}))
  fireEvent.change(screen.getByLabelText('User name'),{target:{value:'Audit'}})
  fireEvent.change(screen.getByLabelText('User email'),{target:{value:'audit@example.test'}})
  fireEvent.click(screen.getByRole('button',{name:'Save settings'}))
  await waitFor(()=>expect(save.calledOnce).to.equal(true))
  expect(save.firstCall.args[0]).to.include({showTags:false,firstParent:true,userName:'Audit',userEmail:'audit@example.test'})
  expect(save.firstCall.args[0].hiddenRemotes).to.deep.equal(['origin'])
  expect(close.calledOnce).to.equal(true)
 })
 it('edits remote URLs through guarded command and does not silently save a new remote',async()=>{
  const command=sinon.stub().callsFake(async c=>c.command==='remotes'?{result:[{name:'origin',refs:{fetch:'https://read.test/repo',push:'https://write.test/repo'}}]}:{result:null})
  render(<GraphSettingsDialog api={{command,status:sinon.stub(),initialize:sinon.stub()}} value={defaultGraphSettings} branches={[]} onSave={()=>{}} onClose={()=>{}} onCredentials={()=>{}}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Edit'}))
  fireEvent.change(screen.getByLabelText('pushUrl'),{target:{value:'https://new.test/repo'}})
  fireEvent.click(screen.getByRole('button',{name:'Save remote'}))
  await waitFor(()=>expect(command).to.have.been.calledWith({command:'changeRemote',name:'origin',expectedUrl:'https://read.test/repo',fetchUrl:'https://read.test/repo',pushUrl:'https://new.test/repo'}))
 })
})
