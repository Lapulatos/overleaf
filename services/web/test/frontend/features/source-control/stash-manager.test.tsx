import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import StashManager from '@/features/source-control/stash-manager'

const entries = [
  { hash: 'a'.repeat(40), message: 'Newest draft', author_name: 'Alice', date: '2026-11-09' },
  { hash: 'b'.repeat(40), message: 'Older draft', author_name: 'Bob', date: '2026-11-08' },
]
describe('Native stash management', () => {
  afterEach(cleanup)
  for (const pop of [false, true]) {
    it(`restores the selected entry with its exact hash using ${pop ? 'pop' : 'apply'}`, async () => {
      const command = sinon.stub().resolves({})
      const reload = sinon.stub().resolves()
      render(<StashManager entries={entries} command={command} reload={reload} busy={false} error="" onClose={() => {}} onPreview={() => {}} />)
      fireEvent.click(screen.getAllByRole('button', { name: pop ? 'Pop' : 'Apply' })[1])
      await waitFor(() => expect(reload).to.have.been.calledOnce)
      expect(command).to.have.been.calledOnceWithExactly({ command: 'applyStash', index: 1, expectedHash: entries[1].hash, pop })
      expect(screen.getByText(/Bob/)).to.exist
    })
  }
  it('previews the selected native patch and requires explicit confirmation before deletion', async () => {
    const preview = sinon.spy()
    const command = sinon.stub().resolves({ result: 'diff --git saved draft' })
    const reload = sinon.stub().resolves()
    render(<StashManager entries={entries} command={command} reload={reload} busy={false} error="" onClose={() => {}} onPreview={preview} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'View changes' })[1])
    await waitFor(() => expect(preview).to.have.been.calledOnceWithExactly('Older draft', 'diff --git saved draft'))
    expect(screen.queryByText('diff --git saved draft')).to.equal(null)
    expect(command.firstCall.args[0]).to.deep.equal({ command: 'stashDiff', index: 1, expectedHash: entries[1].hash })
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete…' })[1])
    expect(command.callCount).to.equal(1)
    expect(screen.getByText(/Delete “Older draft”/)).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Delete stash' }))
    await waitFor(() => expect(reload).to.have.been.calledOnce)
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'dropStash', index: 1, expectedHash: entries[1].hash })
  })
  it('allows closing the list while a Git request is pending', () => {
    const close = sinon.spy()
    render(<StashManager entries={entries} command={sinon.stub()} reload={sinon.stub()} busy error="" onClose={close} onPreview={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(close).to.have.been.calledOnce
  })
  it('does not reopen a preview or reload after closing during a pending request', async () => {
    let finish!: (result: object) => void
    const command = sinon.stub().returns(new Promise(resolve => { finish = resolve }))
    const reload = sinon.stub().resolves()
    const preview = sinon.spy()
    const view = render(<StashManager entries={entries} command={command} reload={reload} busy={false} error="" onClose={() => {}} onPreview={preview} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'View changes' })[0])
    view.unmount()
    finish({ result: 'late patch' })
    await Promise.resolve()
    expect(preview).not.to.have.been.called
    expect(reload).not.to.have.been.called
  })
  it('keeps the list on failed restore and offers refresh without retrying', async () => {
    const command = sinon.stub().resolves(undefined)
    const reload = sinon.stub().resolves()
    render(<StashManager entries={entries} command={command} reload={reload} busy={false} error="The stash list changed." onClose={() => {}} onPreview={() => {}} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Apply' })[0])
    await waitFor(() => expect(command).to.have.been.calledOnce)
    expect(reload).not.to.have.been.called
    expect(screen.getByRole('alert').textContent).to.equal('The stash list changed.')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh stashes' }))
    await waitFor(() => expect(reload).to.have.been.calledOnce)
  })
})
