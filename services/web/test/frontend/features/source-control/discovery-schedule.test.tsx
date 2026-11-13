import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import DiscoverySchedule from '@/features/source-control/discovery-schedule'
describe('remote discovery schedule settings', () => {
 afterEach(cleanup)
 it('saves owner-selected interval and pinned revision, then refreshes server policy', async () => {
  const command = sinon.stub().callsFake(async body => body.command === 'discoverySchedule'
   ? { result: { revision: 7, enabled: false, schedulerAvailable: true } } : { result: {} })
  render(<DiscoverySchedule api={{ status: async () => ({}), initialize: async () => ({}), command }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remote checks & webhooks' }))
  fireEvent.click(await screen.findByRole('checkbox'))
  fireEvent.change(screen.getByRole('combobox',{name:'Check for updates'}), { target: { value: '15' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Repository remote' }), { target: { value: 'upstream' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await waitFor(() => expect(command).to.have.been.calledWith({ command: 'configureDiscoverySchedule', revision: 7, enabled: true, remote: 'upstream', intervalMs: 900000 }))
  await waitFor(() => expect(command.args.filter(([body])=>['discoverySchedule','configureDiscoverySchedule'].includes(body.command))).to.have.length(3))
 })
 it('shows owner authorization errors without rendering editable settings', async () => {
  const command = sinon.stub().rejects(Error('Only the project owner can configure remote discovery'))
  render(<DiscoverySchedule api={{ status: async () => ({}), initialize: async () => ({}), command }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remote checks & webhooks' }))
  expect((await screen.findByRole('alert')).textContent).to.contain('project owner')
  expect(screen.queryByRole('checkbox')).to.equal(null)
  expect((screen.getByRole('button', { name: 'Save settings' }) as HTMLButtonElement).disabled).to.equal(true)
 })
 it('allows disabling an existing policy when deployment scheduler is off', async () => {
  const command = sinon.stub().resolves({ result: { revision: 8, enabled: true, remote: 'origin', intervalMs: 60000, schedulerAvailable: false } })
  render(<DiscoverySchedule api={{ status: async () => ({}), initialize: async () => ({}), command }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remote checks & webhooks' }))
  const checkbox = await screen.findByRole('checkbox')
  fireEvent.click(checkbox)
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await waitFor(() => expect(command).to.have.been.calledWith({ command: 'configureDiscoverySchedule', revision: 8, enabled: false, remote: 'origin', intervalMs: 60000 }))
 })
})
