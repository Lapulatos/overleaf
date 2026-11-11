import { expect } from 'chai'
import { sectionLayout } from '@/features/source-control/section-layout'

describe('Source Control section layout', () => {
  it('gives collapsed section space to visible content rather than a blank spacer', () => {
    expect(sectionLayout([20,45,35,0], 2, null, 4)).to.deep.equal([20,76,4,0])
    expect(sectionLayout([20,76,4,0], 2, 35, 4)).to.deep.equal([20,45,35,0])
  })
  it('allows all sections to collapse and gives the reopened graph all remaining space', () => {
    let layout = [20,45,35,0]
    for (const index of [0,1,2]) layout = sectionLayout(layout,index,null,4)
    expect(layout).to.deep.equal([4,4,4,88])
    expect(sectionLayout(layout,2,35,4)).to.deep.equal([4,4,92,0])
  })
  it('recovers leftover spacer space on reopening without collapsing another heading', () => {
    const layout = sectionLayout([20,35,4,41],2,35,4)
    expect(layout).to.deep.equal([20,35,45,0])
    expect(layout.reduce((a,b)=>a+b)).to.equal(100)
  })
})
