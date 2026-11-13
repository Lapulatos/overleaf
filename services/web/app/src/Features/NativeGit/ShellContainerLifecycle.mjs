import { createHash } from 'node:crypto'
import { taskId } from './CollaborationTaskStore.mjs'

// Canonical JSON binds retries to the exact server-selected container configuration.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
const configurationHash = configuration => createHash('sha256').update(JSON.stringify(canonical(configuration))).digest('hex')

const refuse = message => Object.assign(new Error(message), { status: 409 })
function scope(input) {
  for (const name of ['logicalProjectId', 'workspaceId', 'actorId']) {
    if (!/^[a-f0-9]{24}$/.test(input[name] || '')) throw refuse('Invalid shell container scope')
  }
  return { attemptId: taskId(input.attemptId), draftId: taskId(input.draftId), logicalProjectId: input.logicalProjectId,
    workspaceId: input.workspaceId, actorId: input.actorId }
}
export function shellContainerIdentity(input) {
  const s = scope(input)
  return { ...s, name: `overleaf-draft-${s.attemptId}`, labels: Object.fromEntries(Object.entries(s).map(([key, value]) => [`overleaf.shell.${key}`, value])) }
}

// All methods require a cross-process lock supplied by the runner. Docker calls
// must be bounded and must not retry create/start on timeout. Attach is separate
// and cannot start a container. Retain stopped containers as recovery evidence.
export class ShellContainerLifecycle {
  constructor({ store, docker, withLock, clock = Date.now }) { Object.assign(this, { store, docker, withLock, clock }) }
  async owned(input) {
    const identity = shellContainerIdentity(input)
    const record = await this.store.read(identity.attemptId)
    if (record.kind !== 'shell-container' || Object.keys(scope(input)).some(key => record[key] !== identity[key])) throw refuse('Container attempt scope mismatch')
    return { identity, record }
  }
  async save(record, updates) {
    const next = { ...record, ...updates, revision: record.revision + 1, updatedAt: this.clock() }
    await this.store.write(next)
    return next
  }
  verify(identity, container) {
    if (!container || container.Name?.replace(/^\//, '') !== identity.name ||
        Object.entries(identity.labels).some(([key, value]) => container.Config?.Labels?.[key] !== value) ||
        !container.Id || container.HostConfig?.AutoRemove !== false || container.HostConfig?.RestartPolicy?.Name !== 'no') throw refuse('Container identity or restart policy does not match the recorded attempt')
    return container
  }
  async start(input, configuration) {
    const identity = shellContainerIdentity(input)
    return this.withLock(identity.attemptId, async () => {
      // Only a missing durable record permits creation. Missing Docker state
      // for an existing attempt is uncertainty, never permission to recreate.
      let existing
      try { existing = await this.owned(input) }
      catch (error) { if (error.code !== 'ENOENT') throw error }
      const fingerprint = configurationHash(configuration)
      if (existing) {
        const { record } = existing
        if (record.configurationHash !== fingerprint) throw refuse('Shell attempt configuration changed')
        if (record.state === 'running') {
          const container = this.verify(identity, await this.docker.inspect(identity.name))
          if (container.Id !== record.containerId) throw refuse('Recorded container was replaced')
          if (container.State?.Running === true && container.State?.Restarting === false) return { attemptId: identity.attemptId, containerId: container.Id }
        }
        throw refuse('This shell attempt already exists; inspect or stop it instead of restarting')
      }
      let record = { ...identity, id: identity.attemptId, kind: 'shell-container', state: 'creating', configurationHash: fingerprint, revision: 1,
        createdAt: this.clock(), updatedAt: this.clock() }
      await this.store.write(record)
      try {
        await this.docker.create({ ...configuration, name: identity.name, labels: identity.labels, restart: 'no', autoRemove: false })
        const created = this.verify(identity, await this.docker.inspect(identity.name))
        record = await this.save(record, { state: 'starting', containerId: created.Id })
        await this.docker.start(created.Id)
        const running = this.verify(identity, await this.docker.inspect(identity.name))
        if (running.Id !== created.Id || !running.State?.StartedAt || running.State.StartedAt.startsWith('0001-')) throw refuse('Container start has not been confirmed')
        record = await this.save(record, { state: running.State.Running ? 'running' : 'exited', startedAt: running.State.StartedAt })
        return { attemptId: identity.attemptId, containerId: record.containerId }
      } catch (error) {
        await this.save(record, { state: 'uncertain', uncertainPhase: record.state, failure: 'Docker operation outcome was not confirmed; do not replay start.' })
        throw error
      }
    })
  }
  async stop(input) {
    const identity = shellContainerIdentity(input)
    return this.withLock(identity.attemptId, async () => {
      let record
      try { ({ record } = await this.owned(input)) }
      catch (error) {
        if (error.code !== 'ENOENT') throw error
        // The same attempt lock excludes an in-flight start. Missing journal
        // alone is insufficient: inspect the deterministic Docker identity.
        let found
        try { found = await this.docker.inspect(identity.name) }
        catch (inspection) {
          const absent = inspection.code === 'SHELL_CONTAINER_NOT_FOUND' ||
            (inspection.code === 1 && /no such (?:object|container)/i.test(inspection.stderr || ''))
          if (!absent) throw inspection
          await this.store.write({ ...identity, id: identity.attemptId, kind: 'shell-container', state: 'stopped', revision: 1,
            createdAt: this.clock(), stoppedAt: this.clock(), missingRecordRecovered: true })
          return { attemptId: identity.attemptId, quiescent: true }
        }
        this.verify(identity, found)
        record = { ...identity, id: identity.attemptId, kind: 'shell-container', state: 'recovered', revision: 1,
          containerId: found.Id, createdAt: this.clock(), missingRecordRecovered: true }
        await this.store.write(record)
      }
      const container = this.verify(identity, await this.docker.inspect(identity.name))
      if (record.containerId && record.containerId !== container.Id) throw refuse('Recorded container was replaced')
      // A timed-out create/start may still be in flight. Absence, or a never
      // started container, does not prove that a delayed start cannot occur.
      const started = container.State?.StartedAt && !container.State.StartedAt.startsWith('0001-')
      if (!started && record.state !== 'stopped') throw refuse('Startup remains ambiguous; quiescence cannot be confirmed')
      record = await this.save(record, { state: 'stopping', containerId: container.Id })
      await this.docker.stop(container.Id)
      const stopped = this.verify(identity, await this.docker.inspect(identity.name))
      if (stopped.Id !== container.Id || stopped.State?.Running !== false || stopped.State?.Restarting !== false ||
          !['exited', 'dead'].includes(stopped.State?.Status)) throw refuse('Container has not stopped; draft review remains unavailable')
      await this.save(record, { state: 'stopped', stoppedAt: this.clock() })
      return { attemptId: identity.attemptId, quiescent: true }
    })
  }
}
