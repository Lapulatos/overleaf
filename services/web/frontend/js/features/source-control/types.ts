export type TerminalIndicator = { branch?: string | null; userId: string; displayName: string; name: string; state: 'running' | 'stopped' | 'unavailable' | 'ready' }

export type GitFile = {
  path: string
  from?: string
  index: string
  workingTree: string
}

export type GitStatus = {
  operation?: 'merge' | 'rebase' | 'cherry-pick' | 'revert' | null
  branch: string | null
  detached: boolean
  upstream: string | null
  ahead: number
  behind: number
  conflicted: string[]
  files: GitFile[]
}

export type GitBranch = {
  terminals?: TerminalIndicator[]
  autoSync?: { enabled: boolean; state: string }
  autoCommit?: { enabled: boolean; state: string }
  ref: string
  name: string
  commit: string
  upstream: string | null
  author: string
  email: string
  date: string
  subject: string
  remote: boolean
  tag?: boolean
}

export type GitCommit = {
  terminals?: TerminalIndicator[]
  hash: string
  parents: string[]
  author: string
  email: string
  date: string
  subject: string
  refs: string
}

export type BranchChoice = GitBranch & {
  current: boolean
  remoteTip?: string
  remoteDate?: string
}

export type GitWebRemote = { name: string; provider: string; commitBaseUrl: string }

export type GitSnapshot = {
  readOnly?: boolean
  workspaceNavigation?: { logicalProjectId: string; workspaceId: string; branch: string; url: string }
  webRemotes?: GitWebRemote[]
  collaboration?: { drafts: boolean; apply: boolean }
  connected?: boolean
  switching?: boolean
  mutationTaskId?: string
  mutationKind?: 'shell' | 'auto-commit'
  canRecoverMutation?: boolean
  status?: GitStatus
  branches?: GitBranch[]
  tags?: GitBranch[]
  graph?: GitCommit[]
  reviewRequired?: boolean
  result?: unknown
}

export type CommitFile = { path: string; from?: string; status: string }
export type CommitDetails = { files: CommitFile[]; insertions: number; deletions: number; parent: string | null }
