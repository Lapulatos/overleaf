import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import ResetDialog from '@/features/source-control/reset-dialog'

describe('Native reset chooser', () => {
  afterEach(cleanup)
  it('requires a selected preview and explicit hard discard; search clears the selected target', async () => {
    const preview = { target: 'a'.repeat(40), head: 'b'.repeat(40), branch: 'main', fingerprint: 'c'.repeat(64), changes: 'paper.tex | 1 +', untracked: ['draft.tex'] }
    const onPreview = sinon.stub().resolves(preview), onReset = sinon.stub()
    render(<ResetDialog commits={[{ hash: preview.target, parents: [], subject: 'Older title', author: 'Alice', email: '', date: '2026-11-10', refs: 'main' }]} busy={false} error="" onPreview={onPreview} onReset={onReset} onClose={() => {}} />)
    const submit = screen.getByRole('button', { name: 'Reset branch' }) as HTMLButtonElement
    expect(submit.disabled).to.equal(true)
    fireEvent.click(screen.getByRole('radio', { name: /Older title/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview reset' }))
    await screen.findByText('Untracked files: draft.tex')
    expect(onPreview).calledOnceWithExactly(preview.target)
    fireEvent.click(screen.getByRole('radio', { name: /Hard — discard/ }))
    expect(submit.disabled).to.equal(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Discard changes/ }))
    fireEvent.click(submit)
    expect(onReset).calledOnceWithExactly(preview, 'hard')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } })
    await waitFor(() => expect(submit.disabled).to.equal(true))
    expect(screen.queryByText('Untracked files: draft.tex')).to.equal(null)
  })
})
