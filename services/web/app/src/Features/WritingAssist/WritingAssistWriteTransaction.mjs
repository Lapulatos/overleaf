import { assertWorkspaceIdentity } from './WritingAssistWorkspaceIdentity.mjs'

// The preparation adapter owns the structure lock and propagates its write
// token to document-updater requests through ProjectWriteGate's async context.
export function createAgentWriteTransaction({ readIdentity, withProjectLock, withPreparedWrite, authorize }) {
  return async (userId, projectId, expected, action) => {
    await authorize(userId, projectId)
    const current = await readIdentity(projectId)
    assertWorkspaceIdentity(expected, current)
    if (!current) return action(async () => {})
    return withProjectLock(current.projectId, async () => {
      const check = async () => {
        await authorize(userId, projectId)
        assertWorkspaceIdentity(expected, await readIdentity(projectId))
      }
      await check()
      let actionReturned = false
      try {
        return await withPreparedWrite(projectId, expected.epoch, async assertLease => {
          let active = true
          const assertActive = async () => {
            if (!active) throw new Error('AI write transaction is no longer active')
            await assertLease()
            await check()
            await assertLease()
          }
          try {
            await assertActive()
            const result = await action(assertActive)
            actionReturned = true
            await assertActive()
            return result
          } finally { active = false }
        })
      } catch (error) {
        if (actionReturned) throw Object.assign(new Error('AI write completed but transaction release could not be confirmed', { cause: error }), {
          status: 502, code: 'AI_WRITE_OUTCOME_UNCERTAIN',
        })
        throw error
      }
    })
  }
}
