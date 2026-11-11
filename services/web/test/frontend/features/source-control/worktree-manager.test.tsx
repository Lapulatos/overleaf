import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import WorktreeManager, { type WorktreeEntry } from '@/features/source-control/worktree-manager'
const entry = (branch: string, cleanupBlocked: string | null): WorktreeEntry => ({
  id: branch, head: 'a'.repeat(40), branch, cleanupBlocked, detached: false, current: branch === 'main', main: branch === 'main', locked: false, changedFiles: cleanupBlocked ? 1 : 0,
})
describe('Native worktree management', () => {
  afterEach(cleanup)
  it('disables cleanup for protected workspaces and confirms the exact clean branch', async () => {
    const entries = [entry('main', 'Current workspace'), entry('draft', 'Contains uncommitted or ignored files'), entry('clean', null)]
    const clean = sinon.stub().resolves(true)
    render(<WorktreeManager entries={entries} busy={false} error="" reload={() => {}} clean={clean} onClose={() => {}} />)
    const buttons = screen.getAllByRole('button', { name: 'Clean up workspace…' }) as HTMLButtonElement[]
    expect(buttons.map(button => button.disabled)).to.deep.equal([true, true, false])
    fireEvent.click(buttons[2])
    expect(clean).not.to.have.been.called
    expect(screen.getByText(/Remove the clean workspace for clean/)).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Clean up workspace' }))
    await waitFor(() => expect(clean).to.have.been.calledOnceWithExactly(entries[2]))
    await waitFor(() => expect(screen.queryByText(/Remove the clean workspace for clean/)).to.equal(null))
  })
  it('retains confirmation on failure and allows a fresh inventory without retrying cleanup', async () => {
    const clean = sinon.stub().resolves(false)
    const reload = sinon.spy()
    render(<WorktreeManager entries={[entry('draft', null)]} busy={false} error="The worktree changed." reload={reload} clean={clean} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clean up workspace…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean up workspace' }))
    await waitFor(() => expect(clean).to.have.been.calledOnce)
    expect(screen.getByRole('alert').textContent).to.equal('The worktree changed.')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh worktrees' }))
    expect(reload).to.have.been.calledOnce
    expect(clean).to.have.been.calledOnce
  })
})
