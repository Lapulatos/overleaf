import {expect} from 'chai'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import sinon from 'sinon'
import {fitPreviewScale,PreviewZoom} from '@/features/source-control/preview-zoom'
describe('Image and PDF preview zoom',()=>{
 afterEach(cleanup)
 it('fits both dimensions for tall and wide content',()=>{
  expect(fitPreviewScale({width:1000,height:2000},{width:800,height:600})).to.equal(576/2000)
  expect(fitPreviewScale({width:2000,height:500},{width:800,height:600})).to.equal(776/2000)
 })
 it('offers zoom, actual size and restore fit',()=>{
  const change=sinon.spy();render(<PreviewZoom zoom="fit" scale={.5} onChange={change}/>)
  fireEvent.click(screen.getByRole('button',{name:'Zoom in'}));expect(change.lastCall.args[0]).to.equal(.625)
  fireEvent.click(screen.getByRole('button',{name:'Zoom out'}));expect(change.lastCall.args[0]).to.equal(.4)
  fireEvent.click(screen.getByRole('button',{name:'Actual size (100%)'}));expect(change.lastCall.args[0]).to.equal(1)
  fireEvent.click(screen.getByRole('button',{name:'Fit to window'}));expect(change.lastCall.args[0]).to.equal('fit')
 })
})
