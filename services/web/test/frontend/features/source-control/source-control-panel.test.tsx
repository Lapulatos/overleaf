import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import sinon from 'sinon'
import { SourceControlView } from '@/features/source-control/source-control-panel'
import { graphRows } from '@/features/source-control/commit-graph'
import type { GitSnapshot, GitCommit } from '@/features/source-control/types'

const commit = (hash: string, parents: string[], subject = hash): GitCommit => ({ hash, parents, subject, author: 'Alice', email: 'a@example.test', date: '2026-11-09T00:00:00Z', refs: '' })
function state(): GitSnapshot {
  return { connected: true, branches: [], graph: [commit('old', [], 'Original manuscript')],
    status: { branch: 'B', detached: false, upstream: null, ahead: 0, behind: 0, conflicted: [],
      files: [{ path: 'frontmatter.tex', index: ' ', workingTree: 'M' }, { path: 'methods.tex', index: ' ', workingTree: 'M' }] } }
}
describe('Native Source Control panel', () => {
  beforeEach(() => { const host = document.createElement('div'); host.id = 'native-git-editor-diff-host'; document.body.append(host) })
  afterEach(() => { cleanup(); document.getElementById('native-git-editor-diff-host')?.remove() })
  it('opens shared review after collaborative Pull instead of applying files', async () => {
    const snapshot = { ...state(), collaboration: { drafts: true, apply: true } }
    const task = { id: 'pull-task', revision: 1, state: 'conflicted', sourceRef: 'refs/remotes/origin/B', targetBranch: 'B', remainingPaths: ['main.tex'], leaseGeneration: 0 }
    const command = sinon.stub().callsFake(async body => body.command === 'pull'
      ? { ...snapshot, result: task, reviewRequired: true }
      : { result: body.command === 'mergeDraftGet' ? task : body.command === 'mergeDraftList' ? [task] : [] })
    render(<SourceControlView api={{ status: sinon.stub().resolves(snapshot), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Repository actions' }))
    fireEvent.click(screen.getByText('Pull…'))
    const dialog = await screen.findByRole('dialog', { name: 'Pull', exact: true })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fetch and review' }))
    const review = await screen.findByRole('dialog', { name: 'Shared merge tasks' })
    await waitFor(() => expect((within(review).getByRole('combobox', { name: 'Task' }) as HTMLSelectElement).value).to.equal(task.id))
    const request = command.getCalls().find(c => c.args[0].command === 'pull')!.args[0]
    expect(request).to.include({ remote: 'origin', branch: 'B' })
    expect(request.operationId).to.match(/^[a-f0-9-]{36}$/)
    expect(command.getCalls().some(c => c.args[0].command === 'mergeDraftApply')).to.equal(false)
  })
  it('opens pending merge recovery instead of retrying a legacy branch transfer', async () => {
    const snapshot = { ...state(), switching: true, mutationTaskId: 'task', collaboration: { drafts: true, apply: true } }
    const task = { id: 'task', state: 'recovery-required', revision: 1, sourceRef: 'source', targetBranch: 'main', remainingPaths: [], leaseGeneration: 0 }
    const command = sinon.stub().callsFake(async body => ({ result: body.command === 'remoteDiscoveryList' ? [] : [task] }))
    render(<SourceControlView api={{ status: sinon.stub().resolves(snapshot), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Review interrupted merge' }))
    const dialog = await screen.findByRole('dialog', { name: 'Shared merge tasks' })
    await within(dialog).findByRole('button', { name: 'Review recovery' })
    expect(command.args.some(([body]) => body.command === 'resumeTransfer')).to.equal(false)
  })
  it('confirms Undo initial commit and dispatches the guarded undo operation',async()=>{
    const command=sinon.stub().callsFake(async body=>body.command==='undoDetails'?{result:{target:null,head:'a'.repeat(40),branch:'main',fingerprint:'f'.repeat(64)}}:state())
    render(<SourceControlView api={{status:sinon.stub().resolves(state()),initialize:sinon.stub(),command}}/>)
    fireEvent.click(await screen.findByRole('button',{name:'Repository actions'}))
    fireEvent.click(screen.getByRole('button',{name:'Commit submenu'}))
    fireEvent.click(screen.getByText('Undo Last Commit'))
    await screen.findByText(/an unborn branch/)
    expect(command.callCount).to.equal(1)
    fireEvent.click(screen.getByRole('button',{name:'Undo commit'}))
    await waitFor(()=>expect(command).to.have.been.calledWith({command:'undoCommit',fingerprint:'f'.repeat(64)}))
  })
  it('clones a URL into a separate paper project and offers its link', async () => {
    const command = sinon.stub().resolves({ result: { projectId: 'new-project', url: '/project/new-project' } })
    render(<SourceControlView api={{status:sinon.stub().resolves(state()),initialize:sinon.stub(),command}} />)
    fireEvent.click(await screen.findByRole('button',{name:'Repository actions'}))
    fireEvent.click(screen.getByText('Clone…'))
    const dialog = await screen.findByRole('dialog',{name:'Clone repository'})
    expect(within(dialog).queryByRole('combobox')).to.equal(null)
    fireEvent.change(within(dialog).getByRole('textbox',{name:'Repository URL'}),{target:{value:'https://example.test/paper.git'}})
    fireEvent.change(within(dialog).getByRole('textbox',{name:'Project name'}),{target:{value:'Independent paper'}})
    expect(command.callCount).to.equal(0)
    fireEvent.click(within(dialog).getByRole('button',{name:'Clone',exact:true}))
    const link = await screen.findByRole('link',{name:'Open cloned project'})
    expect(link.getAttribute('href')).to.equal('/project/new-project')
    expect(command.firstCall.args[0]).to.include({command:'clone',url:'https://example.test/paper.git',name:'Independent paper'})
    expect(command.firstCall.args[0]).not.to.have.property('destination')
  })
  it('commits all with sign-off through the shared menu after explicit confirmation', async () => {
    const command = sinon.stub().resolves(state())
    render(<SourceControlView api={{status:sinon.stub().resolves(state()),initialize:sinon.stub(),command}} />)
    fireEvent.click(await screen.findByRole('button',{name:'Repository actions'}))
    fireEvent.click(screen.getByRole('button',{name:'Commit submenu'}))
    fireEvent.click(screen.getByText('Commit All (Signed Off)'))
    const dialog=await screen.findByRole('dialog',{name:'Commit all changes (Signed Off)'})
    expect(command.callCount).to.equal(0)
    fireEvent.change(within(dialog).getByRole('textbox',{name:'Commit message'}),{target:{value:'Complete evaluation'}})
    fireEvent.click(within(dialog).getByRole('button',{name:'Commit',exact:true}))
    await waitFor(()=>expect(command).to.have.been.calledWith({command:'commit',message:'Complete evaluation',all:true,amend:false,signoff:true}))
  })
  it('previews remote deletion and sends the captured hash only after confirmation', async () => {
    const hash='a'.repeat(40),command=sinon.stub().callsFake(async c=>c.command==='remoteRef'?{result:{hash,ref:'refs/heads/obsolete'}}:state())
    render(<SourceControlView api={{status:sinon.stub().resolves(state()),initialize:sinon.stub(),command}} />)
    fireEvent.click(await screen.findByRole('button',{name:'Repository actions'}))
    fireEvent.click(screen.getByRole('button',{name:'Branch submenu'}))
    fireEvent.click(screen.getByText('Delete Remote Branch…'))
    fireEvent.change(screen.getByRole('textbox',{name:'Branch name'}),{target:{value:'obsolete'}})
    fireEvent.click(screen.getByRole('button',{name:'Review deletion'}))
    await screen.findByRole('dialog',{name:'Confirm remote deletion'})
    expect(command.callCount).to.equal(1)
    fireEvent.click(screen.getByRole('button',{name:'Delete remote reference'}))
    await waitFor(()=>expect(command).to.have.been.calledWith({command:'deleteRemoteRef',kind:'branch',remote:'origin',name:'obsolete',expectedHash:hash}))
  })
  it('puts checked view and sort choices in the Changes submenu',async()=>{
    render(<SourceControlView api={{status:sinon.stub().resolves(state()),initialize:sinon.stub(),command:sinon.stub()}} />)
    fireEvent.click(await screen.findByRole('button',{name:'More changes actions'}))
    fireEvent.click(screen.getByRole('button',{name:'View & Sort submenu'}))
    const tree=await screen.findByRole('menuitemradio',{name:'View as List'})
    expect(tree.getAttribute('aria-checked')).to.equal('true')
    fireEvent.click(screen.getByRole('menuitemradio',{name:'Sort Changes by Name'}))
    fireEvent.click(screen.getByRole('button',{name:'More changes actions'}))
    fireEvent.click(screen.getByRole('button',{name:'View & Sort submenu'}))
    expect(screen.getByRole('menuitemradio',{name:'Sort Changes by Name'}).getAttribute('aria-checked')).to.equal('true')
  })
  it('shows the project name, publish launcher and hierarchical actions', async () => {
    const name = 'PYTHIA_Cybersecurity_OnlineLatex (5)'
    const api = { status: sinon.stub().resolves(state()), initialize: sinon.stub(), command: sinon.stub().resolves({ result: [] }) }
    render(<SourceControlView api={api} projectName={name} />)
    const title = await screen.findByText(name)
    expect(title.getAttribute('title')).to.equal(name)
    expect(document.querySelector('.native-git-repository-icon')).to.exist
    fireEvent.click(within(title.closest('.native-git-repository-row') as HTMLElement).getByRole('button', { name: 'Publish Branch', exact: true }))
    await screen.findByRole('dialog', { name: 'Publish branch' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Repository actions' }))
    for (const name of ['Commit','Changes','Pull, Push','Branch','Remote','Stash','Tags','Worktrees']) expect(screen.getByRole('button',{name:name+' submenu',exact:true}).getAttribute('aria-haspopup')).to.equal('menu')
    expect(screen.queryByText('Create branch…')).to.equal(null)
    fireEvent.mouseEnter(screen.getByRole('button',{name:'Branch submenu',exact:true}))
    const menu = await screen.findByRole('menu',{name:'Branch actions'})
    expect(menu.parentElement).to.equal(document.body)
    fireEvent.click(screen.getByText('Create branch…'))
    await screen.findByRole('dialog',{name:'Create new branch'})
    expect(screen.queryByRole('menu',{name:'Branch actions'})).to.equal(null)
  })
  it('closes Git Graph when leaving Source Control and keeps it closed on return', async () => {
    const api = { status: sinon.stub().resolves(state()), initialize: sinon.stub(), command: sinon.stub().resolves({ result: [] }) }
    const view = render(<SourceControlView api={api} active />)
    const launcher = await screen.findByRole('button', { name: 'View Git Graph' })
    fireEvent.click(launcher)
    const graph = await screen.findByRole('region', { name: 'Git Graph' })
    expect(launcher.querySelector('.native-git-graph-icon')?.outerHTML).to.equal(graph.querySelector('.native-git-editor-diff-tab .native-git-graph-icon')?.outerHTML)
    view.rerender(<SourceControlView api={api} active={false} />)
    expect(screen.queryByRole('region', { name: 'Git Graph' })).to.equal(null)
    view.rerender(<SourceControlView api={api} active />)
    expect(screen.queryByRole('region', { name: 'Git Graph' })).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'View Git Graph' }))
    await screen.findByRole('region', { name: 'Git Graph' })
  })
  it('expands commit files and opens a scoped side-by-side editor diff without a modal', async () => {
    const current = state()
    const command = sinon.stub()
    command.onFirstCall().resolves({ ...current, result: { files: [{ path: 'tex/frontmatter.tex', status: 'M' }], insertions: 1, deletions: 1, parent: null } })
    command.onSecondCall().resolves({ ...current, result: '--- a/tex/frontmatter.tex\n+++ b/tex/frontmatter.tex\n@@ -1 +1 @@\n-old title\n+new title\n' })
    render(<SourceControlView api={{ status: sinon.stub().resolves(current), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: /Original manuscript/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'tex/frontmatter.tex at old' }))
    await screen.findByRole('region', { name: 'Git diff' })
    expect(screen.queryByRole('dialog')).to.equal(null)
    expect(await screen.findByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'old title')).to.exist
    expect(screen.getByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'new title')).to.exist
    expect(command.firstCall.args[0]).to.deep.equal({ command: 'commitFiles', ref: 'old' })
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'commitFileDiff', ref: 'old', path: 'tex/frontmatter.tex' })
    fireEvent.click(screen.getByRole('button', { name: 'Close diff' }))
    expect(screen.queryByRole('region', { name: 'Git diff' })).to.equal(null)
  })
  it('switches the diff immediately, ignores late responses and caches committed files', async () => {
    const command = sinon.stub()
    command.onCall(0).resolves({ result: { files: [{ path: 'a.tex', status: 'M' }, { path: 'b.tex', status: 'M' }], insertions: 2, deletions: 2 } })
    let finishA!: (value: object) => void, finishB!: (value: object) => void
    command.onCall(1).returns(new Promise(resolve => { finishA = resolve }))
    command.onCall(2).returns(new Promise(resolve => { finishB = resolve }))
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: /Original manuscript/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'a.tex at old' }))
    expect(screen.getByRole('status').textContent).to.equal('Loading diff…')
    fireEvent.click(screen.getByRole('button', { name: 'b.tex at old' }))
    expect(document.querySelector('.native-git-editor-diff-tab')?.textContent).to.contain('b.tex')
    const patch = (text: string) => '--- a/file.tex\n+++ b/file.tex\n@@ -1 +1 @@\n-old\n+' + text + '\n'
    finishB({ result: patch('new B') })
    await screen.findByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'new B')
    finishA({ result: patch('new A') })
    await waitFor(() => expect(command.callCount).to.equal(3))
    expect(screen.queryByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'new A')).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'a.tex at old' }))
    await screen.findByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'new A')
    expect(command.callCount).to.equal(3)
    fireEvent.click(screen.getByRole('button', { name: 'Close diff' }))
    expect(screen.queryByRole('region', { name: 'Git diff' })).to.equal(null)
  })
  for (const staged of [false, true]) {
    it(`uses the shared image preview for ${staged ? 'staged' : 'working'} files`, async () => {
      const decode = Object.getOwnPropertyDescriptor(globalThis, 'atob')
      Object.defineProperty(globalThis, 'atob', { configurable: true, value: (value: string) => Buffer.from(value, 'base64').toString('binary') })
      const create = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
      const revoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:preview-fixture' })
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })
      try {
        const current = state()
        current.status!.files = [{ path: 'plot.png', index: staged ? 'A' : '?', workingTree: staged ? ' ' : '?' }]
        const command = sinon.stub().resolves({ ...current, result: { before: null, after: { mime: 'image/png', base64: 'AQID', size: 3 } } })
        render(<SourceControlView api={{ status: sinon.stub().resolves(current), initialize: sinon.stub(), command }} />)
        fireEvent.click(await screen.findByRole('button', { name: 'plot.png', exact: true }))
        expect(await screen.findByRole('img', { name: 'After: plot.png' })).to.exist
        expect(command.firstCall.args[0]).to.deep.equal({ command: 'filePreview', path: 'plot.png', staged })
        expect(screen.queryByText('Binary file changed. Text comparison is unavailable.')).to.equal(null)
      } finally {
        cleanup()
        if (decode) Object.defineProperty(globalThis, 'atob', decode)
        for (const [key, descriptor] of [['createObjectURL', create], ['revokeObjectURL', revoke]] as const) {
          if (descriptor) Object.defineProperty(URL, key, descriptor)
          else Reflect.deleteProperty(URL, key)
        }
      }
    })
  }
  it('opens the current project file through a separate graph action', async () => {
    const onOpenFile = sinon.stub().resolves()
    const command = sinon.stub().resolves({ result: { files: [{ path: 'tex/main.tex', status: 'M' }], insertions: 1, deletions: 1 } })
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} onOpenFile={onOpenFile} />)
    fireEvent.click(await screen.findByRole('button', { name: /Original manuscript/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open file tex/main.tex' }))
    await waitFor(() => expect(onOpenFile).to.have.been.calledOnceWithExactly('tex/main.tex'))
    expect(command.callCount).to.equal(1)
    expect(screen.queryByRole('region', { name: 'Git diff' })).to.equal(null)
  })
  it('opens stash changes in the editor and closes the stash dialog', async () => {
    const current = state()
    const command = sinon.stub()
    command.onFirstCall().resolves({ ...current, result: [{ hash: 's'.repeat(40), message: 'Saved manuscript', author_name: 'Alice', date: '2026-11-09' }] })
    command.onSecondCall().resolves({ ...current, result: '--- a/frontmatter.tex\n+++ b/frontmatter.tex\n@@ -1 +1 @@\n-old stash text\n+saved stash text\n' })
    render(<SourceControlView api={{ status: sinon.stub().resolves(current), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Repository actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stash submenu', exact: true }))
    fireEvent.click(await screen.findByText('Stashes…'))
    fireEvent.click(await screen.findByRole('button', { name: 'View changes' }))
    await screen.findByRole('region', { name: 'Git diff' })
    expect(screen.queryByRole('dialog')).to.equal(null)
    expect(screen.getByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'old stash text')).to.exist
    expect(screen.getByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'saved stash text')).to.exist
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'stashDiff', index: 0, expectedHash: 's'.repeat(40) })
  })
  it('closes merge selection when native Git reports conflicts and reveals conflict controls', async () => {
    const current = state()
    current.branches = [{ ref: 'refs/heads/C', name: 'C', commit: 'c'.repeat(40), upstream: null, author: 'Alice', email: 'a@example.test', date: '2026-11-09T00:00:00Z', subject: 'C changes', remote: false }]
    const conflicted = state(); conflicted.status!.operation = 'merge'; conflicted.status!.conflicted = ['frontmatter.tex']
    conflicted.status!.files[0] = { path: 'frontmatter.tex', index: 'U', workingTree: 'U' }
    const command = sinon.stub().rejects(new Error('Git found conflicts'))
    const status = sinon.stub().onFirstCall().resolves(current).onSecondCall().resolves(conflicted)
    render(<SourceControlView api={{ status, initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Repository actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Branch submenu', exact: true }))
    fireEvent.click(screen.getByText('Merge into current branch…'))
    fireEvent.click(screen.getByRole('radio'))
    fireEvent.click(screen.getByRole('button', { name: 'Merge into B' }))
    await screen.findByRole('button', { name: 'Resolve frontmatter.tex' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Merge branch' })).to.equal(null))
  })
  for (const [operation, menu] of [['rebase', 'Rebase onto…'], ['cherry-pick', 'Cherry-pick…'], ['revert', 'Revert commit…']] as const) {
    it(`closes the ${operation} launch dialog when native conflicts require recovery`, async () => {
      const current = state()
      const conflicted = state(); conflicted.status!.operation = operation; conflicted.status!.conflicted = ['frontmatter.tex']
      conflicted.status!.files[0] = { path: 'frontmatter.tex', index: 'U', workingTree: 'U' }
      const command = sinon.stub().rejects(new Error('Git found conflicts'))
      const status = sinon.stub().onFirstCall().resolves(current).onSecondCall().resolves(conflicted)
      render(<SourceControlView api={{ status, initialize: sinon.stub(), command }} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Repository actions' }))
      fireEvent.click(screen.getByRole('button', { name: operation === 'rebase' ? 'Branch submenu' : 'Commit submenu', exact: true }))
      fireEvent.click(screen.getByText(menu))
      fireEvent.change(screen.getByRole('textbox', { name: 'Branch, tag or commit' }), { target: { value: 'source' } })
      fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }))
      await screen.findByRole('button', { name: `Abort ${operation}` })
      await waitFor(() => expect(screen.queryByRole('dialog')).to.equal(null))
      expect(screen.getByRole('button', { name: 'Resolve frontmatter.tex' })).to.exist
    })
  }
  it('keeps first-parent lane color and distinguishes a merged branch', () => {
    const rows = graphRows([commit('merge', ['left', 'right']), commit('left', ['base']), commit('right', ['base']), commit('base', [])])
    expect(rows[0].color).to.equal(rows[1].color)
    expect(rows[1].color).not.to.equal(rows[2].color)
    expect(rows[3].color).to.equal(rows[1].color)
  })
  it('amends explicitly with full message and captured branch/head', async () => {
    const details = { head: 'a'.repeat(40), branch: 'B', message: 'Original title\n\nOriginal body' }
    const command = sinon.stub()
    command.onFirstCall().resolves({ ...state(), result: details })
    command.onSecondCall().resolves(state())
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Repository actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit submenu', exact: true }))
    fireEvent.click(screen.getByText('Amend latest commit…'))
    const input = await screen.findByRole('textbox', { name: 'Replacement commit message' })
    expect((input as HTMLTextAreaElement).value).to.equal(details.message)
    expect(command.callCount).to.equal(1)
    fireEvent.change(input, { target: { value: 'Updated title\n\nPreserved body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Amend commit' }))
    await waitFor(() => expect(command.callCount).to.equal(2))
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'commit', amend: true,
      message: 'Updated title\n\nPreserved body', expectedHead: details.head, expectedBranch: 'B' })
  })
  it('connects an HTTPS repository while retaining current project files and renders the returned native state', async () => {
    const command = sinon.stub().resolves(state())
    render(<SourceControlView api={{ status: sinon.stub().resolves({ connected: false }), initialize: sinon.stub(), command }} />)
    const url = await screen.findByLabelText('Repository URL')
    fireEvent.change(url, { target: { value: 'https://example.test/paper.git' } })
    fireEvent.change(screen.getByLabelText('Branch (optional)'), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect repository' }))
    await screen.findByRole('button', { name: 'Stage frontmatter.tex' })
    expect(command).to.have.been.calledOnceWithExactly({ command: 'connect', url: 'https://example.test/paper.git', branch: 'B' })
    expect(screen.queryByRole('button', { name: 'Connect repository' })).to.equal(null)
  })
  it('shows native conflict continuation and abort controls for the active operation only', async () => {
    const current = state()
    current.status!.operation = 'rebase'
    current.status!.conflicted = ['frontmatter.tex']
    const finished = state()
    const command = sinon.stub().resolves(finished)
    render(<SourceControlView api={{ status: sinon.stub().resolves(current), initialize: sinon.stub(), command }} />)
    const resume = await screen.findByRole('button', { name: 'Continue rebase' })
    expect((resume as HTMLButtonElement).disabled).to.equal(true)
    expect(screen.getByRole('button', { name: 'Skip commit' })).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Abort rebase' })).to.equal(null))
    expect(command).to.have.been.calledOnceWithExactly({ command: 'continueOperation', operation: 'rebase', action: 'abort' })
  })

  it('renders repository actions outside clipped sections and closes after selecting the last item', async () => {
    const { container } = render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command: sinon.stub().resolves(state()) }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Repository actions' }))
    const settings = screen.getByText('Repository settings…')
    const menu = settings.closest('.native-git-repository-menu')
    expect(menu?.parentElement).to.equal(document.body)
    expect(container.contains(menu)).to.equal(false)
    fireEvent.click(settings)
    await waitFor(() => expect(menu?.classList.contains('show')).to.equal(false))
  })

  for (const staged of [false, true]) {
    it(`applies a native ${staged ? 'unstage' : 'stage'} hunk and refreshes the remaining diff`, async () => {
      const current = state()
      current.status!.files[0] = { path: 'frontmatter.tex', index: staged ? 'M' : ' ', workingTree: staged ? ' ' : 'M' }
      const data = { text: '--- a/frontmatter.tex\n+++ b/frontmatter.tex\n@@ -1 +1 @@\n-old title\n+new title\n@@ -30 +30 @@\n-old conclusion\n+new conclusion\n', fingerprint: 'a'.repeat(64), hunks: [
        { index: 0, oldStart: 1, newStart: 1, lines: ['-old title', 'new title'] },
        { index: 1, oldStart: 30, newStart: 30, lines: ['-old conclusion', 'new conclusion'] },
      ] }
      const command = sinon.stub()
      command.onCall(0).resolves({ ...current, result: data })
      command.onCall(1).resolves(current)
      command.onCall(2).resolves({ ...current, result: { ...data, text: '--- a/frontmatter.tex\n+++ b/frontmatter.tex\n@@ -1 +1 @@\n-old title\n+new title\n', fingerprint: 'b'.repeat(64), hunks: [data.hunks[0]] } })
      render(<SourceControlView api={{ status: sinon.stub().resolves(current), initialize: sinon.stub(), command }} />)
      fireEvent.click(await screen.findByRole('button', { name: 'frontmatter.tex' }))
      fireEvent.click(await screen.findByRole('button', { name: `${staged ? 'Unstage' : 'Stage'} change 2` }))
      await waitFor(() => expect(command.callCount).to.equal(3))
      expect(command.firstCall.args[0]).to.deep.equal({ command: 'fileHunks', path: 'frontmatter.tex', staged })
      expect(command.secondCall.args[0]).to.deep.equal({ command: 'applyHunks', path: 'frontmatter.tex', staged, fingerprint: data.fingerprint, selected: [1] })
      await waitFor(() => expect(screen.queryByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'new conclusion')).to.equal(null))
      expect(screen.getByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'new title')).to.exist
    })
  }
  for (const pendingPhase of ['apply', 'refresh']) {
    it(`keeps a closed diff closed when pending ${pendingPhase} completes`, async () => {
      const data = { text: '--- a/frontmatter.tex\n+++ b/frontmatter.tex\n@@ -1 +1 @@\n-old\n+new\n', fingerprint: 'a'.repeat(64), hunks: [
        { index: 0, oldStart: 1, newStart: 1, lines: ['-old', '+new'] },
      ] }
      let finish!: (value: GitSnapshot) => void
      const pending = new Promise<GitSnapshot>(resolve => { finish = resolve })
      const command = sinon.stub()
      command.onCall(0).resolves({ ...state(), result: data })
      command.onCall(1).returns(pendingPhase === 'apply' ? pending : Promise.resolve(state()))
      command.onCall(2).returns(pending)
      render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
      fireEvent.click(await screen.findByRole('button', { name: 'frontmatter.tex' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Stage change 1' }))
      await waitFor(() => expect(command.callCount).to.equal(pendingPhase === 'apply' ? 2 : 3))
      fireEvent.click(screen.getByRole('region', { name: 'Git diff' }).querySelector('button[aria-label="Close diff"]')!)
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Git diff' })).to.equal(null))
      finish({ ...state(), result: data })
      await waitFor(() => expect((screen.getByRole('button', { name: 'Repository actions' }) as HTMLButtonElement).disabled).to.equal(false))
      expect(screen.queryByRole('region', { name: 'Git diff' })).to.equal(null)
      expect(command.callCount).to.equal(pendingPhase === 'apply' ? 2 : 3)
    })
  }
  it('shows a stale diff error in the diff and does not retry staging automatically', async () => {
    const command = sinon.stub()
    command.onCall(0).resolves({ ...state(), result: { text: '--- a/frontmatter.tex\n+++ b/frontmatter.tex\n@@ -1 +1 @@\n-old\n+new\n', fingerprint: 'a'.repeat(64), hunks: [
      { index: 0, oldStart: 1, newStart: 1, lines: ['-old', '+new'] },
    ] } })
    command.onCall(1).rejects(new Error('The diff changed. Reopen it before selecting changes.'))
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'frontmatter.tex' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stage change 1' }))
    await waitFor(() => expect(document.querySelector('.native-git-editor-diff [role="alert"]')?.textContent).to.contain('The diff changed'))
    expect(command.callCount).to.equal(2)
    expect(screen.getByRole('button', { name: 'Refresh diff' })).to.exist
  })
  it('shows whole-file diff without hunk controls for binary or structural changes', async () => {
    const command = sinon.stub().resolves({ ...state(), result: { text: 'Binary files differ', fingerprint: 'a'.repeat(64), hunks: [] } })
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'frontmatter.tex' }))
    await screen.findByText('Binary file changed. Text comparison is unavailable.')
    expect(screen.queryByRole('button', { name: 'Stage change 1' })).to.equal(null)
  })

  it('refreshes Changes after editor save events without issuing a Git mutation', async () => {
    const clean = state(); clean.status!.files = []
    const status = sinon.stub().onFirstCall().resolves(clean).onSecondCall().resolves(state())
    const command = sinon.stub()
    render(<SourceControlView api={{ status, initialize: sinon.stub(), command }} />)
    await screen.findByText('No changes')
    window.dispatchEvent(new CustomEvent('doc:changed'))
    window.dispatchEvent(new CustomEvent('doc:saved'))
    await screen.findByRole('button', { name: 'Stage frontmatter.tex' }, { timeout: 2500 })
    expect(status.callCount).to.equal(2)
    expect(command).not.to.have.been.called
  })

  it('does not let a delayed background refresh overwrite the result of staging', async () => {
    let resolveStatus!: (value: GitSnapshot) => void
    const status = sinon.stub().onFirstCall().resolves(state()).onSecondCall().returns(new Promise<GitSnapshot>(resolve => { resolveStatus = resolve }))
    const staged = state(); staged.status!.files[0].index = 'M'; staged.status!.files[0].workingTree = ' '
    const command = sinon.stub().resolves(staged)
    render(<SourceControlView api={{ status, initialize: sinon.stub(), command }} />)
    await screen.findByRole('button', { name: 'Stage frontmatter.tex' })
    window.dispatchEvent(new CustomEvent('doc:saved'))
    await waitFor(() => expect(status.callCount).to.equal(2), { timeout: 2500 })
    fireEvent.click(screen.getByRole('button', { name: 'Stage frontmatter.tex' }))
    await screen.findByRole('button', { name: 'Unstage frontmatter.tex' })
    resolveStatus(state())
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.queryByRole('button', { name: 'Stage frontmatter.tex' })).to.equal(null)
    expect(screen.getByRole('button', { name: 'Unstage frontmatter.tex' })).to.exist
  })

  it('refreshes status after a lost commit response without submitting the commit again', async () => {
    const initial = state(); initial.status!.files[0].index = 'M'
    const after = state(); after.status!.files = []; after.graph = [commit('new', ['old'], 'Saved commit')]
    const status = sinon.stub().onFirstCall().resolves(initial).resolves(after)
    const command = sinon.stub().rejects({ response: undefined })
    render(<SourceControlView api={{ status, initialize: sinon.stub(), command }} />)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Commit message' }), { target: { value: 'Saved commit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    await screen.findByText('Saved commit')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh repository status' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Refresh repository status' })).to.equal(null))
    expect(command).to.have.been.calledOnce
  })

  it('opens line authors from file history and navigates to the native commit diff', async () => {
    const hash = 'a'.repeat(40)
    const command = sinon.stub()
    command.onCall(0).resolves({ ...state(), result: [commit(hash, [], 'Original title')] })
    command.onCall(1).resolves({ ...state(), result: `${hash} 1 1
author Alice
author-time 1700000000
summary Original title
filename frontmatter.tex
\tOriginal title
` })
    command.onCall(2).resolves({ ...state(), result: '--- a/frontmatter.tex\n+++ b/frontmatter.tex\n@@ -1 +1 @@\n-old title\n+new title\n' })
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'History frontmatter.tex' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Line authors' }))
    fireEvent.click(await screen.findByRole('button', { name: 'aaaaaaaa' }))
    await screen.findByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'new title')
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'blame', path: 'frontmatter.tex' })
    expect(command.thirdCall.args[0]).to.deep.equal({ command: 'commitDiff', ref: hash })
  })

  it('selects a source branch from the merge list and binds the displayed target', async () => {
    const current = state()
    current.branches = [{ ref: 'refs/heads/C', name: 'C', commit: 'c'.repeat(40), upstream: null, author: 'Alice', email: 'a@example.test', date: '2026-11-09T00:00:00Z', subject: 'C changes', remote: false }]
    const command = sinon.stub().resolves(state())
    render(<SourceControlView api={{ status: sinon.stub().resolves(current), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Repository actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Branch submenu', exact: true }))
    fireEvent.click(screen.getByText('Merge into current branch…'))
    fireEvent.click(screen.getByRole('radio', { name: /C changes/ }))
    expect(screen.getByText('C → B')).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Merge into B' }))
    await waitFor(() => expect(command).to.have.been.calledOnceWithExactly({ command: 'merge', ref: 'refs/heads/C', expectedBranch: 'B' }))
  })

  it('separates unmerged files and stages a chosen native conflict version before allowing continuation', async () => {
    const current = state(); current.status!.conflicted = ['frontmatter.tex']; current.status!.operation = 'merge'
    current.status!.files[0] = { path: 'frontmatter.tex', index: 'U', workingTree: 'U' }
    const resolved = state(); resolved.status!.operation = 'merge'; resolved.status!.files[0] = { path: 'frontmatter.tex', index: 'M', workingTree: ' ' }
    const command = sinon.stub()
    command.onCall(0).resolves({ ...current, result: {
      path: 'frontmatter.tex', fingerprint: 'a'.repeat(64), operation: 'merge',
      versions: { base: { kind: 'text', text: 'base' }, current: { kind: 'text', text: 'ours' }, incoming: { kind: 'text', text: 'theirs' } },
      working: { kind: 'text', text: 'conflict markers' },
    } })
    command.onCall(1).resolves(resolved)
    render(<SourceControlView api={{ status: sinon.stub().resolves(current), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve frontmatter.tex' }))
    expect(screen.queryByRole('button', { name: 'Stage frontmatter.tex' })).to.equal(null)
    fireEvent.click(await screen.findByRole('button', { name: 'Use incoming & stage' }))
    await screen.findByRole('button', { name: 'Unstage frontmatter.tex' })
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'resolveConflict', path: 'frontmatter.tex', fingerprint: 'a'.repeat(64), choice: 'incoming' })
    expect((screen.getByRole('button', { name: 'Continue merge' }) as HTMLButtonElement).disabled).to.equal(false)
    expect(command.callCount).to.equal(2)
  })

  it('previews unstaged changes and only discards after explicit confirmation with the preview fingerprint', async () => {
    const command = sinon.stub()
    command.onCall(0).resolves({ ...state(), result: { path: 'frontmatter.tex', text: '-staged title\n+unstaged title', fingerprint: 'd'.repeat(64) } })
    const clean = state(); clean.status!.files = []
    command.onCall(1).resolves(clean)
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Discard changes to frontmatter.tex' }))
    await screen.findByText(/Staged changes stay intact/)
    expect(command).to.have.been.calledOnce
    expect(command.firstCall.args[0]).to.deep.equal({ command: 'discardDetails', path: 'frontmatter.tex' })
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    await screen.findByText('No changes')
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'discard', paths: ['frontmatter.tex'], fingerprint: 'd'.repeat(64) })
  })

  it('keeps a stale discard preview visible without retrying the destructive operation', async () => {
    const command = sinon.stub()
    command.onCall(0).resolves({ ...state(), result: { path: 'frontmatter.tex', text: 'old diff', fingerprint: 'd'.repeat(64) } })
    command.onCall(1).rejects(new Error('The file or staged version changed.'))
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Discard changes to frontmatter.tex' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(document.querySelector('.modal [role="alert"]')?.textContent).to.equal('The file or staged version changed.'))
    expect(command.callCount).to.equal(2)
    expect(screen.getByRole('button', { name: 'Refresh preview' })).to.exist
  })

  it('renames a branch through the native command without creating a replacement branch', async () => {
    const command = sinon.stub().resolves(state())
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Repository actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Branch submenu', exact: true }))
    fireEvent.click(screen.getByText('Rename branch…'))
    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'revised-title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(command).to.have.been.calledOnceWithExactly({ command: 'renameBranch', from: 'B', to: 'revised-title' }))
  })
  it('opens file history with author, date and commit subject from the current repository', async () => {
    const entry = commit('abcdef123456', ['old'], 'Revise title')
    const command = sinon.stub().resolves({ ...state(), result: [entry] })
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'History frontmatter.tex' }))
    await screen.findByRole('button', { name: 'Revise title' })
    expect(command).to.have.been.calledOnceWithExactly({ command: 'fileHistory', path: 'frontmatter.tex' })
    expect(screen.getByText(/Alice · .* · abcdef12/)).to.exist
    command.resolves({ ...state(), result: '--- a/frontmatter.tex\n+++ b/frontmatter.tex\n@@ -1 +1 @@\n-old title\n+new title\n' })
    fireEvent.click(screen.getByRole('button', { name: 'Revise title' }))
    await screen.findByText((_, element) => element?.classList.contains('cm-line') && element.textContent === 'new title')
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'commitDiff', ref: entry.hash })
  })
  it('stages a selected file, commits it and immediately renders the returned graph and remaining files', async () => {
    const current = state()
    const command = sinon.stub().callsFake(async body => {
      if (body.command === 'stage') current.status!.files[0] = { path: 'frontmatter.tex', index: 'M', workingTree: ' ' }
      if (body.command === 'commit') {
        current.status!.files = current.status!.files.filter(file => file.path !== 'frontmatter.tex')
        current.graph = [commit('new', ['old'], body.message), ...current.graph!]
      }
      return structuredClone(current)
    })
    render(<SourceControlView api={{ status: sinon.stub().resolves(current), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stage frontmatter.tex' }))
    await screen.findByRole('button', { name: 'Unstage frontmatter.tex' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Commit message' }), { target: { value: 'Update title on B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    await screen.findByText('Update title on B')
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'commit', message: 'Update title on B' })
    expect(screen.queryByRole('button', { name: 'Unstage frontmatter.tex' })).to.equal(null)
    expect(screen.getByRole('button', { name: 'Stage methods.tex' })).to.exist
    expect((screen.getByRole('textbox', { name: 'Commit message' }) as HTMLInputElement).value).to.equal('')
    expect(screen.queryByText(/review incoming|synchronization|saved commits/i)).to.equal(null)
    expect(screen.getAllByRole('separator')).to.have.length(2)
  })

  it('keeps the commit message after failure and refreshes native conflict state', async () => {
    const initial = state()
    initial.status!.files[0].index = 'M'
    const failed = structuredClone(initial)
    failed.status!.conflicted = ['frontmatter.tex']
    const status = sinon.stub().onFirstCall().resolves(initial).onSecondCall().resolves(failed)
    render(<SourceControlView api={{ status, initialize: sinon.stub(), command: sinon.stub().rejects(new Error('Native conflict')) }} />)
    await screen.findByRole('button', { name: 'Unstage frontmatter.tex' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Commit message' }), { target: { value: 'Keep my message' } })
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    await screen.findByText('Resolve 1 conflicted files before committing.')
    expect(screen.getByRole('alert').textContent).to.contain('Native conflict')
    expect((screen.getByRole('textbox', { name: 'Commit message' }) as HTMLInputElement).value).to.equal('Keep my message')
  })

  it('renders initialization result instead of remaining stuck on the connect screen', async () => {
    const api = { status: sinon.stub().resolves({ connected: false }), initialize: sinon.stub().resolves(state()), command: sinon.stub() }
    render(<SourceControlView api={api} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Initialize repository' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Initialize repository' })).to.equal(null))
    expect(screen.getByRole('button', { name: 'Stage frontmatter.tex' })).to.exist
  })

  it('generates the message on explicit AI click without committing', async () => {
    const initial = state()
    initial.status!.files[0] = { path: 'frontmatter.tex', index: 'M', workingTree: ' ' }
    const command = sinon.stub().resolves({ ...initial, result: 'Update title from staged diff' })
    render(<SourceControlView api={{ status: sinon.stub().resolves(initial), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate commit message with AI' }))
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Commit message' }) as HTMLInputElement).value).to.equal('Update title from staged diff'))
    expect(command).to.have.been.calledOnceWithExactly({ command: 'generateMessage' })
    expect(screen.getByRole('textbox', { name: 'Commit message' }).tagName).to.equal('INPUT')
  })
})

describe('Native commit graph layout', () => {
  beforeEach(() => { const host = document.createElement('div'); host.id = 'native-git-editor-diff-host'; document.body.append(host) })
  afterEach(() => { cleanup(); document.getElementById('native-git-editor-diff-host')?.remove() })
  it('keeps merge parents in separate lanes until their actual common ancestor', () => {
    const rows = graphRows([commit('merge', ['left', 'right']), commit('left', ['base']), commit('right', ['base']), commit('base', [])])
    expect(rows[0].after).to.deep.equal(['left', 'right'])
    expect(rows[1].after).to.deep.equal(['base', 'right'])
    expect(rows[2].after).to.deep.equal(['base'])
    expect(rows[3].after).to.deep.equal([])
    expect(rows[2].column).to.equal(1)
  })
  it('shows Changes tools/count and confirms batch discard against the preview', async () => {
    const command = sinon.stub()
    command.onCall(0).resolves({ ...state(), result: { paths: ['frontmatter.tex', 'methods.tex'], untracked: [], fingerprint: 'e'.repeat(64) } })
    const clean = state(); clean.status!.files = []
    command.onCall(1).resolves(clean)
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} onOpenFile={() => {}} />)
    await screen.findByRole('toolbar', { name: 'Changes actions' })
    expect(screen.getByLabelText('2 changed files')).to.exist
    for (const name of ['Open file frontmatter.tex', 'Discard changes to frontmatter.tex', 'Stage frontmatter.tex', 'View Git Graph', 'Refresh changes', 'More changes actions']) expect(screen.getByRole('button', { name })).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Discard all changes' }))
    await screen.findByRole('dialog', { name: 'Discard all changes' })
    expect(command).to.have.been.calledOnce
    fireEvent.click(document.querySelector<HTMLButtonElement>('.modal .btn-danger')!)
    await screen.findByText('No changes')
    expect(command.secondCall.args[0]).to.deep.equal({ command: 'discardAll', paths: ['frontmatter.tex', 'methods.tex'], fingerprint: 'e'.repeat(64) })
  })
  it('opens the changed-file navigator and switches scoped diffs without staging', async () => {
    const command = sinon.stub().resolves({ result: { text: '--- a/a.tex\n+++ b/a.tex\n@@ -1 +1 @@\n-old\n+new\n', hunks: [], fingerprint: 'a'.repeat(64) } })
    render(<SourceControlView api={{ status: sinon.stub().resolves(state()), initialize: sinon.stub(), command }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open Changes' }))
    const files = await screen.findByRole('combobox', { name: 'Changed file' })
    fireEvent.change(files, { target: { value: 'methods.tex' } })
    await waitFor(() => expect(command.lastCall.args[0]).to.deep.equal({ command: 'fileHunks', path: 'methods.tex', staged: false }))
    expect(command.getCalls().every(call => call.args[0].command === 'fileHunks')).to.equal(true)
  })

})
