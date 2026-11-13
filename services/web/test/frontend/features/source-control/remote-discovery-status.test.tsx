import { expect } from 'chai'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import RemoteDiscoveryStatus from '@/features/source-control/remote-discovery-status'
import type { GitApi } from '@/features/source-control/api'
import type { GitSnapshot } from '@/features/source-control/types'
const task = (remote: string) => ({ id: remote, revision: 2, remote, state: 'fetched', createdAt: '2026-11-11T00:00:00Z', changes: [] })
function fixture() {
 const requests: { resolve(value: GitSnapshot): void; reject(reason: Error): void }[] = []
 const api: GitApi = { status: async () => ({}), initialize: async () => ({}), command: async body => {
  expect(body).to.deep.equal({ command: 'remoteDiscoveryList' })
  return new Promise((resolve, reject) => requests.push({ resolve, reject }))
 } }
 return { requests, api }
}
describe('shared remote discovery status', () => {
 afterEach(cleanup)
 it('reviews the displayed remote commit and offers no merge action for deleted tips', async () => {
  const f = fixture(), calls: string[][] = []
  render(<RemoteDiscoveryStatus api={f.api} onReview={(ref, oid) => calls.push([ref, oid])} />)
  const oid = 'a'.repeat(40)
  await act(async () => { f.requests[0].resolve({ result: [{ ...task('origin'), changes: [
    { ref: 'refs/remotes/origin/main', before: 'b'.repeat(40), after: oid, change: 'advanced' },
    { ref: 'refs/remotes/origin/deleted', before: oid, after: null, change: 'deleted' },
  ] }] }) })
  fireEvent.click(screen.getByRole('button',{name:'Remote updates'}));fireEvent.click(screen.getByText('origin'))
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  expect(calls).to.deep.equal([['refs/remotes/origin/main', oid]])
  expect(screen.getAllByRole('button', { name: 'Review' })).to.have.length(1)
 })
 it('reports malformed status instead of crashing the Source Control panel', async () => {
  const f = fixture(); render(<RemoteDiscoveryStatus api={f.api} />)
  await act(async () => { f.requests[0].resolve({ result: [{ id: 'wrong-kind' }] }) })
  fireEvent.click(screen.getByRole('button',{name:'Remote updates'}))
  expect(screen.getByRole('alert').textContent).to.contain('Invalid remote update status response')
 })
 it('subscribes during initial load and ignores an older response arriving last', async () => {
  const f = fixture(); render(<RemoteDiscoveryStatus api={f.api} />)
  act(() => { window.dispatchEvent(new Event('native-git-command-completed')) })
  expect(f.requests).to.have.length(2)
  await act(async () => { f.requests[1].resolve({ result: [task('newer')] }) })
  await act(async () => { f.requests[0].resolve({ result: [task('older')] }) })
  fireEvent.click(screen.getByRole('button',{name:'Remote updates'}))
  expect(screen.getByText('newer')).to.exist
  expect(screen.queryByText('older')).to.equal(null)
 })
 it('removes stale data on access failure and reloads on reconnection or focus', async () => {
  const f = fixture(); render(<RemoteDiscoveryStatus api={f.api} />)
  await act(async () => { f.requests[0].resolve({ result: [task('origin')] }) })
  act(() => { window.dispatchEvent(new Event('online')) })
  await act(async () => { f.requests[1].reject(Error('Project membership was revoked')) })
  expect(screen.queryByText('origin')).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Remote updates'}))
  expect(screen.getByRole('alert').textContent).to.contain('revoked')
  act(() => { window.dispatchEvent(new Event('focus')) })
  await act(async () => { f.requests[2].resolve({ result: [task('restored')] }) })
  expect(screen.getByText('restored')).to.exist
  expect(screen.queryByRole('alert')).to.equal(null)
 })
 it('cleans listeners and clears previous workspace data on API change', async () => {
  const f = fixture(), other = fixture()
  const view = render(<RemoteDiscoveryStatus api={f.api} />)
  await act(async () => { f.requests[0].resolve({ result: [task('private-old')] }) })
  view.rerender(<RemoteDiscoveryStatus api={other.api} />)
  expect(screen.queryByText('private-old')).to.equal(null)
  view.unmount()
  act(() => { window.dispatchEvent(new Event('native-git-command-completed')) })
  expect(other.requests).to.have.length(1)
  await act(async () => { other.requests[0].resolve({ result: [task('late')] }) })
  expect(screen.queryByText('late')).to.equal(null)
 })
})
