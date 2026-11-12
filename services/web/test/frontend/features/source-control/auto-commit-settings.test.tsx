import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import sinon from 'sinon'
import AutoCommitSettings from '@/features/source-control/auto-commit-settings'
const api = command => ({ status: async () => ({}), initialize: async () => ({}), command })
describe('automatic commit settings', () => {
  afterEach(cleanup)
  it('saves branch interval with exact policy revision', async () => {
    const command = sinon.stub().resolves({ result: { revision: 7, enabled: false, schedulerAvailable: true } })
    render(<AutoCommitSettings api={api(command)} />)
    fireEvent.click(screen.getByText('Automatic commits…'))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } })
    fireEvent.click(screen.getByText('Save automatic commits'))
    await waitFor(() => expect(command).to.have.been.calledWith({ command: 'configureAutoCommitSchedule', revision: 7, enabled: true, intervalMs: 120000 }))
  })
  it('blocks schedule changes until an explicitly reviewed recovery completes', async () => {
    const command = sinon.stub().callsFake(async body => ({ result: body.command === 'autoCommitRecoveryPreview'
      ? { operationId: 'task', revision: 4, fingerprint: 'fingerprint', action: 'cancel' }
      : { revision: 8, enabled: true, schedulerAvailable: true, operationId: 'task', state: 'paused' } }))
    render(<AutoCommitSettings api={api(command)} />)
    fireEvent.click(screen.getByText('Automatic commits…'))
    await screen.findByRole('checkbox')
    expect((screen.getByText('Save automatic commits') as HTMLButtonElement).disabled).to.equal(true)
    fireEvent.click(screen.getByText('Review interrupted automatic commit'))
    fireEvent.click(await screen.findByText('Confirm automatic commit recovery'))
    await waitFor(() => expect(command).to.have.been.calledWith({ command: 'autoCommitRecover', operationId: 'task', revision: 4, fingerprint: 'fingerprint', scheduleRevision: 8 }))
  })
  it('does not expose settings when owner authorization fails', async () => {
    render(<AutoCommitSettings api={api(sinon.stub().rejects(Error('Only the project owner')))} />)
    fireEvent.click(screen.getByText('Automatic commits…'))
    expect((await screen.findByRole('alert')).textContent).to.contain('project owner')
    expect(screen.queryByRole('checkbox')).to.equal(null)
  })
  it('ignores a late recovery preview after switching API', async () => {
    let resolve
    const pending = new Promise(r => { resolve = r })
    const first = sinon.stub().callsFake(body => body.command === 'autoCommitRecoveryPreview' ? pending : Promise.resolve({ result: { revision: 8, enabled: true, schedulerAvailable: true, operationId: 'old-task' } }))
    const view = render(<AutoCommitSettings api={api(first)} />)
    fireEvent.click(screen.getByText('Automatic commits…'))
    fireEvent.click(await screen.findByText('Review interrupted automatic commit'))
    const second = sinon.stub().resolves({ result: { revision: 1, enabled: false, schedulerAvailable: true } })
    view.rerender(<AutoCommitSettings api={api(second)} />)
    await waitFor(() => expect((screen.getByRole('checkbox') as HTMLInputElement).checked).to.equal(false))
    await act(async () => resolve({ result: { operationId: 'old-task', revision: 2, fingerprint: 'old', action: 'cancel' } }))
    expect(screen.queryByText('Confirm automatic commit recovery')).to.equal(null)
    expect(second.callCount).to.equal(1)
  })
})
