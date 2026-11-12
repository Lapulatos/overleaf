import { formatGitDate } from '@/features/source-control/format-date'
import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import LocalRecoveryCopies from '@/features/ide-react/components/modals/local-recovery-copies'
import { saveLocalRecovery, listLocalRecovery } from '@/features/ide-react/editor/local-recovery'

describe('local recovery copy access', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { cleanup(); localStorage.clear() })
  it('makes text available after unmount/remount without applying it to a project', () => {
    const entry = saveLocalRecovery(localStorage, { userId: 'a', workspaceId: 'w', epoch: 2, content: 'offline text' })
    const first = render(<LocalRecoveryCopies userId="a" workspaceId="w" revision={0} />)
    first.unmount()
    render(<LocalRecoveryCopies userId="a" workspaceId="w" revision={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Local recovery copies (1)' }))
    fireEvent.click(screen.getByRole('button', { name: `${formatGitDate(entry.createdAt)} · version 2` }))
    expect((screen.getByRole('textbox', { name: 'Saved local recovery text' }) as HTMLTextAreaElement).value).to.equal('offline text')
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }))
    expect(listLocalRecovery(localStorage, 'a', 'w')).to.have.length(1)
  })
  it('does not expose another account or workspace copies', () => {
    saveLocalRecovery(localStorage, { userId: 'a', workspaceId: 'w', epoch: 2, content: 'private' })
    const view = render(<LocalRecoveryCopies userId="b" workspaceId="w" revision={0} />)
    expect(screen.queryByRole('button')).to.equal(null)
    view.rerender(<LocalRecoveryCopies userId="a" workspaceId="different" revision={0} />)
    expect(screen.queryByRole('button')).to.equal(null)
  })
  it('selects recovered content by document ID even when names match', () => {
    const entry = saveLocalRecovery(localStorage, { userId: 'a', workspaceId: 'w', epoch: 2, content: 'summary', documents: [
      { docId: 'old', name: 'main.tex', version: 7, epoch: 2, content: 'old pending text' },
      { docId: 'new', name: 'main.tex', version: 0, epoch: 2, content: 'new file text' },
    ] })
    render(<LocalRecoveryCopies userId="a" workspaceId="w" revision={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Local recovery copies (1)' }))
    fireEvent.click(screen.getByRole('button', { name: `${formatGitDate(entry.createdAt)} · version 2` }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Recovered document' }), { target: { value: 'old' } })
    expect((screen.getByRole('textbox', { name: 'Saved local recovery text' }) as HTMLTextAreaElement).value).to.equal('old pending text')
    fireEvent.change(screen.getByRole('combobox', { name: 'Recovered document' }), { target: { value: 'new' } })
    expect((screen.getByRole('textbox', { name: 'Saved local recovery text' }) as HTMLTextAreaElement).value).to.equal('new file text')
  })

})
