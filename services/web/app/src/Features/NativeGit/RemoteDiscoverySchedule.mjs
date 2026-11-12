import { randomUUID } from 'node:crypto'
export const discoveryScheduleId = '00000000-0000-4000-8000-000000000001'
export async function readDiscoverySchedule(store) {
  try { return await store.read(discoveryScheduleId) }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null }
}
export function publicDiscoverySchedule(policy) {
  if (!policy) return { enabled: false, revision: 0 }
  const { enabled, revision, remote, intervalMs, state, nextAt, lastCompletedAt, failures, operationId } = policy
  return { enabled, revision, remote, intervalMs, state, nextAt, lastCompletedAt, failures, operationId }
}
// withLock is the same logical-project repository lock used by manual Git.
export async function configureDiscoverySchedule({ store, withLock, authorize, remoteUrl, ownerId, command, now = Date.now }) {
  return withLock(async repo => {
    await authorize(ownerId)
    const current = await readDiscoverySchedule(store)
    if ((current?.revision || 0) !== command.revision) throw Object.assign(Error('Discovery schedule changed; refresh before saving'), { status: 409 })
    if (!Number.isSafeInteger(command.intervalMs) || command.intervalMs < 60000 || command.intervalMs > 86400000) throw Object.assign(Error('Invalid discovery interval'), { status: 400 })
    const url = command.enabled ? await remoteUrl(repo, command.remote) : current?.url
    if (current?.operationId && (current.ownerId !== ownerId || current.remote !== command.remote || (command.enabled && current.url !== url))) {
      throw Object.assign(Error('Retry the retained discovery against its original owner and remote before changing targets'), { status: 409 })
    }
    const policy = { id: discoveryScheduleId, kind: 'remote-discovery-schedule', revision: (current?.revision || 0) + 1,
      enabled: command.enabled, remote: command.remote, intervalMs: command.intervalMs,
      ownerId, url, state: command.enabled ? 'scheduled' : 'disabled', nextAt: now(), failures: 0,
      operationId: current?.operationId || null, createdAt: current?.createdAt || new Date(now()).toISOString() }
    await authorize(ownerId)
    await store.write(policy)
    return publicDiscoverySchedule(policy)
  })
}
export async function runDueDiscovery({ store, withLock, authorize, remoteUrl, discover, now = Date.now }) {
  return withLock(async repo => {
    let policy = await readDiscoverySchedule(store)
    if (!policy?.enabled || policy.state === 'paused' || policy.nextAt > now()) return null
    try {
      await authorize(policy.ownerId)
      if (await remoteUrl(repo, policy.remote) !== policy.url) throw Object.assign(Error('Scheduled remote target changed'), { status: 409 })
      // Keep the same ID after interrupted/failed fetch, including process death.
      policy = { ...policy, operationId: policy.operationId || randomUUID(), state: 'running', revision: policy.revision + 1 }
      await store.write(policy)
      const result = await discover(repo, policy, () => authorize(policy.ownerId))
      await authorize(policy.ownerId)
      policy = { ...policy, state: 'scheduled', revision: policy.revision + 1, failures: 0,
        operationId: null, nextAt: now() + policy.intervalMs, lastCompletedAt: new Date(now()).toISOString() }
      await store.write(policy)
      return { policy: publicDiscoverySchedule(policy), result }
    } catch (error) {
      const paused = [400, 401, 403, 409].includes(error.status || error.statusCode)
      policy = { ...policy, state: paused ? 'paused' : 'retrying', revision: policy.revision + 1,
        failures: (policy.failures || 0) + 1,
        nextAt: now() + Math.min(3600000, 60000 * 2 ** Math.min(policy.failures || 0, 6)) }
      // Raw errors may contain server paths or authentication data; expose state
      // only. An administrator must review/re-enable a paused policy explicitly.
      await store.write(policy)
      return { policy: publicDiscoverySchedule(policy), failed: true }
    }
  })
}
