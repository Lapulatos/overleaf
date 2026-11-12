// Legacy project deletion has no branch cascade or backup retention receipt.
// Check in the service as well as HTTP routes: account removal and expiration
// jobs call ProjectDeleter directly. There is deliberately no caller bypass flag.
export async function assertLegacyDeletionAllowed(project, hasChildren) {
  if (!project) return
  const protectedState = project.gitWorkspaceEnabled === true ||
    Boolean(project.gitWorkspace?.logicalProjectId) ||
    Boolean(project.gitBackupRestore?.operationId)
  if (protectedState || await hasChildren(String(project._id))) {
    throw Object.assign(new Error(
      'This paper has branch workspace or restored backup data. Keep it archived until reviewed project deletion can retain and remove all related data safely.'
    ), { code: 'GIT_PROJECT_RETENTION_REQUIRED', status: 409 })
  }
}
