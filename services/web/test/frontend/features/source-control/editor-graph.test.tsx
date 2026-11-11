import { expect } from 'chai'
import sinon from 'sinon'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import EditorGraph from '@/features/source-control/editor-graph'
const commit = { hash: 'a'.repeat(40), parents: ['b'.repeat(40)], author: 'Author', email: 'a@example.test', date: '2026-11-10', subject: 'Subject', refs: '' }
const details = { ...commit, committer: 'Committer', committerEmail: 'c@example.test', authorDate: '2026-11-09', message: 'Subject\n\nFull body', parent: commit.parents[0], insertions: 2, deletions: 1, files: [{ path: 'tex/main.tex', status: 'M', insertions: 2, deletions: 1 }] }
describe('Editor Git Graph', () => {
  beforeEach(() => { const host = document.createElement('div'); host.id = 'native-git-editor-diff-host'; document.body.append(host) })
  afterEach(() => { cleanup(); document.getElementById('native-git-editor-diff-host')?.remove() })
  it('shows native details, navigates parent and opens clickable files in tree or list', async () => {
    const command = sinon.stub().resolves({ result: details }), onFile = sinon.spy()
    command.withArgs(sinon.match({ command: 'graphSettings' })).resolves({ result: {} })
    command.withArgs(sinon.match({ command: 'graph' })).resolves({ result: [commit] })
    render(<EditorGraph api={{ command, status: sinon.stub(), initialize: sinon.stub() }} commits={[commit]} branches={[]} currentRef="HEAD" busy={false} hidden={false} webRemotes={[]} onClose={() => {}} onRefresh={() => {}} onFile={onFile} />)
    fireEvent.click(await screen.findByRole('button', { name: /Subject/ }))
    await screen.findByText('Committer <c@example.test>')
    expect(screen.getByText(/Full body/)).to.exist
    expect(document.querySelector('.native-git-detail-files .native-git-file-folder')).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'View files as List' }))
    expect(document.querySelector('.native-git-detail-files .native-git-file-folder')).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'View diff tex/main.tex' }))
    expect(onFile.firstCall.args[0].hash).to.equal(commit.hash)
    expect(onFile.firstCall.args[1].path).to.equal('tex/main.tex')
    fireEvent.click(screen.getByRole('button', { name: commit.parents[0] }))
    await waitFor(() => expect(command).to.have.been.calledWith(sinon.match({ command: 'commitDetails', ref: commit.parents[0] })))
  })
  it('does not let a late detail response replace the latest selection', async () => {
    let finish!: (result: unknown) => void
    const command = sinon.stub(); command.withArgs(sinon.match({ command: 'graphSettings' })).resolves({ result: {} }); command.withArgs(sinon.match({ command: 'graph' })).resolves({ result: [commit, { ...commit, hash: 'c'.repeat(40), subject: 'Latest' }] }); const selected = command.withArgs(sinon.match({ command: 'commitDetails' })); selected.onFirstCall().returns(new Promise(resolve => { finish = resolve })); selected.onSecondCall().resolves({ result: { ...details, hash: 'c'.repeat(40), message: 'Latest details' } })
    render(<EditorGraph api={{ command, status: sinon.stub(), initialize: sinon.stub() }} commits={[commit, { ...commit, hash: 'c'.repeat(40), subject: 'Latest' }]} branches={[]} currentRef="HEAD" busy={false} hidden={false} webRemotes={[]} onClose={() => {}} onRefresh={() => {}} onFile={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /Subject/ })); fireEvent.click(screen.getByRole('button', { name: /Latest/ }))
    await screen.findByText('Latest details');
    const row = screen.getByRole('button', { name: /Latest/ });
    expect(row.nextElementSibling?.querySelector('[aria-label="Commit details"]')).to.exist
    expect(document.querySelectorAll('.native-git-inline-details')).to.have.length(1)
    finish({ result: details }); await Promise.resolve()
    expect(screen.queryByText(/Full body/)).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: /Latest/ }))
    expect(document.querySelector('.native-git-inline-details')).to.equal(null)
  })
})
