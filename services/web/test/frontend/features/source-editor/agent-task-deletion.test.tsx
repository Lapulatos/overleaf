import { expect } from 'chai'
import { fireEvent, render, screen } from '@testing-library/react'
import sinon from 'sinon'
import { AgentTaskResult, type Proposal, type Task } from '@/features/source-editor/extensions/writing-assist/agent-task-result'

const proposal: Proposal = { id: 'proposal', path: 'chapter.tex', mode: 'delete-document', before: 'Original text', after: '', status: 'pending' }
const task: Task = { taskId: 'task', status: 'completed', instruction: 'Remove unused chapter', summary: 'Review deletion', output: '', proposals: [proposal] }
describe('Reviewed file deletion', function () {
  it('labels deletion explicitly and waits for the user action', function () {
    const act = sinon.spy()
    render(<AgentTaskResult task={task} busy={false} act={act} />)
    expect(screen.getByText('Original text').closest('.paper-diff-removed')).to.exist
    expect(screen.queryByRole('button', { name: 'Accept change' })).to.equal(null)
    sinon.assert.notCalled(act)
    fireEvent.click(screen.getByRole('button', { name: 'Delete file' }))
    sinon.assert.calledWith(act, proposal, true)
  })
  it('retries the same uncertain deletion without offering rejection', function () {
    const act = sinon.spy()
    const pending: Proposal = { ...proposal, status: 'uncertain' }
    render(<AgentTaskResult task={{ ...task, proposals: [pending] }} busy={false} act={act} />)
    expect(screen.queryByRole('button', { name: 'Reject' })).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'Retry deletion' }))
    sinon.assert.calledWith(act, pending, true)
  })
  it('prevents repeated clicks while recovery is in progress', function () {
    const act = sinon.spy()
    render(<AgentTaskResult task={{ ...task, proposals: [{ ...proposal, status: 'applying' }] }} busy act={act} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry deletion' }))
    sinon.assert.notCalled(act)
  })
})
