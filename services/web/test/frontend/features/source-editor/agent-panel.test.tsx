import { expect } from 'chai'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { AgentTaskView } from '@/features/source-editor/extensions/writing-assist/agent-panel'

const base = '/writing-assist/project/project/tasks'
const proposal = {
  id: 'proposal',
  path: 'main.tex',
  before: 'Old text\n',
  after: 'New text\n',
  status: 'pending',
}
const task = {
  taskId: 'task',
  status: 'completed',
  instruction: 'Improve clarity',
  summary: 'Suggested revision',
  output: '',
  proposals: [proposal],
}

describe('Paper Assistant task panel', function () {
  beforeEach(function () {
    window.sessionStorage.clear()
  })
  afterEach(function () {
    cleanup()
    fetchMock.removeRoutes().clearHistory()
    window.sessionStorage.clear()
  })

  it('shows the proposal without automatically applying it, then accepts on request', async function () {
    fetchMock.post(base, { ...task, status: 'running', proposals: [] })
    fetchMock.get(`${base}/task`, task)
    fetchMock.post(`${base}/task/proposals/proposal`, {
      ...task,
      proposals: [{ ...proposal, status: 'accepted' }],
    })
    render(<AgentTaskView projectId="project" />)
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Improve clarity' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run task' }))
    const accept = await screen.findByRole('button', { name: 'Accept change' })
    expect(screen.getByText((_text, el) => el?.tagName === 'CODE' && el.textContent === 'Old text').closest('.paper-diff-removed')).to.exist
    expect(screen.getByText((_text, el) => el?.tagName === 'CODE' && el.textContent === 'New text').closest('.paper-diff-added')).to.exist
    expect(
      fetchMock.callHistory.calls(`${base}/task/proposals/proposal`)
    ).to.have.length(0)
    fireEvent.click(accept)
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(`${base}/task/proposals/proposal`)
      ).to.have.length(1)
    )
  })

  it('restores the active task after reopening and lets the user reject a proposal', async function () {
    window.sessionStorage.setItem('writing-assist-task:project', 'task')
    fetchMock.get(`${base}/task`, task)
    fetchMock.post(`${base}/task/proposals/proposal`, {
      ...task,
      proposals: [{ ...proposal, status: 'rejected' }],
    })
    render(<AgentTaskView projectId="project" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(`${base}/task/proposals/proposal`)
      ).to.have.length(1)
    )
    const call = fetchMock.callHistory.calls(
      `${base}/task/proposals/proposal`
    )[0]
    expect(JSON.parse(call.options.body as string)).to.deep.equal({
      accept: false,
    })
  })

  it('shows configuration errors instead of pretending a task started', async function () {
    fetchMock.post(base, {
      status: 503,
      body: { error: 'Local agent endpoint and token are not configured' },
    })
    render(<AgentTaskView projectId="project" />)
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Improve clarity' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run task' }))
    expect((await screen.findByRole('alert')).textContent).to.contain(
      'Local agent endpoint and token are not configured'
    )
    expect(screen.queryByRole('button', { name: 'Cancel task' })).to.equal(null)
  })
  it('reads back a committed deletion after its response is lost without resending it', async function () {
    const proposal = { id: 'proposal', path: 'old.tex', mode: 'delete-document', before: 'old', after: '', status: 'pending' }
    const pending = { ...task, proposals: [proposal] }
    const done = { ...pending, proposals: [{ ...proposal, status: 'accepted' }] }
    let committed = false
    window.sessionStorage.setItem('writing-assist-task:project', 'task')
    fetchMock.get(`${base}/task`, () => committed ? done : pending)
    const endpoint = `${base}/task/proposals/proposal`
    fetchMock.post(endpoint, () => { committed = true; throw new TypeError('Connection lost') })
    render(<AgentTaskView projectId="project" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete file' }))
    await screen.findByText('Status: accepted')
    await waitFor(() => expect(screen.queryByRole('alert')).to.equal(null))
    expect(screen.queryByRole('button', { name: 'Delete file' })).to.equal(null)
    expect(fetchMock.callHistory.calls(endpoint)).to.have.length(1)
  })

})
