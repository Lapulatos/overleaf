import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { buildDiffRows, ProposalDiff } from '@/features/source-editor/extensions/writing-assist/proposal-diff'
import { AgentTaskResult } from '@/features/source-editor/extensions/writing-assist/agent-task-result'

describe('Reviewable line diffs', function () {
  afterEach(cleanup)
  it('preserves line numbers and highlights words within replacements', function () {
    const rows = buildDiffRows('header\nold value\nfooter\n', 'header\nnew value\nfooter\n', 10)
    expect(rows.map(r => [r.kind, r.oldLine, r.newLine])).to.deep.equal([
      ['context', 10, 10], ['removed', 11, undefined], ['added', undefined, 11], ['context', 12, 12],
    ])
    expect(rows[1].segments?.filter(s => s.changed).map(s => s.text).join('')).to.equal('old')
    expect(rows[2].segments?.filter(s => s.changed).map(s => s.text).join('')).to.equal('new')
  })
  it('shows additions, deletions and newline-only differences without losing content', function () {
    expect(buildDiffRows('', 'new\n').map(r => r.kind)).to.deep.equal(['added'])
    expect(buildDiffRows('old\n', '').map(r => r.kind)).to.deep.equal(['removed'])
    render(<ProposalDiff before="same" after={'same\n'} />)
    expect(screen.getByText('Final newline added')).to.exist
  })
  it('collapses distant context and can reveal the full file', function () {
    const before = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n')
    render(<ProposalDiff before={before} after={before.replace('line 20', 'replacement')} />)
    expect(screen.queryByText('line 0', { exact: true })).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'Show full file' }))
    expect(screen.getByText('line 0', { exact: true })).to.exist
  })
  it('expands review without applying, then routes the explicit decision', function () {
    const decisions: boolean[] = []
    const task = { taskId: 't', status: 'completed' as const, instruction: 'Polish this', summary: 'Changed wording.', output: '', proposals: [{ id: 'p', path: 'main.tex', before: 'old', after: 'new', status: 'pending' as const }] }
    render(<AgentTaskResult task={task} busy={false} act={(_proposal, accept) => decisions.push(accept)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand diff' }))
    expect(screen.getByRole('dialog', { name: 'Review main.tex' })).to.exist
    expect(decisions).to.deep.equal([])
    fireEvent.click(screen.getByRole('button', { name: 'Accept change' }))
    expect(decisions).to.deep.equal([true])
  })
})
