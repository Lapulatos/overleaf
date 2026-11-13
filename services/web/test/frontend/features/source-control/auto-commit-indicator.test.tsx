import {expect} from 'chai'
import {render,screen,cleanup} from '@testing-library/react'
import AutoCommitIndicator from '@/features/source-control/auto-commit-indicator'
describe('Automatic commit indicator',()=>{
 afterEach(cleanup)
 it('shows accessible hover text and disappears when disabled',()=>{
  const view=render(<AutoCommitIndicator policy={{enabled:true,state:'scheduled'}}/>)
  expect(screen.getByLabelText('Automatic commits').title).to.equal('Automatic commits')
  view.rerender(<AutoCommitIndicator policy={{enabled:false,state:'disabled'}}/>)
  expect(screen.queryByLabelText('Automatic commits')).to.equal(null)
 })
 it('distinguishes a paused schedule',()=>{
  render(<AutoCommitIndicator policy={{enabled:true,state:'paused'}}/>)
  expect(screen.getByLabelText('Automatic commits · Paused').title).to.include('Paused')
 })
})
