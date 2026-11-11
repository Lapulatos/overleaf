import type { BranchChoice, GitBranch } from './types'

// Keep tracking refs as metadata on their local branch. They are not a second
// checkout choice with a misleadingly identical name. Untracked remote branches
// remain available and will create a local tracking branch when selected.
export function branchChoices(branches: GitBranch[], current: string | null): BranchChoice[] {
  const locals = branches.filter(branch => !branch.remote)
  const byRef = new Map(branches.map(branch => [branch.ref, branch]))
  const tracked = new Set(locals.map(branch => branch.upstream).filter(Boolean))
  const choices = locals.map(branch => {
    const remote = branch.upstream ? byRef.get(branch.upstream) : undefined
    return { ...branch, current: branch.name === current || branch.ref === current,
      remoteTip: remote?.commit, remoteDate: remote?.date }
  })
  const remoteOnly = branches.filter(branch => branch.remote && !tracked.has(branch.ref))
    .map(branch => ({ ...branch, current: branch.ref === current }))
  return [...choices, ...remoteOnly].sort((a, b) => Number(b.current) - Number(a.current) ||
    (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.name.localeCompare(b.name))
}

export function filterBranches(choices: BranchChoice[], search: string): BranchChoice[] {
  const query = search.trim().toLocaleLowerCase()
  return choices.filter(branch => !query ||
    [branch.name, branch.subject, branch.author, branch.commit].some(value => value.toLocaleLowerCase().includes(query)))
}
