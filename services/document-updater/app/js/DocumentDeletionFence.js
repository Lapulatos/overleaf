const { AsyncLocalStorage } = require('node:async_hooks')
const ProjectWriteGate = require('@overleaf/redis-wrapper/ProjectWriteGate')
const operationContext = new AsyncLocalStorage()
const SERVER_GENERATION = `return string.match(redis.call('INFO', 'server'), 'run_id:([a-f0-9]+)')`

// Redis-side primitive. It must be combined with a durable reservation and
// guarded persistence reload before deletion is enabled. No public route yet.
const RESERVE = `
if ARGV[5] ~= string.match(redis.call('INFO', 'server'), 'run_id:([a-f0-9]+)') then
  return redis.error_reply('DOCUMENT_SERVER_GENERATION_CHANGED')
end
local existing = redis.call('GET', KEYS[1])
if existing then
  if existing == ARGV[1] then return 0 end
  return redis.error_reply('DOCUMENT_DELETION_FENCED')
end
if redis.call('GET', KEYS[2]) ~= ARGV[2]
  or redis.call('GET', KEYS[3]) ~= ARGV[3]
  or redis.call('GET', KEYS[4]) ~= ARGV[4]
  or redis.call('GET', KEYS[5]) ~= ARGV[6] then
  return redis.error_reply('DOCUMENT_DELETION_CONFLICT')
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`
const RETAIN_FOR_CLEANUP = `
if ARGV[3] ~= string.match(redis.call('INFO', 'server'), 'run_id:([a-f0-9]+)') then
  return redis.error_reply('DOCUMENT_SERVER_GENERATION_CHANGED')
end
local existing = redis.call('GET', KEYS[1])
local project = redis.call('GET', KEYS[2])
if (existing and existing ~= ARGV[1]) or (project and project ~= ARGV[2]) then
  return redis.error_reply('DOCUMENT_DELETION_CONFLICT')
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`
// Call only after validating the durable fenced reservation and persisted snapshot.
// Cache absence is checked atomically; this never writes document contents.
const RESERVE_MISSING_CACHE = `
if ARGV[3] ~= string.match(redis.call('INFO', 'server'), 'run_id:([a-f0-9]+)') then
  return redis.error_reply('DOCUMENT_SERVER_GENERATION_CHANGED')
end
local existing = redis.call('GET', KEYS[1])
local project = redis.call('GET', KEYS[4])
if (existing and existing ~= ARGV[1]) or (project and project ~= ARGV[2])
  or redis.call('EXISTS', KEYS[2]) == 1
  or redis.call('EXISTS', KEYS[3]) == 1
  or redis.call('EXISTS', KEYS[5]) == 1 then
  return redis.error_reply('DOCUMENT_DELETION_CONFLICT')
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`
// Read-only proof: never recreate a missing marker or evict leftover cache keys.
const INSPECT_CLEARED_CACHE = `
if ARGV[2] ~= string.match(redis.call('INFO', 'server'), 'run_id:([a-f0-9]+)') then
  return redis.error_reply('DOCUMENT_SERVER_GENERATION_CHANGED')
end
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
for i = 2, #KEYS do
  if redis.call('EXISTS', KEYS[i]) == 1 then return 0 end
end
return 1
`
const WRITE = `
if ARGV[2] ~= string.match(redis.call('INFO', 'server'), 'run_id:([a-f0-9]+)') then
  return redis.error_reply('DOCUMENT_SERVER_GENERATION_CHANGED')
end
if redis.call('EXISTS', KEYS[1]) == 1 then
  return redis.error_reply('DOCUMENT_DELETION_FENCED')
end
-- Check at the mutation boundary, not just in a preceding GET under a lease.
if ARGV[3] ~= '' and redis.call('GET', KEYS[2]) ~= ARGV[3] then
  return redis.error_reply('DOCUMENT_VERSION_CONFLICT')
end
-- A privileged request may have paused after admission while its lease expired.
-- Check its ownership in the same Redis operation that mutates the document.
if ARGV[4] ~= '' and redis.call('GET', ARGV[4]) ~= ARGV[5] then
  return redis.error_reply('PROJECT_WRITE_BUSY')
end
local commands = cjson.decode(ARGV[1])
local results = {}
for i, command in ipairs(commands) do
  results[i] = redis.call(unpack(command))
end
return results
`

