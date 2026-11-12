const { keyFor: writeKey, current } = require('./ProjectWriteGate')
const epochKey = id => `native-git:workspace-epoch:${id}`
const stale = () => Object.assign(new Error('This editor belongs to an older workspace version; preserve pending edits and reload the workspace'), {
  status: 409, code: 'WORKSPACE_EPOCH_STALE',
})
const valid = value => Number.isSafeInteger(value) && value >= 1

// No expiry: losing this cache requires rehydration from the durable project
// epoch. Tagged clients fail closed if it is missing, never reverting to legacy.
const publishScript = `
local old = redis.call('GET', KEYS[1])
if old then
  local blocked = string.match(old, '^blocked:(%d+)$')
  if blocked and tonumber(ARGV[1]) <= tonumber(blocked) then return 0 end
  if not blocked and tonumber(old) > tonumber(ARGV[1]) then return 0 end
end
redis.call('SET', KEYS[1], ARGV[1])
return 1`
const fenceScript = `
local old = redis.call('GET', KEYS[1])
if old ~= ARGV[1] and old ~= 'blocked:' .. ARGV[1] then return 0 end
redis.call('SET', KEYS[1], 'blocked:' .. ARGV[1])
return 1`
const enqueueScript = `
if redis.call('EXISTS', KEYS[1]) == 1 then return -1 end
local epoch = redis.call('GET', KEYS[2])
if epoch then
  if epoch ~= ARGV[2] then return -2 end
elseif ARGV[2] ~= '' then return -2 end
redis.call('RPUSH', KEYS[3], ARGV[1])
return 1`
const takeScript = `
local owner = redis.call('GET', KEYS[1])
if ARGV[2] ~= '' and owner ~= ARGV[2] then return redis.error_reply('PROJECT_WRITE_BUSY: workspace write lease expired') end
if owner and owner ~= ARGV[2] then return { '{}', 0 } end
local epoch = redis.call('GET', KEYS[2])
local items = redis.call('LRANGE', KEYS[3], 0, tonumber(ARGV[1]) - 1)
local accepted = {}
local rejected = {}
for _, raw in ipairs(items) do
  local ok, value = pcall(cjson.decode, raw)
  if not ok then return redis.error_reply('Invalid pending update JSON') end
  if type(value) ~= 'table' then return redis.error_reply('Invalid pending update shape') end
  local supplied = type(value.meta) == 'table' and value.meta.workspaceEpoch
  local matches = (not epoch and not supplied) or (epoch and type(supplied) == 'number' and tostring(supplied) == epoch)
  if matches then table.insert(accepted, raw) else table.insert(rejected, raw) end
end
for _, raw in ipairs(rejected) do redis.call('RPUSH', KEYS[4], raw) end
if #items > 0 then redis.call('LTRIM', KEYS[3], #items, -1) end
return { cjson.encode(accepted), #rejected }`
function createWorkspaceEpochGate(client) {
  const supported = () => typeof client.nodes !== 'function'
  return {
    async takePending(projectId, docId, list, limit = 8) {
      if (!supported()) throw new Error('Workspace queue fencing requires non-clustered Redis')
      const recoveryKey = `native-git:rejected-updates:${projectId}:${docId}`
      const [encoded, rejected] = await client.eval(takeScript, 4, writeKey(projectId), epochKey(projectId), list, recoveryKey,
        limit, current(projectId)?.token || '')
      const values = JSON.parse(encoded)
      return { updates: Array.isArray(values) ? values.map(value => JSON.parse(value)) : [], rejected, recoveryKey }
    },
    async publish(projectId, epoch) {
      if (!supported() || !valid(epoch)) throw new Error('Workspace epoch integration is unavailable')
      if (await client.eval(publishScript, 1, epochKey(projectId), String(epoch)) !== 1) throw stale()
    },
    async fence(projectId, expected) {
      if (!supported() || !valid(expected)) throw stale()
      if (await client.eval(fenceScript, 1, epochKey(projectId), String(expected)) !== 1) throw stale()
    },
    async assertCurrent(projectId, epoch) {
      if (!supported()) { if (epoch !== undefined) throw stale(); return }
      const current = await client.get(epochKey(projectId))
      if (current === null && epoch === undefined) return
      if (!valid(epoch) || current !== String(epoch)) throw stale()
    },
    async enqueue(projectId, list, value, epoch) {
      if (!supported()) {
        if (epoch !== undefined) throw stale()
        return client.rpush(list, value)
      }
      if (epoch !== undefined && !valid(epoch)) throw stale()
      const result = await client.eval(enqueueScript, 3, writeKey(projectId), epochKey(projectId), list, value, epoch === undefined ? '' : String(epoch))
      if (result === -2) throw stale()
      if (result !== 1) throw Object.assign(new Error('Project files are being updated by Git; retry after the update finishes'), { status: 409, code: 'PROJECT_WRITE_BUSY' })
    },
  }
}
function assertSessionEpoch(expected, received) {
  if (expected === undefined && received === undefined) return
  if (!valid(expected) || expected !== received) throw stale()
}
module.exports = { createWorkspaceEpochGate, epochKey, assertSessionEpoch }
