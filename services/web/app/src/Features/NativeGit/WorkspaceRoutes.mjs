import { assertLegacyDeletionAllowed } from './DeletionRetentionGuard.mjs'
import { Project } from '../../models/Project.mjs'
import { resolveWorkspaceScope } from './WorkspaceScope.mjs'

// Project-control operations must not act on an internal storage Project.
// Archive/trash are per-user list preferences on the logical project. They
// retain all child storage; permanent deletion still needs a cascading receipt.
const controls = /^\/(?:archive|trash|restore|clone|rename|invite|users|members|leave|transfer|tokens|sharing)(?:\/|$)/i
export async function guardWorkspaceControls(req, res, next) {
  const id = req.params.workspaceProjectId
  if (!/^[a-f0-9]{24}$/i.test(id)) return next()
  const destructive = req.method === 'DELETE' && (req.path === '/' || req.path === '')
  if (!destructive && !controls.test(req.path)) return next()
  const project = await Project.findById(id).select('gitWorkspace gitWorkspaceEnabled gitBackupRestore').lean().exec()
  if (project?.gitWorkspace?.logicalProjectId) {
    return res.status(409).json({ error: 'Manage members and project lifecycle from the logical paper project.' })
  }
  // POST /restore only clears the logical project's archived flag. It does
  // not restore deleted storage or replace documents, so children are safe.
  if (destructive) {
    try {
      await assertLegacyDeletionAllowed(project, parentId =>
        Project.exists({ 'gitWorkspace.logicalProjectId': parentId })
      )
    } catch (error) {
      if (error.code !== 'GIT_PROJECT_RETENTION_REQUIRED') throw error
      return res.status(409).json({ error: error.message, code: error.code })
    }
  }
  next()
}

export async function resolveWorkspaceEditor(req, res, next) {
  const parent = req.params.Project_id
  const id = req.params.workspaceId
  if (!/^[a-f0-9]{24}$/i.test(id)) return res.sendStatus(404)
  const scope = await resolveWorkspaceScope(id)
  if (!scope.internal || scope.logicalProjectId !== parent || scope.state !== 'ready') return res.sendStatus(404)
  req.params.Project_id = scope.storageProjectId
  next()
}
