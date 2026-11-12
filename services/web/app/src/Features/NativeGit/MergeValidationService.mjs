import { randomBytes, createHash } from 'node:crypto'
import Path from 'node:path'
import { writeRecoverySnapshot } from './RecoverySnapshots.mjs'
import { publicMergeTask } from './MergeDraftService.mjs'
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const refuse = message => Object.assign(Error(message), { status: 409 })

// Compile a captured request outside the write lease. The compiler never reads
// the changing editor and its output uses a separate namespace from the live PDF.
export class MergeValidationService {
  constructor({ drafts, readIdentity, capture, compile, root, clock = Date.now }) {
    Object.assign(this, { drafts, readIdentity, capture, compile, root, clock })
  }
  current(task, identity) {
    return task.resolutionCommit === identity.commit && same(task.application?.after, identity.documents)
  }
  view(task, identity) {
    const result = publicMergeTask(task)
    if (task.state !== 'resolved' || !task.resolutionCommit) return result
    let validation = task.validation || { state: 'unchecked', commit: task.resolutionCommit }
    if (!this.current(task, identity) || (validation.identity && !same(validation.identity, identity))) {
      validation = { ...validation, state: 'stale' }
    } else if (validation.state === 'checking' && validation.deadline <= this.clock()) {
      validation = { ...validation, state: 'failed', reason: 'Validation was interrupted or timed out. Run it again.' }
    }
    const { state, commit, startedAt, finishedAt, reason, backendStatus, buildId } = validation
    return { ...result, resolutionCommit: task.resolutionCommit, validation: { state, commit, startedAt, finishedAt, reason, backendStatus, buildId } }
  }
  async list() {
    return this.drafts.workspace.withLock(async () => {
      await this.drafts.authorize()
      const tasks = (await this.drafts.store.list()).filter(t => t.workspaceId === this.drafts.workspaceId && t.logicalProjectId === this.drafts.logicalProjectId)
      if (!tasks.some(t => t.state === 'resolved')) return tasks.map(publicMergeTask)
      const identity = await this.readIdentity()
      return tasks.map(t => this.view(t, identity))
    })
  }
  async run(id, revision) {
    const job = await this.drafts.workspace.withLock(async () => {
      await this.drafts.authorize()
      let task = await this.drafts.scoped(id)
      this.drafts.assertRevision(task, revision)
      if (task.state !== 'resolved' || !task.resolutionCommit) throw refuse('Apply this merge before checking the paper')
      if (task.validation?.state === 'checking' && task.validation.deadline > this.clock()) throw refuse('This merge is already being checked')
      const captured = await this.capture()
      if (!this.current(task, captured.identity)) throw refuse('The branch or document versions changed since this merge. This merge result is stale.')
      const buildId = randomBytes(12).toString('hex')
      const bytes = Buffer.from(JSON.stringify(captured.request))
      const manifest = await writeRecoverySnapshot(Path.join(this.root, task.id, buildId), new Map([['request.json', bytes]]))
      const validation = { state: 'checking', buildId, commit: task.resolutionCommit,
        identity: captured.identity, startedAt: this.clock(), deadline: this.clock() + 10 * 60 * 1000,
        requestHash: createHash('sha256').update(bytes).digest('hex'), manifest }
      task = await this.drafts.save(task, { validation })
      return { task, captured, buildId }
    })
    let outcome
    try {
      const result = await this.compile(job.buildId, job.captured)
      const success = result.status === 'success' && result.outputFiles?.some(f => f.path === 'output.pdf')
      outcome = { state: success ? 'success' : 'failed', backendStatus: result.status || 'unknown',
        ...(!success ? { reason: 'The captured paper did not compile successfully. The merged document was not rolled back.' } : {}) }
    } catch {
      outcome = { state: 'failed', reason: 'The compiler request failed. The merged document was not rolled back; retry validation.' }
    }
    return this.drafts.workspace.withLock(async () => {
      await this.drafts.authorize()
      let task = await this.drafts.scoped(id)
      if (task.validation?.buildId !== job.buildId) throw refuse('A newer validation superseded this result')
      task = await this.drafts.save(task, { validation: { ...task.validation, ...outcome, finishedAt: this.clock() } })
      return this.view(task, await this.readIdentity())
    })
  }
}
