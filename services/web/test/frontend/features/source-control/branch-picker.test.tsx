import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import sinon from 'sinon'
import BranchPicker from '@/features/source-control/branch-picker'
import type { GitBranch } from '@/features/source-control/types'

const branches: GitBranch[] = [
  { ref: 'refs/heads/B', name: 'B', commit: '123456789abcdef', upstream: 'refs/remotes/origin/B', author: 'Alice',
    email: 'alice@example.test', date: '2026-11-09T00:00:00Z', subject: 'Update abstract on B', remote: false },
  { ref: 'refs/remotes/origin/B', name: 'origin/B', commit: '000000000abcdef', upstream: null, author: 'Bob',
    email: 'bob@example.test', date: '2026-11-01T00:00:00Z', subject: 'Original abstract', remote: true },
]
function Harness({ tags = [] as GitBranch[], onCheckout = sinon.spy(), onCreate = sinon.spy(), onDetached = sinon.spy() }) {
  const target = useRef<HTMLButtonElement>(null)
  const [show, setShow] = useState(false)
  return <><button ref={target} onClick={() => setShow(true)}>B</button>
    <BranchPicker target={target} show={show} branches={branches} tags={tags} current="B" onClose={() => setShow(false)}
      onCheckout={onCheckout} onCreate={onCreate} onDetached={onDetached} /></>
}

describe('Branch picker interaction', () => {
  afterEach(cleanup)
  it('searches tag commit metadata and distinguishes detached tag checkout from branches', async () => {
    const onCheckout = sinon.spy()
    const tag = { ...branches[0], ref: 'refs/tags/release', name: 'release', tag: true, upstream: null, subject: 'Published title' }
    render(<Harness tags={[tag]} onCheckout={onCheckout} />)
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    const input = await screen.findByRole('combobox')
    fireEvent.change(input, { target: { value: 'Published title' } })
    fireEvent.click(screen.getByRole('option', { name: /Tag · detached/ }))
    expect(onCheckout.firstCall.args[0].ref).to.equal('refs/tags/release')
    expect(onCheckout.firstCall.args[0].tag).to.equal(true)
  })
  it('shows the three direct actions and actual commit author, date and subject without duplicate tracking ref', async () => {
    const onCreate = sinon.spy()
    render(<Harness onCreate={onCreate} />)
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    await screen.findByRole('combobox', { name: 'Select a branch or tag to checkout' })
    expect(screen.getAllByRole('option')).to.have.length(4)
    expect(screen.getByText('Alice · 12345678 · Update abstract on B')).to.exist
    expect(screen.queryByText('origin/B')).to.equal(null)
    fireEvent.click(screen.getByRole('option', { name: /Create new branch from/ }))
    expect(onCreate).to.have.been.calledOnceWithExactly(true)
  })
  it('supports searching by author, direct selection and Escape returning focus', async () => {
    const onCheckout = sinon.spy()
    render(<Harness onCheckout={onCheckout} />)
    const trigger = screen.getByRole('button', { name: 'B' })
    fireEvent.click(trigger)
    const input = await screen.findByRole('combobox')
    fireEvent.change(input, { target: { value: 'Alice' } })
    const item = screen.getByRole('option', { name: /Update abstract on B/ })
    fireEvent.click(item)
    expect(onCheckout.firstCall.args[0].ref).to.equal('refs/heads/B')
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('combobox')).to.equal(null))
    expect(document.activeElement).to.equal(trigger)
  })
})
