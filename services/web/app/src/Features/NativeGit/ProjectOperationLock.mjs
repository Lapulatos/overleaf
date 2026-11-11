// Translate only acquisition failures: an operation's own timeout must remain
// distinguishable because the Git command may already have changed repository state.
export async function withProjectOperationLock(locks, namespace, projectId, action) {
  let acquired = false
  try {
    return await locks.promises.runWithLock(namespace, projectId, async () => {
      acquired = true
      return action()
    })
  } catch (error) {
    if (!acquired && error?.message === 'Timeout') {
      throw Object.assign(new Error('Another Git or project operation is still running. Wait a moment, then refresh repository status.', { cause: error }), {
        status: 503, code: 'GIT_PROJECT_BUSY', retryAfter: 2,
      })
    }
    throw error
  }
}
