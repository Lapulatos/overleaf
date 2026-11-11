import { expect } from 'chai'
import { branchChoices, filterBranches } from '@/features/source-control/branch-choices'
import type { GitBranch } from '@/features/source-control/types'

const branch = (name: string, commit: string, remote = false, upstream: string | null = null): GitBranch => ({
  ref: `refs/${remote ? 'remotes' : 'heads'}/${name}`, name, commit, upstream,
  author: 'Paper Author', email: 'author@example.test', date: '2026-11-09T10:00:00Z',
  subject: `Change on ${name}`, remote,
})

describe('Native Git branch picker', () => {
  it('shows one checkout choice for a tracking branch, retaining its different remote tip', () => {
    const choices = branchChoices([
      branch('B', 'new-local', false, 'refs/remotes/origin/B'),
      branch('origin/B', 'old-remote', true),
      branch('repo-test', 'old-base', false, 'refs/remotes/origin/repo-test'),
      branch('origin/repo-test', 'old-base', true),
    ], 'B')
    expect(choices.map(choice => choice.name)).to.deep.equal(['B', 'repo-test'])
    expect(choices[0].commit).to.equal('new-local')
    expect(choices[0].remoteTip).to.equal('old-remote')
    expect(choices[0].subject).to.equal('Change on B')
    expect(choices[0].author).to.equal('Paper Author')
    expect(choices[0].current).to.equal(true)
  })
  it('does not collapse unrelated local and remote branches just because their commit is identical', () => {
    const choices = branchChoices([branch('A', 'same'), branch('B', 'same'), branch('origin/C', 'same', true)], 'A')
    expect(choices).to.have.length(3)
    expect(filterBranches(choices, 'origin/C')[0].name).to.equal('origin/C')
    expect(filterBranches(choices, 'Paper Author')).to.have.length(3)
  })
})