function createDocumentDeletionFence(client, keys) {
  function fenceKey(docId) {
    if (typeof docId !== 'string' || !/^[a-f0-9]{24}$/.test(docId)) {
      throw new Error('Invalid deletion document')
    }
    return `${keys.docVersion({ doc_id: docId })}:deletionFence`
  }
  
  function generationFor(docId) {
    const context = operationContext.getStore()
    if (!context || context.docId !== docId) throw new Error('Missing document operation context')
    return context.generation
  }
  const api = {
    
    async withOperation(docId, checkBlocked, action) {
      fenceKey(docId)
      const existing = operationContext.getStore()
      if (existing?.docId === docId) return action()
      // Capture before the durable lookup/read. Do not refresh this token when
      // an already-started operation resumes after Redis reconnects.
      const generation = await client.eval(SERVER_GENERATION, 1, keys.docVersion({ doc_id: docId }))
      if (typeof generation !== 'string' || !/^[a-f0-9]{40}$/.test(generation)) {
        throw new Error('Invalid document server generation')
      }
      if (await checkBlocked()) throw new Error('DOCUMENT_DELETION_FENCED')
      return operationContext.run({ docId, generation }, action)
    },
    async reserve({ projectId, docId, operationId, expectedVersion, serializedLines, expectedPath }) {
      const fence = fenceKey(docId)
      if (typeof projectId !== 'string' || !/^[a-f0-9]{24}$/.test(projectId) ||
          typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId) ||
          !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
          typeof serializedLines !== 'string' ||
          typeof expectedPath !== 'string' || expectedPath.length === 0) {
        throw new Error('Invalid deletion snapshot')
      }
      return client.eval(RESERVE, 5, fence,
        keys.docVersion({ doc_id: docId }), keys.docLines({ doc_id: docId }),
        keys.projectKey({ doc_id: docId }), keys.pathname({ doc_id: docId }), operationId,
        String(expectedVersion), serializedLines, projectId, generationFor(docId), expectedPath)
    },

    // Recovery primitive only; caller must validate persisted content first.
    async reserveMissingCache({ projectId, docId, operationId }) {
      if (typeof projectId !== 'string' || !/^[a-f0-9]{24}$/.test(projectId) ||
          typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
        throw new Error('Invalid deletion recovery identity')
      }
      return client.eval(RESERVE_MISSING_CACHE, 5, fenceKey(docId),
        keys.docVersion({ doc_id: docId }), keys.docLines({ doc_id: docId }),
        keys.projectKey({ doc_id: docId }), keys.pathname({ doc_id: docId }),
        operationId, projectId, generationFor(docId))
    },

    // Caller also verifies durable reservation, history and soft-deleted storage.
    // All keys share the native document hash slot. No document is loaded here.
    async inspectClearedCache({ projectId, docId, operationId }) {
      if (typeof projectId !== 'string' || !/^[a-f0-9]{24}$/.test(projectId) ||
          typeof operationId !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(operationId)) {
        throw new Error('Invalid deletion inspection identity')
      }
      const cacheKeys = ['docLines', 'projectKey', 'docVersion', 'docHash', 'ranges', 'pathname',
        'projectHistoryId', 'unflushedTime', 'lastUpdatedAt', 'lastUpdatedBy', 'resolvedCommentIds']
        .map(name => keys[name]({ doc_id: docId }))
      const result = await client.eval(INSPECT_CLEARED_CACHE, cacheKeys.length + 1,
        fenceKey(docId), ...cacheKeys, operationId, generationFor(docId))
      return result === 1
    },

    

    // Only after verifying committed filetree/history and soft-deleted storage.
    // Re-establish a missing marker after Redis restart without reopening writes.
    async retainForCleanup({ projectId, docId, operationId }) {
      if (typeof projectId !== 'string' || !/^[a-f0-9]{24}$/.test(projectId) ||
          typeof operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
        throw new Error('Invalid deletion cleanup identity')
      }
      return client.eval(RETAIN_FOR_CLEANUP, 2, fenceKey(docId), keys.projectKey({ doc_id: docId }),
        operationId, projectId, generationFor(docId))
    },

    // Callers build the same fixed commands previously used in a doc MULTI.
    // Declare every key for Redis Cluster and reject commands outside this doc.
    // Like MULTI, runtime Redis command errors do not roll back earlier writes.
    async runWrites(docId, commands, expectedVersion) {
      if (expectedVersion !== undefined &&
          (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)) {
        throw new Error('Invalid expected document version')
      }
      const fence = fenceKey(docId)
      if (!Array.isArray(commands) || commands.length === 0) throw new Error('Missing writes')
      const allowed = new Set([
        'docLines', 'docVersion', 'docHash', 'projectKey', 'ranges', 'pathname',
        'projectHistoryId', 'resolvedCommentIds', 'docOps', 'unflushedTime',
        'lastUpdatedAt', 'lastUpdatedBy',
      ].filter(name => typeof keys[name] === 'function')
        .map(name => keys[name]({ doc_id: docId })))
      const declared = new Set([fence, keys.docVersion({ doc_id: docId })])
      const normalized = commands.map(command => {
        if (!Array.isArray(command) || command.length < 2 ||
            command.some(arg => typeof arg !== 'string')) throw new Error('Invalid write command')
        const [name, ...args] = command
        let commandKeys
        switch (name.toUpperCase()) {
          case 'MSET':
            if (args.length % 2 !== 0) throw new Error('Invalid MSET')
            commandKeys = args.filter((_, index) => index % 2 === 0)
            break
          case 'DEL': commandKeys = args; break
          case 'SET': case 'SADD': case 'SREM': case 'LTRIM': case 'RPUSH': case 'EXPIRE':
            commandKeys = [args[0]]; break
          default: throw new Error('Unsupported document write')
        }
        for (const key of commandKeys) {
          if (key === fence || !allowed.has(key)) {
            throw new Error('Write is outside the document')
          }
          declared.add(key)
        }
        return [name.toUpperCase(), ...args]
      })
      const writer = ProjectWriteGate.currentProjectWrite()
      const writeKey = ProjectWriteGate.enabled() && typeof client.nodes !== 'function' && writer?.token
        ? ProjectWriteGate.keyFor(writer.projectId) : ''
      if (writeKey) declared.add(writeKey)
      return client.eval(WRITE, declared.size, ...declared, JSON.stringify(normalized), generationFor(docId),
        expectedVersion === undefined ? '' : String(expectedVersion), writeKey, writeKey ? writer.token : '')
    },
  }
  // Minimal MULTI-compatible builder for the fixed document write commands.
  // Match ioredis scalar conversion; never execute a partially built batch.
  api.batch = (docId, expectedVersion) => {
    const commands = []
    const batch = { exec: () => api.runWrites(docId, commands, expectedVersion) }
    for (const name of ['mset', 'set', 'del', 'sadd', 'srem', 'ltrim', 'rpush', 'expire']) {
      batch[name] = (...args) => {
        if (name === 'mset' && args.length === 1 &&
            args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          args = Object.entries(args[0]).flat()
        }
        commands.push([name, ...args.map(value => value == null ? '' : String(value))])
        return batch
      }
    }
    return batch
  }
  return api
}
module.exports = { createDocumentDeletionFence }
