import WorkspaceEpochGate from '@overleaf/redis-wrapper/WorkspaceEpochGate.js'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import { Project } from '../../models/Project.mjs'
import { createWorkspaceEpoch } from './WorkspaceEpoch.mjs'

const gate = WorkspaceEpochGate.createWorkspaceEpochGate(RedisWrapper.client('documentupdater'))
export function workspaceEpochAdapter(projectId) {
  return createWorkspaceEpoch({
    readRecord: async () => {
      const project = await Project.findById(projectId).select('gitWorkspaceFenceEnabled gitWorkspaceEpoch gitProjectDeletion').lean().exec()
      if (project?.gitProjectDeletion) throw Object.assign(Error('Project deletion is in progress'), { status: 409 })
      return project && { enabled: project.gitWorkspaceFenceEnabled, epoch: project.gitWorkspaceEpoch }
    },
    compareAndSwap: async (expected, next) => {
      const result = await Project.updateOne({ _id: projectId, gitWorkspaceFenceEnabled: true, gitWorkspaceEpoch: expected },
        { $set: { gitWorkspaceEpoch: next } })
      return result.modifiedCount === 1
    },
    publish: epoch => gate.publish(projectId, epoch),
    fence: epoch => gate.fence(projectId, epoch),
  })
}
