import Path from 'node:path'
import { taskId } from './CollaborationTaskStore.mjs'
import { writeRecoverySnapshot, readRecoverySnapshot } from './RecoverySnapshots.mjs'

const conflict = message => Object.assign(new Error(message), { status: 409 })

// Internal service only. The authenticated runtime must supply the repository
// lock, actual exclusive project write lease and a queue-draining project read.
// Use a dedicated task store: these records are not merge tasks.
export function createSessionRecoveryService({ projectId, store, snapshotsDirectory,
  withLock, withExclusiveWrite, readSnapshot, epoch, recoverMembership, notify, beforeResolve = async () => {} }) {
  return async function recover(operationId) {
    const id = taskId(operationId)
    let advancedEpoch
    try {
      return await withLock(async () => withExclusiveWrite(async ({ assertActive, writeToken }) => {
        await assertActive()
        const pending = (await store.list()).filter(task => task.state !== 'resolved')
        if (pending.some(task => task.id !== id)) throw conflict('Resume the existing session recovery first')
        let task
        try { task = await store.read(id) } catch (error) { if (error.code !== 'ENOENT') throw error }
        if (task && (task.projectId !== projectId || task.kind !== 'session-recovery')) throw conflict('Session recovery scope changed')
        if (task?.state === 'resolved') return task
        const current = await epoch.read()
        if (!task) {
          task = { id, projectId, kind: 'session-recovery', revision: 1, epoch: current,
            nextEpoch: current + 1, state: 'pending', phase: 'created' }
          if (!Number.isSafeInteger(task.nextEpoch)) throw conflict('Workspace epoch exhausted')
          await store.write(task)
        }
        const save = async fields => {
          task = { ...task, ...fields, revision: task.revision + 1 }
          await store.write(task)
        }
        if (current !== task.epoch && current !== task.nextEpoch) throw conflict('Workspace advanced beyond this recovery')
        if (current === task.epoch) {
          // A previous attempt may have released its lease before fencing. Read
          // again so edits accepted since that attempt are included as well.
          const snapshot = await readSnapshot()
          await assertActive()
          const snapshotRevision = task.revision + 1
          const directory = Path.join(snapshotsDirectory, id, String(snapshotRevision))
          const manifest = await writeRecoverySnapshot(directory, snapshot.files)
          await save({ phase: 'snapshot-saved', manifest, snapshotRevision,
            entries: [...snapshot.entries], folders: [...snapshot.folders] })
          await assertActive()
          advancedEpoch = await epoch.advance(task.epoch)
        } else {
          if (!task.manifest || !Number.isSafeInteger(task.snapshotRevision) || task.snapshotRevision < 1) throw conflict('Advanced recovery has no durable snapshot')
          await readRecoverySnapshot(Path.join(snapshotsDirectory, id, String(task.snapshotRevision)), task.manifest)
          advancedEpoch = current
          // Repairs a publish failure after the durable database CAS, without
          // advancing the database twice or restoring an older generation.
          await epoch.hydrate()
        }
        await assertActive()
        await recoverMembership({ epoch: task.epoch, nextEpoch: task.nextEpoch, writeToken })
        await assertActive()
        await beforeResolve(task)
        await assertActive()
        await save({ phase: 'membership-rebuilt', state: 'resolved' })
        return task
      }))
    } finally {
      // Outside the write lease: old clients keep their local buffers and must
      // reload. Repeated notifications are safe for the epoch-aware listener.
      if (advancedEpoch !== undefined) await notify(advancedEpoch)
    }
  }
}
