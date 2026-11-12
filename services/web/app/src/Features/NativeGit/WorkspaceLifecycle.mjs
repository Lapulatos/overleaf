// Archive is reversible retention, never deletion of documents, history or Git.
export async function changeWorkspaceLifecycle({ workspaceId, expectedState, action, read, authorize, lock, exclusive, epoch, save, blocked, flush }) {
  if (!['archive', 'restore'].includes(action)) throw Object.assign(Error('Invalid lifecycle action'), { status: 400 })
  return lock(async () => {
    await authorize()
    const workspace = await read(workspaceId)
    const desired = action === 'archive' ? 'archived' : 'ready'
    if (!workspace || workspace.state !== expectedState || !['ready', 'archived'].includes(workspace.state)) {
      throw Object.assign(Error('Workspace state changed; reload the workspace list'), { status: 409 })
    }
    if (workspace.state === desired) return workspace
    if (await blocked(workspaceId)) throw Object.assign(Error('Finish pending merge, Shell or recovery tasks before changing workspace lifecycle'), { status: 409 })
    return exclusive(workspaceId, async (assertActive, preparation) => {
      await authorize(); await assertActive()
      // Old tabs and delayed writes cannot use their pre-archive epoch after
      // restoration. A failed database update is safe to retry with a new epoch.
      await flush(workspaceId)
      const adapter = epoch(workspaceId)
      if (preparation?.advanceEpoch) await preparation.advanceEpoch()
      else await adapter.advance(await adapter.read())
      await assertActive()
      const result = await save(workspaceId, expectedState, desired)
      if (!result) throw Object.assign(Error('Workspace state changed; reload'), { status: 409 })
      return { ...workspace, state: desired }
    })
  })
}
