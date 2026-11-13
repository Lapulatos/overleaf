import { expect } from 'chai'
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import WorkspaceTaskNotice from '@/features/source-control/workspace-task-notice'
import type { GitApi } from '@/features/source-control/api'
import type { GitSnapshot } from '@/features/source-control/types'
const task = { id: 'task', revision: 2, state: 'conflicted', sourceRef: 'origin/main', targetBranch: 'paper', remainingPaths: [], leaseGeneration: 0 }
function fixture() {
 const requests: { resolve(value: GitSnapshot): void; reject(reason: Error): void }[] = []
 const api: GitApi = { status: async () => ({}), initialize: async () => ({}), command: async body => {
  expect(body).to.deep.equal({ command: 'mergeDraftList' })
  return new Promise((resolve, reject) => requests.push({ resolve, reject }))
 } }
 return { requests, api }
}
describe('workspace-wide Git task notices', () => {
 afterEach(cleanup)
 it('shows a conflict without mounting Source Control and opens its shared task dialog', async () => {
  const f = fixture(); render(<WorkspaceTaskNotice api={f.api} canApply={false} />)
  await act(async () => { f.requests[0].resolve({ result: [task] }) })
  expect(screen.getByRole('status').textContent).to.contain('Merge needs your review')
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  await act(async () => { f.requests[1].resolve({ result: [task] }) })
  expect(screen.getByRole('dialog', { name: 'Shared merge tasks' })).to.exist
 })
 it('removes completed tasks and ignores an older response that arrives afterwards', async () => {
  const f = fixture(); render(<WorkspaceTaskNotice api={f.api} canApply={false} />)
  await act(async () => { f.requests[0].resolve({ result: [task] }) })
  act(() => { window.dispatchEvent(new Event('native-git-command-completed')); window.dispatchEvent(new Event('native-git-command-completed')) })
  await act(async () => { f.requests[2].resolve({ result: [{ ...task, state: 'resolved', revision: 4 }] }) })
  await act(async () => { f.requests[1].resolve({ result: [task] }) })
  expect(screen.queryByRole('complementary')).to.equal(null)
 })
 it('clears sensitive task details and closes dialog after permission failure', async () => {
  const f = fixture(); render(<WorkspaceTaskNotice api={f.api} canApply={false} />)
  await act(async () => { f.requests[0].resolve({ result: [task] }) })
  act(() => { window.dispatchEvent(new Event('focus')) })
  await act(async () => { f.requests[1].reject(Error('revoked')) })
  expect(screen.queryByText(/origin\/main/)).to.equal(null)
  expect(screen.getByRole('status').textContent).to.contain('unavailable')
 })
 it('cleans up listeners and refuses late results from previous workspace', async () => {
  const f = fixture(), next = fixture()
  const view = render(<WorkspaceTaskNotice api={f.api} canApply={false} />)
  view.rerender(<WorkspaceTaskNotice api={next.api} canApply={false} />)
  await act(async () => { f.requests[0].resolve({ result: [task] }) })
  expect(screen.queryByRole('complementary')).to.equal(null)
  view.unmount();act(() => { window.dispatchEvent(new Event('online')) })
  expect(next.requests).to.have.length(1)
 })
})
