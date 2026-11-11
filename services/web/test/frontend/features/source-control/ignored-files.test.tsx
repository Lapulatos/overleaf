import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import sinon from 'sinon'
import IgnoredFiles from '@/features/source-control/ignored-files'

describe('Ignored native files', () => {
  afterEach(cleanup)
  it('filters paths and only stages the explicitly selected file', () => {
    const onStage = sinon.stub(), onRefresh = sinon.stub()
    render(<IgnoredFiles paths={['draft.aux', 'paper.log']} busy={false} error="" onStage={onStage} onRefresh={onRefresh} onClose={() => {}} />)
    expect(onStage.callCount).to.equal(0)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'DRAFT' } })
    expect(screen.queryByText('paper.log')).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'Stage ignored file draft.aux' }))
    expect(onStage).calledOnceWithExactly('draft.aux')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).calledOnce
  })
})
