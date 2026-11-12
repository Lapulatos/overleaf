import { assertStorageCapacity } from './StorageCapacity.mjs'
import { writeRecoverySnapshot } from './RecoverySnapshots.mjs'
import Path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { readWorktree, writeWorktree, fileChanges } from './WorktreeFiles.mjs'
import { snapshotIdentity } from './MergeDraftService.mjs'

const refuse = message => Object.assign(new Error(message), { status: 409 })

// Intentionally separate from preparation. Application requires a live document
// transaction and an epoch adapter; neither may be supplied by an HTTP client.
export class MergeApplicationService {
  constructor({ drafts, readEpoch, advanceEpoch, author }) {
    Object.assign(this, { drafts, readEpoch, advanceEpoch, author })
  }
  async apply(id, { revision, sessionId, generation, fastForwardOnly = false }) {
    const { drafts } = this
    const { workspace, repository } = drafts
    return workspace.withLock(async () => {
      let task = await drafts.scoped(id)
      drafts.assertRevision(task, revision)
      drafts.assertLease(task, sessionId, generation)
      if (task.state !== 'ready-to-apply' || task.remainingPaths.length) throw refuse('Resolve every conflict before applying')
      if (!Number.isSafeInteger(task.workspaceEpoch) || typeof this.readEpoch !== 'function' || typeof this.advanceEpoch !== 'function') {
        throw refuse('Workspace epoch integration is required before applying')
      }
      if (typeof workspace.project.transaction !== 'function') throw refuse('Exclusive document transactions are required')
      await drafts.validateTargetLocked(id)
      const draft = await repository.openWorktree(task.directory)
      const status = await draft.status()
      if (status.conflicted.length || await draft.head() !== task.localOid) throw refuse('The merge draft changed')
      const tree = (await draft.git.raw(['write-tree'])).trim()
      const mergedFiles = await readWorktree(draft.directory)
      const tracked = (await draft.git.raw(['ls-files', '--cached', '-z'])).split('\0').filter(Boolean)
      if (tracked.length !== mergedFiles.size || tracked.some(path => !mergedFiles.has(path))) {
        throw refuse('The draft contains files outside its staged tree')
      }
      // Only staged results are applicable. Unstaged/untracked draft content
      // must never silently become part of the collaborative document transfer.
      if (status.files.some(file => file.workingTree !== ' ' && file.workingTree !== '')) throw refuse('Stage all draft changes before applying')
      const identity = ['-c', `user.name=${this.author.name}`, '-c', `user.email=${this.author.email}`]
      const parents = task.localOid === task.remoteOid ? ['-p', task.localOid] : ['-p', task.localOid, '-p', task.remoteOid]
      let commit
      if (fastForwardOnly) {
        const excluded = (await draft.git.raw(['rev-list', '--count', task.localOid, `^${task.remoteOid}`])).trim()
        const remoteTree = (await draft.git.raw(['rev-parse', `${task.remoteOid}^{tree}`])).trim()
        if (excluded !== '0' || tree !== remoteTree) throw refuse('Automatic pull requires an unchanged fast-forward result')
        commit = task.remoteOid
      } else {
        commit = (await draft.git.raw([...identity, 'commit-tree', tree, ...parents, '-m', `Merge ${task.sourceRef} into ${task.targetBranch}`])).trim()
      }
      const directory = Path.join(task.directory, '..', `merge-transfer-${task.id}`)
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await workspace.project.transaction(async tx => {
        const before = await tx.read()
        if (JSON.stringify(snapshotIdentity(before)) !== JSON.stringify(task.baseline) || await this.readEpoch() !== task.workspaceEpoch) {
          throw refuse('Workspace changed before application; prepare a new preview')
        }
        // Retain both snapshots plus the eventual working-tree replacement.
        await assertStorageCapacity(directory, [before.files, mergedFiles, mergedFiles])
        const bindingForCapacity = await workspace.store.read()
        const currentForCapacity = await workspace.current(bindingForCapacity)
        await assertStorageCapacity(currentForCapacity.directory, [mergedFiles])
        const beforeManifest = await writeRecoverySnapshot(Path.join(directory, 'before'), before.files)
        const afterManifest = await writeRecoverySnapshot(Path.join(directory, 'after'), mergedFiles)
        const changes = fileChanges(before.files, mergedFiles)
        task = await drafts.save(task, { state: 'applying', application: {
          phase: 'prepared', commit, tree, directory, expectedEpoch: task.workspaceEpoch,
          steps: changes.length, completedSteps: 0, beforeManifest, afterManifest,
          checkpoint: snapshotIdentity(before),
        } })
        // Block exports as well as another Git mutation until all document/ref
        // phases complete. A crash preserves this block for explicit recovery.
        await workspace.store.beginMutation(task.id)
        try {
          const savePhase = async updates => {
            await tx.assertActive()
            task = await drafts.save(task, { application: { ...task.application, ...updates } })
          }
          drafts.assertLease(task, sessionId, generation)
          await tx.apply(changes, before, async event => {
            drafts.assertLease(task, sessionId, generation)
            await savePhase({ phase: event.phase === 'before' ? 'writing-document' : 'document-written',
              path: event.path, step: event.step, completedSteps: event.step + (event.phase === 'after' ? 1 : 0),
              ...(event.phase === 'after' ? { checkpoint: snapshotIdentity(await tx.read()) } : {}) })
          })
          const after = await tx.read()
          await savePhase({ phase: 'documents-applied', after: snapshotIdentity(after) })
          drafts.assertLease(task, sessionId, generation)
          await tx.assertActive()
          if (typeof tx.advanceEpoch !== 'function') throw refuse('Prepared application epoch advancement is required')
          await tx.advanceEpoch()
          await savePhase({ phase: 'epoch-advanced' })
          const binding = await workspace.store.read()
          const current = await workspace.current(binding)
          await tx.assertActive()
          await current.git.raw(['update-ref', `refs/heads/${task.targetBranch}`, commit, task.localOid])
          await savePhase({ phase: 'ref-updated' })
          await current.git.raw(['read-tree', '--reset', tree])
          await tx.assertActive()
          await writeWorktree(current.directory, mergedFiles)
          await savePhase({ phase: 'worktree-updated' })
          return task
        } catch (error) {
          // Never restore a before-image automatically: a lost lease may have
          // admitted newer edits. Recovery must compare the journal and live IDs.
          task = await drafts.save(task, { state: 'recovery-required', failure: 'Merge application stopped; retained document snapshots and journal require reconciliation.' })
          throw error
        }
      }, { prepare: true, epoch: task.workspaceEpoch }).catch(async error => {
        // Includes failure of the transaction's final lease assertion, after
        // its callback returned. Do not report a resolved task in that case.
        if (task.application) task = await drafts.save(task, { state: 'recovery-required', failure: 'Merge transaction did not finish; reconcile retained snapshots and journal.' })
        throw error
      })
      task = await drafts.save(task, { state: 'resolved', lease: null,
        application: { ...task.application, phase: 'complete' }, resolutionCommit: commit })
      await workspace.store.finishMutation(task.id)
      return task
    })
  }
}
