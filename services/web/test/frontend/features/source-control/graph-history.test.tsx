import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import GraphHistory from '@/features/source-control/graph-history'
import CommitGraph from '@/features/source-control/commit-graph'
import type { GitCommit, GitBranch } from '@/features/source-control/types'

const commit = (hash: string): GitCommit => ({ hash, parents: [], subject: `Message ${hash}`, author: 'Alice', email: 'alice@example.test', date: '2026-11-09', refs: '' })
const branches: GitBranch[] = [{ ref: 'refs/heads/topic', name: 'topic', commit: 'tip', upstream: null, author: 'Alice', email: '', date: '', subject: '', remote: false }]
describe('Native graph history navigation', () => {
  afterEach(cleanup)
  it('keeps full branch labels and checks out only on double-click', () => {
    const branch = { ...branches[0], name: 'feature/a-long-branch-name', ref: 'refs/heads/feature/a-long-branch-name' }
    const checkout = sinon.spy(), select = sinon.spy()
    render(<CommitGraph detailed branches={[branch]} onCheckout={checkout} commits={[{ ...commit('tip'), refs: `HEAD -> ${branch.name}` }]} onSelect={select} busy={false} />)
    const label = screen.getByText(branch.name)
    fireEvent.click(label); expect(checkout).not.to.have.been.called
    fireEvent.doubleClick(label); expect(checkout).to.have.been.calledOnceWithExactly(branch)
    expect(select).not.to.have.been.called
  })
  it('filters branches inline and applies the selected branch without a modal', async () => {
    const command = sinon.stub().resolves({ result: [commit('tip')] })
    render(<GraphHistory inlineToolbar api={{ command, status: sinon.stub(), initialize: sinon.stub() }} commits={[commit('tip')]} branches={branches} onSelect={() => {}} busy={false} />)
    const input = screen.getByRole('searchbox', { name: 'Search branches and commits' })
    fireEvent.focus(input); fireEvent.change(input, { target: { value: 'top' } })
    expect(screen.queryByRole('dialog')).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: /topic.*View branch/ }))
    await waitFor(() => expect(command).to.have.been.calledWith(sinon.match({ command: 'graph', ref: 'refs/heads/topic' })))
    expect(screen.queryByRole('listbox')).to.equal(null)
    expect((input as HTMLInputElement).value).to.equal('')
  })
  it('dismisses a commit hover card when its history rows are replaced', async () => {
    const view = render(<CommitGraph commits={[commit('removed')]} onSelect={() => {}} busy={false} />)
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Message removed/ }))
    await screen.findByRole('button', { name: 'Copy commit ID' })
    view.rerender(<CommitGraph commits={[commit('replacement')]} onSelect={() => {}} busy={false} />)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Copy commit ID' })).to.equal(null))
    expect(screen.getByText('Message replacement')).to.exist
  })
  it('dismisses hover cards when a scrolling ancestor moves or the window resizes', async () => {
    const view = render(<div data-testid="scroll-container"><CommitGraph commits={[commit('tip')]} onSelect={() => {}} busy={false} /></div>)
    for (const action of [() => fireEvent.scroll(view.getByTestId('scroll-container')), () => fireEvent.resize(window)]) {
      fireEvent.mouseEnter(screen.getByRole('button', { name: /Message tip/ }))
      await screen.findByRole('button', { name: 'Copy commit ID' })
      action()
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Copy commit ID' })).to.equal(null))
    }
  })
  it('offers provider links for the hovered commit and names multiple remotes', async () => {
    const hash = '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d'
    render(<CommitGraph commits={[commit(hash)]} onSelect={() => {}} busy={false} webRemotes={[
      { name: 'origin', provider: 'GitHub', commitBaseUrl: 'https://github.com/octocat/Hello-World/commit/' },
      { name: 'upstream', provider: 'Gitee', commitBaseUrl: 'https://gitee.com/team/project/commit/' },
    ]} />)
    fireEvent.mouseEnter(screen.getByRole('button', { name: new RegExp(`Message ${hash}`) }))
    const link = await screen.findByRole('link', { name: 'Open on GitHub (origin)' })
    expect(link.getAttribute('href')).to.equal(`https://github.com/octocat/Hello-World/commit/${hash}`)
    expect(link.getAttribute('rel')).to.equal('noopener noreferrer')
    expect(screen.getByRole('link', { name: 'Open on Gitee (upstream)' }).getAttribute('href')).to.equal(`https://gitee.com/team/project/commit/${hash}`)
  })
  it('searches native history beyond loaded rows and restores the snapshot when cleared', async () => {
    let finish!: (value: object) => void
    const command = sinon.stub().returns(new Promise(resolve => { finish = resolve }))
    render(<GraphHistory api={{ command, status: sinon.stub(), initialize: sinon.stub() }} commits={[commit('recent')]} branches={branches} onSelect={() => {}} busy={false} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search branches and commits' }), { target: { value: 'older' } })
    await waitFor(() => expect(command).to.have.been.calledOnceWithExactly({ command: 'graph', query: 'older', limit: 100, skip: 0 }))
    finish({ result: [commit('older')] })
    await screen.findByText('Message older')
    expect(screen.queryByText('Message recent')).to.equal(null)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search branches and commits' }), { target: { value: '' } })
    await screen.findByText('Message recent')
    expect(screen.queryByText('Message older')).to.equal(null)
  })
  it('loads older native commits beyond the initial snapshot without dropping existing rows', async () => {
    const initial = Array.from({ length: 100 }, (_, i) => commit(String(i)))
    const command = sinon.stub().resolves({ result: [commit('older')] })
    render(<GraphHistory api={{ command, status: sinon.stub(), initialize: sinon.stub() }} commits={initial} branches={branches} onSelect={() => {}} busy={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier commits' }))
    await screen.findByText('Message older')
    expect(screen.getByText('Message 0')).to.exist
    expect(command).to.have.been.calledOnceWithExactly({ command: 'graph', limit: 100, skip: 100 })
    expect(screen.queryByRole('button', { name: 'Load earlier commits' })).to.equal(null)
  })
  it('filters by native branch ancestry and ignores a late response after switching back to all', async () => {
    let finish!: (value: object) => void
    const command = sinon.stub().returns(new Promise(resolve => { finish = resolve }))
    render(<GraphHistory api={{ command, status: sinon.stub(), initialize: sinon.stub() }} commits={[commit('all')]} branches={branches} onSelect={() => {}} busy={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select history references' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /topic/ }))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(command).to.have.been.calledOnceWithExactly({ command: 'graph', refs: ['refs/heads/topic'], limit: 100, skip: 0 }))
    fireEvent.click(screen.getByRole('button', { name: 'Select history references' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /All —/ }))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    finish({ result: [commit('stale')] })
    await Promise.resolve()
    expect(screen.getByText('Message all')).to.exist
    expect(screen.queryByText('Message stale')).to.equal(null)
  })
  it('offers tree/list views and calls the existing remote and refresh actions', () => {
    const onFetchAll = sinon.spy(), onPull = sinon.spy(), onPublish = sinon.spy(), onRefresh = sinon.spy()
    render(<GraphHistory api={{ command: sinon.stub().resolves({ result: [] }), status: sinon.stub(), initialize: sinon.stub() }} commits={[commit('tip')]} branches={branches} onSelect={() => {}} busy={false}
      onFetchAll={onFetchAll} onPull={onPull} onPublish={onPublish} onRefresh={onRefresh} expanded={{ tip: true }} details={{ tip: { files: [{ path: 'tex/sections/main.tex', status: 'M' }], parent: null, insertions: 1, deletions: 0 } }} />)
    expect(document.querySelectorAll('.native-git-file-folder')).to.have.length(2)
    fireEvent.click(screen.getByRole('button', { name: 'View as List' }))
    expect(document.querySelectorAll('.native-git-file-folder')).to.have.length(0)
    expect(screen.getByRole('button', { name: 'tex/sections/main.tex at tip' })).to.exist
    for (const name of ['Fetch From All Remotes', 'Pull', 'Publish Branch', 'Refresh']) fireEvent.click(screen.getByRole('button', { name }))
    for (const action of [onFetchAll, onPull, onPublish, onRefresh]) expect(action).to.have.been.calledOnce
  })

  it('locates the current native tip even when it is absent from displayed history', async () => {
    const original = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = sinon.spy()
    try {
      const command = sinon.stub().resolves({ result: [commit('tip')] })
      render(<GraphHistory currentRef="refs/heads/topic" api={{ command, status: sinon.stub(), initialize: sinon.stub() }} commits={[commit('other')]} branches={branches} onSelect={() => {}} busy={false} />)
      fireEvent.click(screen.getByRole('button', { name: 'Go to Current History Item' }))
      await waitFor(() => expect(document.activeElement?.getAttribute('data-commit')).to.equal('tip'))
      expect(command).to.have.been.calledWith({ command: 'graph', ref: 'refs/heads/topic', limit: 100, skip: 0 })
    } finally { HTMLElement.prototype.scrollIntoView = original }
  })

})
