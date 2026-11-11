import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import sinon from 'sinon'
import ConflictEditor, { type ConflictDetails } from '@/features/source-control/conflict-editor'

const details: ConflictDetails = {
  path: 'paper.tex', fingerprint: 'a'.repeat(64), operation: 'merge',
  versions: { base: { kind: 'text', text: 'Base' }, current: { kind: 'text', text: 'Current text' }, incoming: { kind: 'text', text: 'Incoming text' } },
  working: { kind: 'text', text: '<<<<<<< HEAD\nCurrent text\n=======\nIncoming text\n>>>>>>> topic' },
}
describe('Native conflict editor', () => {
  afterEach(cleanup)
  it('submits the explicitly edited result without changing the selected side', () => {
    const resolve = sinon.spy()
    render(<ConflictEditor details={details} busy={false} error="" onResolve={resolve} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Merged result'), { target: { value: 'Combined result\n' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save result & stage' }))
    expect(resolve).to.have.been.calledOnceWithExactly('edited', 'Combined result\n')
  })
  it('makes incoming deletion explicit and does not expose a lossy binary text editor', () => {
    const resolve = sinon.spy()
    render(<ConflictEditor details={{ ...details, working: { kind: 'binary', text: null }, versions: { ...details.versions, incoming: { kind: 'deleted', text: null } } }} busy={false} error="" onResolve={resolve} onClose={() => {}} />)
    expect(screen.queryByLabelText('Merged result')).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'Accept incoming deletion & stage' }))
    expect(resolve).to.have.been.calledOnceWithExactly('incoming')
  })
  it('explains native rebase sides and retains the result on a stale-file error', () => {
    const { rerender } = render(<ConflictEditor details={{ ...details, operation: 'rebase' }} busy={false} error="" onResolve={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Merged result'), { target: { value: 'My draft' } })
    rerender(<ConflictEditor details={{ ...details, operation: 'rebase' }} busy={false} error="The conflicted file changed." onResolve={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/During rebase/)).to.exist
    expect(screen.getByRole('alert').textContent).to.equal('The conflicted file changed.')
    expect((screen.getByLabelText('Merged result') as HTMLTextAreaElement).value).to.equal('My draft')
  })
})
