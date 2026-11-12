// A socket-bound coordinator. Browser payloads never supply user/workspace/ref
// identity. resolvePosition must recheck named membership and resolve Git OIDs.
export function createGitPresenceSession({ sessionId, userId, workspaceId,
  resolvePosition, store, subscribe, unsubscribe, publish }) {
  let sequence = 0
  let active = true
  let project
  let joined = false
  let joining
  const current = value => active && value === sequence
  async function close() {
    if (!active) return
    active = false
    ++sequence
    if (joining) await joining.catch(() => {})
    if (project) {
      try { await publish(project, await store.leave(project, sessionId)) }
      finally { if (joined) { joined = false; await unsubscribe(project) } }
    }
  }
  async function update(intent = {}) {
    if (!active) throw new Error('Git presence session is closed')
    if (!intent || typeof intent !== 'object' || Array.isArray(intent) ||
        Object.keys(intent).some(key => key !== 'viewedCommit') ||
        (intent.viewedCommit !== undefined && intent.viewedCommit !== null &&
         (typeof intent.viewedCommit !== 'string' || !/^[a-f0-9]{40,64}$/.test(intent.viewedCommit)))) {
      throw new Error('Invalid Git viewing intent')
    }
    const request = ++sequence
    let position
    try { position = await resolvePosition({ userId, workspaceId, viewedCommit: intent.viewedCommit ?? null }) }
    catch (error) {
      // A permanent denial invalidates the entire socket, including newer
      // asynchronous requests. Transient infrastructure errors expire normally.
      if (error.status === 403 || error.status === 404) await close()
      throw error
    }
    if (!current(request)) return null
    if (!position || position.userId !== userId || position.workspaceId !== workspaceId ||
        !/^[a-f0-9]{24}$/i.test(position.logicalProjectId || '') ||
        (project && project !== position.logicalProjectId)) {
      await close()
      throw new Error('Git presence identity changed')
    }
    project = position.logicalProjectId
    // Establish subscription before reading the authoritative snapshot so
    // changes in that interval are either delivered or included in the snapshot.
    if (!joined) {
      if (!joining) joining = Promise.resolve().then(() => subscribe(project)).then(() => { joined = true })
      try { await joining } finally { joining = undefined }
    }
    if (!current(request)) return null
    const result = await store.update(project, { ...position, sessionId, sequence: request })
    // Disconnect can race Redis. close() writes a tombstone, so either order
    // leaves this session offline. Never publish a captured older snapshot.
    if (!current(request)) return null
    await publish(project, result)
    if (!current(request)) return null
    return store.snapshot(project)
  }
  return { update, close }
}
