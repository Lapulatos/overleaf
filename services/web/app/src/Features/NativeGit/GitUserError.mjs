import { GitError } from 'simple-git'

// Classify only known native refusals. Storage/process failures must still reach
// the server error handler rather than masquerading as a user mistake.
export function gitUserError(error) {
  if (!(error instanceof GitError)) return null
  const message = error.message || ''
  if (/a (?:branch|tag) named .+ already exists|tag .+ already exists/i.test(message)) {
    return { status: 409, error: 'That branch or tag already exists. Choose another name.' }
  }
  if (/Needed a single revision|not a valid object name|invalid reference:|unknown revision or path|bad revision|invalid upstream|could not resolve/i.test(message)) {
    return { status: 400, error: 'That branch, tag or commit could not be found. Refresh the references and choose an existing one.' }
  }
  if (/is not a valid branch name|is not a valid tag name/i.test(message)) {
    return { status: 400, error: 'Invalid branch or tag name.' }
  }
  if (/branch .+ not found|tag .+ not found/i.test(message)) {
    return { status: 409, error: 'That branch or tag no longer exists. Refresh the references.' }
  }
  if (/is not fully merged/i.test(message)) {
    return { status: 409, error: 'This branch has unmerged commits. Merge them before deleting the branch.' }
  }
  if (/would be overwritten by|Please commit your changes or stash them|cannot rebase:.*unstaged changes/i.test(message)) {
    return { status: 409, error: 'Uncommitted changes prevent this operation. Commit or stash them, then retry.' }
  }
  if (/nothing to commit|no changes added to commit/i.test(message)) {
    return { status: 409, error: 'There are no staged changes to commit. Refresh Changes and stage the files you want to commit.' }
  }
  return null
}
