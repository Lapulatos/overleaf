// Commands that inspect immutable Git history only. Do not reuse the broader
// access-policy "readCommands" list: it includes terminals and worktree reads.
const historyReadCommands = new Set(['graph', 'branches', 'commitDetails', 'commitDiff', 'commitFiles', 'commitFileDiff', 'commitFilePreview'])
export const isHistoryReadCommand = command => historyReadCommands.has(command)
