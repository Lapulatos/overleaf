const { AsyncLocalStorage } = require('node:async_hooks')
const { randomUUID } = require('node:crypto')

const context = new AsyncLocalStorage()
const keyFor = projectId => `native-git:project-write:${projectId}`
const releaseScript = 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end'
const renewScript = 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE",KEYS[1],ARGV[2]) else return 0 end'
const enqueueScript = 'if redis.call("EXISTS",KEYS[1]) == 1 then return 0 end; redis.call("RPUSH",KEYS[2],ARGV[1]); return 1'
const enabled = () => process.env.OVERLEAF_NATIVE_GIT_ENABLED === 'true'
const supported = client => enabled() && typeof client.nodes !== 'function'
const conflict = () => Object.assign(new Error('Project files are being updated by Git; retry after the update finishes'), { status: 409, code: 'PROJECT_WRITE_BUSY' })

function currentProjectWrite() { return context.getStore() }
function current(projectId) {
  const value = context.getStore()
  return value?.projectId === String(projectId) ? value : undefined
}
function runWithToken(projectId, token, action, structureLocked = false, assertWrite) {
  if (!/^[a-f0-9-]{36}$/i.test(token || '')) throw conflict()
  return context.run({ projectId: String(projectId), token, structureLocked, assertWrite }, action)
}
function requestHeaders(projectId) {
  const token = current(projectId)?.token
  return token ? { 'X-Project-Write-Token': token } : {}
}

function createProjectWriteGate(client, { isEnabled = enabled, ttlMs = 120000, maxDurationMs = 300000 } = {}) {
  const active = () => isEnabled() && typeof client.nodes !== 'function'
  return {
    supported: active,
    async assertWrite(projectId) {
      if (!active()) return
      const stored = await client.get(keyFor(projectId))
      const token = current(projectId)?.token
      // A stale privileged request must also fail when its lease has vanished.
      if (token ? stored !== token : stored !== null) throw conflict()
    },
    async withWriter(projectId, action) {
      await this.assertWrite(projectId)
      return action()
    },
    async enqueue(projectId, listKey, value) {
      if (!active()) return client.rpush(listKey, value)
      if (await client.eval(enqueueScript, 2, keyFor(projectId), listKey, value) !== 1) throw conflict()
    },
    async withExclusive(projectId, action) {
      if (!active()) throw Object.assign(new Error('Project write integration is disabled or Redis Cluster is unsupported'), { status: 503 })
      const key = keyFor(projectId)
      const token = randomUUID()
      if (await client.set(key, token, 'PX', ttlMs, 'NX') !== 'OK') throw conflict()
      let renewalError
      let renewing = false
      const renew = setInterval(async () => {
        if (renewing) return
        renewing = true
        try {
          if (await client.eval(renewScript, 1, key, token, ttlMs) !== 1) renewalError = conflict()
        } catch (error) { renewalError = error }
        finally { renewing = false }
      }, Math.max(20, Math.floor(ttlMs / 3)))
      // The platform structure lock is longer than this deadline. Once expired,
      // token-bearing document requests fail instead of writing after the lease.
      const deadline = setTimeout(() => {
        renewalError = conflict()
        clearInterval(renew)
        client.eval(releaseScript, 1, key, token).catch(() => {})
      }, maxDurationMs)
      renew.unref?.()
      deadline.unref?.()
      try {
        return await runWithToken(projectId, token, async () => {
          const result = await action()
          if (renewalError) throw renewalError
          await this.assertWrite(projectId)
          return result
        }, true, () => this.assertWrite(projectId))
      } finally {
        clearInterval(renew)
        clearTimeout(deadline)
        await client.eval(releaseScript, 1, key, token)
      }
    },
  }
}

module.exports = { createProjectWriteGate, currentProjectWrite, current, runWithToken, requestHeaders, enabled, supported, keyFor }
