import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import sinon from 'sinon'
import MergeBranchPicker from '@/features/source-control/merge-branch-picker'
import type { GitBranch } from '@/features/source-control/types'
const branch = (name: string, author: string, subject: string): GitBranch => ({
  ref: 'refs/heads/' + name, name, author, subject, email: 'test@example.test', date: '2026-11-09T00:00:00Z',
  commit: 'a'.repeat(40), remote: false, upstream: null,
})
const branches = [branch('repo-test', 'Owner', 'Target'), branch('feature-c', 'Alice', 'Add c test'), branch('feature-a', 'Bob', 'Introduction')]
describe('Merge branch selection', () => {
  afterEach(cleanup)
  it('filters by author and commit subject, excludes target, and requires an explicit selection', () => {
    const merge = sinon.spy()
    render(<MergeBranchPicker branches={branches} target="repo-test" busy={false} error="" onMerge={merge} onClose={() => {}} />)
    expect(screen.getAllByRole('radio')).to.have.length(2)
    expect((screen.getByRole('button', { name: 'Merge into repo-test' }) as HTMLButtonElement).disabled).to.equal(true)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'alice' } })
    expect(screen.getAllByRole('radio')).to.have.length(1)
    fireEvent.click(screen.getByRole('radio'))
    expect(screen.getByText('feature-c → repo-test')).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Merge into repo-test' }))
    expect(merge).to.have.been.calledOnceWithExactly('refs/heads/feature-c')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Introduction' } })
    expect(screen.getByText('feature-a')).to.exist
    expect((screen.getByRole('button', { name: 'Merge into repo-test' }) as HTMLButtonElement).disabled).to.equal(true)
  })
  it('keeps the selection on an operation error and offers no phantom empty search result', () => {
    const { rerender } = render(<MergeBranchPicker branches={branches} target="repo-test" busy={false} error="" onMerge={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getAllByRole('radio')[0])
    rerender(<MergeBranchPicker branches={branches} target="repo-test" busy={false} error="Target changed" onMerge={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('alert').textContent).to.equal('Target changed')
    expect((screen.getAllByRole('radio')[0] as HTMLInputElement).checked).to.equal(true)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing-source' } })
    expect(screen.getByText('No matching branches.')).to.exist
    expect(screen.queryAllByRole('radio')).to.have.length(0)
  })
})
