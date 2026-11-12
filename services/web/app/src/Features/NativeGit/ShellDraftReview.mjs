import { createHash } from 'node:crypto'
import { isUtf8 } from 'node:buffer'
import { publicShellDraft } from './ShellDraftService.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
export function shellReviewFingerprint(task) {
  // Includes document identities/versions, not only content equality. A later
  // application must compare the live workspace independently as well.
  return hash(JSON.stringify({ id: task.id, revision: task.revision, logicalProjectId: task.logicalProjectId,
    workspaceId: task.workspaceId, workspaceEpoch: task.workspaceEpoch, createdBy: task.createdBy,
    baseline: task.baseline, baselineManifest: task.baselineManifest, reviewManifest: task.reviewManifest }))
}
export function shellReviewOverview({ task, changes }) {
  return { task: publicShellDraft(task), fingerprint: shellReviewFingerprint(task),
    changes: changes.map(({ path, before, after }) => ({ path,
      status: before == null ? 'added' : after == null ? 'deleted' : 'modified',
      beforeBytes: before?.length ?? 0, afterBytes: after?.length ?? 0 })) }
}
function preview(bytes) {
  if (bytes == null) return { exists: false, bytes: 0, hash: null, text: null, binary: false, tooLarge: false }
  const binary = bytes.includes(0) || !isUtf8(bytes)
  const tooLarge = bytes.length > 1024 * 1024
  return { exists: true, bytes: bytes.length, hash: hash(bytes), binary, tooLarge,
    text: binary || tooLarge ? null : bytes.toString('utf8') }
}
export function shellReviewFile(review, path, fingerprint) {
  if (fingerprint !== shellReviewFingerprint(review.task)) throw Object.assign(new Error('Shell review changed; refresh before viewing or applying'), { status: 409 })
  const change = review.changes.find(change => change.path === path)
  if (!change) throw Object.assign(new Error('Path is not part of this sealed shell review'), { status: 400 })
  return { task: publicShellDraft(review.task), fingerprint, path, before: preview(change.before), after: preview(change.after) }
}
