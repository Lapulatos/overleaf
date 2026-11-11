import { expect } from 'chai'
import sinon from 'sinon'
import { render, screen, fireEvent } from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import { PluginCommands, PluginCard } from '@/features/plugins/plugin-library'
const plugins=[{id:'one',command:'audit',name:'Audit',description:'Check references',enabled:true},{id:'two',command:'hidden',name:'Hidden',description:'Disabled',enabled:false}]
describe('Skill command picker',function(){
 afterEach(function(){sinon.restore()})
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
  render(<PluginCard plugin={{id:'card',command:'library',name:'Paper library',description:'Collect papers. Verify citations and organize a library.',enabled:true,sourceUrl:'https://github.com/example/library',commit:'a'.repeat(40),resourceCount:2,resourcePaths:['SKILL.md','references/check.md'],unsupportedFiles:[]}} busy={false} onToggle={onToggle} onRemove={onRemove}/>)
  expect(screen.getByText('Collect papers.')).to.exist
  expect(screen.queryByRole('button',{name:'Use /library'})).to.equal(null)
  fireEvent.click(screen.getByRole('switch',{name:'Enable library'}));expect(onToggle.calledOnceWithExactly(false)).to.equal(true)
  fireEvent.click(screen.getByText('Details & usage'))
  expect(screen.getByText(/not a fixed action/)).to.exist
  fireEvent.click(screen.getByRole('button',{name:'Remove library'}));expect(onRemove.calledOnce).to.equal(true)
 })
})
