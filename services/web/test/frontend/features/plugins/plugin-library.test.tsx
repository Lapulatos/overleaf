import * as rail from '@/features/ide-react/context/rail-context'
import { expect } from 'chai'
import sinon from 'sinon'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import PluginLibrary, { PluginCommands, PluginCard } from '@/features/plugins/plugin-library'
const plugins=[{id:'one',command:'audit',name:'Audit',description:'Check references',enabled:true},{id:'two',command:'hidden',name:'Hidden',description:'Disabled',enabled:false}]
describe('Skill command picker',function(){
 afterEach(function(){cleanup();sinon.restore()})
 it('lists only enabled matching commands and inserts slash invocation',async function(){
  sinon.stub(requests,'getJSON').resolves({plugins})
  const selected=sinon.spy();render(<PluginCommands value="/a" onSelect={selected}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Use /audit'}))
  expect(selected.calledOnceWithExactly('/audit ')).to.equal(true)
  expect(screen.queryByText('/hidden')).to.equal(null)
 })
 it('shows no match without inventing a command',async function(){
  sinon.stub(requests,'getJSON').resolves({plugins})
  render(<PluginCommands value="/missing" onSelect={()=>{}}/>)
  expect(await screen.findByText('No matching enabled Skills. Install one in Plugins.')).to.exist
 })
})

describe('Installed Skill card',function(){
 it('shows a short description and usage details without a fixed-action button',function(){
  const onToggle=sinon.spy(),onRemove=sinon.spy()
  render(<PluginCard plugin={{id:'card',command:'library',name:'Paper library',description:'Collect papers. Verify citations and organize a library.',enabled:true,sourceUrl:'https://github.com/example/library',commit:'a'.repeat(40),resourceCount:2,resourcePaths:['SKILL.md','references/check.md'],unsupportedFiles:[]}} busy={false} onToggle={onToggle} onRemove={onRemove} onSave={()=>{}}/>)
  expect(screen.getByText('Collect papers.')).to.exist
  expect(screen.queryByRole('button',{name:'Use /library'})).to.equal(null)
  fireEvent.click(screen.getByRole('switch',{name:'Enable library'}));expect(onToggle.calledOnceWithExactly(false)).to.equal(true)
  fireEvent.click(screen.getByRole('button',{name:'Details for library'}))
  expect(screen.getByText('How to use')).to.exist
  fireEvent.click(screen.getByRole('button',{name:'Remove library'}));expect(onRemove.calledOnce).to.equal(true)
 })
})

describe('Repository Skill disclosure',function(){
 afterEach(function(){cleanup();sinon.restore()})
 it('starts collapsed and filters children by fuzzy command inside its repository',async function(){
  cleanup()
  sinon.stub(rail,'useRailContext').returns({handlePaneCollapse:()=>{}} as any)
  sinon.stub(requests,'getJSON').resolves({plugins:plugins.map(p=>({...p,sourceUrl:'https://github.com/example/tools',commit:'a'.repeat(40),resourceCount:1,unsupportedFiles:[]}))})
  render(<PluginLibrary/>);
  const search=await screen.findByRole('searchbox',{name:'Search tools Skills or commands',hidden:true})
  const disclosure=search.closest('details')!;expect(disclosure.open).to.equal(false)
  fireEvent.click(disclosure.querySelector('summary')!);disclosure.open=true
  fireEvent.change(search,{target:{value:'audt'}})
  expect(disclosure.querySelectorAll('.skill-mapping-row')).to.have.length(1)
  expect(disclosure.textContent).to.include('/audit')
  fireEvent.change(search,{target:{value:'zzz-no-result'}})
  expect(screen.getByText('No matching Skills in this repository.')).to.exist
 })
})
