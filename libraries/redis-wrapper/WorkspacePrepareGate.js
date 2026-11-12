// A preparation token is not a project write lease. The runtime must capture
// authoritative session membership and close join admission before begin(),
// then acquire ProjectWriteGate and revalidate snapshots before application.
const keyFor = project => `native-git:workspace-prepare:${project}`
const sessionsKey = project => `native-git:workspace-sessions:${project}`
const clock = `local t = redis.call('TIME'); local now = tonumber(t[1])*1000 + math.floor(tonumber(t[2])/1000)`
const beginScript = `${clock}
local old = redis.call('GET', KEYS[1])
if old then
 local previous = cjson.decode(old)
 if previous.deadline > now then return redis.error_reply('WORKSPACE_PREPARE_BUSY') end
end
local value = cjson.decode(ARGV[1])
value.deadline = now + tonumber(ARGV[2])
redis.call('SET', KEYS[1], cjson.encode(value))
return cjson.encode(value)`
const initializeScript = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
local epoch = redis.call('HGET', KEYS[1], '__epoch')
if epoch and epoch ~= ARGV[1] then return redis.error_reply('WORKSPACE_MEMBERSHIP_REINITIALIZATION_REQUIRED') end
redis.call('HSET', KEYS[1], '__epoch', ARGV[1]); return 1`
const registerScript = `${clock}
if redis.call('HGET', KEYS[2], '__epoch') ~= ARGV[1] or redis.call('GET', KEYS[3]) ~= ARGV[1] then return redis.error_reply('WORKSPACE_MEMBERSHIP_UNAVAILABLE') end
local raw = redis.call('GET', KEYS[1])
if raw and cjson.decode(raw).deadline > now then return redis.error_reply('WORKSPACE_PREPARE_BUSY') end
redis.call('HSET', KEYS[2], ARGV[2], ARGV[1]); return 1`
const registeredBeginScript = `${clock}
if redis.call('HGET', KEYS[2], '__epoch') ~= ARGV[2] or redis.call('GET', KEYS[3]) ~= ARGV[2] then return redis.error_reply('WORKSPACE_MEMBERSHIP_UNAVAILABLE') end
local old = redis.call('GET', KEYS[1])
if old and cjson.decode(old).deadline > now then return redis.error_reply('WORKSPACE_PREPARE_BUSY') end
local entries = redis.call('HGETALL', KEYS[2])
if #entries > 2002 then return redis.error_reply('WORKSPACE_MEMBERSHIP_LIMIT') end
local members = {}
for i=1,#entries,2 do
 if entries[i] ~= '__epoch' then
  if entries[i+1] ~= ARGV[2] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
  members[entries[i]] = 'pending'
 end
end
local value = { id=ARGV[1], epoch=tonumber(ARGV[2]), state='waiting', registered=true, deadline=now+tonumber(ARGV[3]), members=members }
redis.call('SET', KEYS[1], cjson.encode(value)); return cjson.encode(value)`
const leaveScript = `
redis.call('HDEL', KEYS[2], ARGV[1])
local raw = redis.call('GET', KEYS[1])
if raw then
 local value = cjson.decode(raw)
 if value.members[ARGV[1]] ~= nil then
  value.members[ARGV[1]] = 'failed'
  redis.call('SET', KEYS[1], cjson.encode(value))
 end
end
return 1`
const updateScript = `${clock}
local raw = redis.call('GET', KEYS[1])
if not raw then return redis.error_reply('WORKSPACE_PREPARE_MISSING') end
local value = cjson.decode(raw)
if value.id ~= ARGV[1] or tostring(value.epoch) ~= ARGV[2] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
if value.deadline <= now then return redis.error_reply('WORKSPACE_PREPARE_EXPIRED') end
if value.state ~= 'waiting' and not (value.state == 'claimed' and ARGV[4] == 'failed') then return redis.error_reply('WORKSPACE_PREPARE_CLOSED') end
if value.members[ARGV[3]] == nil then return redis.error_reply('WORKSPACE_PREPARE_NOT_MEMBER') end
-- A negative acknowledgement is sticky; duplicate success cannot erase it.
if ARGV[4] ~= 'saved' then value.members[ARGV[3]] = 'failed'
elseif value.members[ARGV[3]] ~= 'failed' then value.members[ARGV[3]] = 'saved' end
redis.call('SET', KEYS[1], cjson.encode(value))
return cjson.encode(value)`
const claimScript = `${clock}
local raw = redis.call('GET', KEYS[1])
if not raw then return redis.error_reply('WORKSPACE_PREPARE_MISSING') end
local value = cjson.decode(raw)
if value.id ~= ARGV[1] or tostring(value.epoch) ~= ARGV[2] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
if value.deadline <= now then return redis.error_reply('WORKSPACE_PREPARE_EXPIRED') end
if value.state ~= ARGV[3] then return redis.error_reply('WORKSPACE_PREPARE_CLOSED') end
local admittedEpoch = tostring(value.advancedEpoch or value.epoch)
if value.registered and redis.call('GET',KEYS[3]) ~= admittedEpoch then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
if value.registered and redis.call('HGET',KEYS[2],'__epoch') ~= admittedEpoch then return redis.error_reply('WORKSPACE_MEMBERSHIP_UNAVAILABLE') end
for _, state in pairs(value.members) do
 if state ~= 'saved' then return redis.error_reply('WORKSPACE_PREPARE_NOT_READY') end
end
value.state = 'claimed'
redis.call('SET', KEYS[1], cjson.encode(value))
return cjson.encode(value)`
// Only after durable epoch advancement, under the same exclusive write lease.
// Old sockets retain their old epoch and cannot enqueue into the new workspace.
const advanceMembershipScript = `${clock}
local raw = redis.call('GET', KEYS[1])
if not raw then return redis.error_reply('WORKSPACE_PREPARE_MISSING') end
local value = cjson.decode(raw)
if value.id ~= ARGV[1] or tostring(value.epoch) ~= ARGV[2] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
if value.deadline <= now then return redis.error_reply('WORKSPACE_PREPARE_EXPIRED') end
if value.state ~= 'claimed' or not value.registered then return redis.error_reply('WORKSPACE_PREPARE_CLOSED') end
if redis.call('GET',KEYS[3]) ~= ARGV[3] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
if value.advancedEpoch then
 if tostring(value.advancedEpoch) ~= ARGV[3] or redis.call('HGET',KEYS[2],'__epoch') ~= ARGV[3] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
 return cjson.encode(value)
end
if redis.call('HGET',KEYS[2],'__epoch') ~= ARGV[2] then return redis.error_reply('WORKSPACE_MEMBERSHIP_UNAVAILABLE') end
for _, state in pairs(value.members) do
 if state ~= 'saved' then return redis.error_reply('WORKSPACE_PREPARE_NOT_READY') end
end
redis.call('DEL',KEYS[2])
redis.call('HSET',KEYS[2],'__epoch',ARGV[3])
value.advancedEpoch = tonumber(ARGV[3])
redis.call('SET',KEYS[1],cjson.encode(value))
return cjson.encode(value)`
// Recovery is distinct from normal preparation: a dead worker cannot acknowledge.
// The caller must first drain and durably snapshot accepted edits, then advance
// the authoritative epoch under the exclusive project write lease. Redis checks
// that same lease atomically; an expired privileged request cannot reset members.
const recoverMembershipScript = `
if redis.call('GET',KEYS[4]) ~= ARGV[3] then return redis.error_reply('PROJECT_WRITE_BUSY') end
if redis.call('GET',KEYS[3]) ~= ARGV[2] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
local epoch = redis.call('HGET',KEYS[2],'__epoch')
-- A retry must preserve sessions that have already joined the new generation.
if epoch == ARGV[2] then return 0 end
if epoch and epoch ~= ARGV[1] then return redis.error_reply('WORKSPACE_MEMBERSHIP_REINITIALIZATION_REQUIRED') end
local raw = redis.call('GET',KEYS[1])
if raw and tostring(cjson.decode(raw).epoch) ~= ARGV[1] then return redis.error_reply('WORKSPACE_PREPARE_STALE') end
redis.call('DEL',KEYS[1],KEYS[2])
redis.call('HSET',KEYS[2],'__epoch',ARGV[2])
return 1`
const cancelScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if cjson.decode(raw).id ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])`
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value)
function identity(project, id, epoch) {
  if (!/^[a-f0-9]{24}$/i.test(project) || !uuid(id) || !Number.isSafeInteger(epoch) || epoch < 1) throw new Error('Invalid workspace preparation identity')
}
function createWorkspacePrepareGate(client) {
  if (typeof client.nodes === 'function') throw new Error('Workspace preparation requires non-clustered Redis')
  return {
    // Only bootstrap while write admission is closed and existing sessions have
    // been disconnected. Never infer an empty membership from a lost Redis key.
    async initialize(project, epoch) {
      identity(project, '00000000-0000-4000-8000-000000000000', epoch)
      await client.eval(initializeScript, 2, sessionsKey(project), `native-git:workspace-epoch:${project}`, epoch)
    },
    async register(project, epoch, session) {
      identity(project, '00000000-0000-4000-8000-000000000000', epoch)
      if (typeof session !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(session) || session === '__epoch') throw new Error('Invalid workspace session')
      await client.eval(registerScript, 3, keyFor(project), sessionsKey(project), `native-git:workspace-epoch:${project}`, epoch, session)
    },
    async leave(project, session) {
      identity(project, '00000000-0000-4000-8000-000000000000', 1)
      if (typeof session !== 'string' || session === '__epoch') throw new Error('Invalid workspace session')
      await client.eval(leaveScript, 2, keyFor(project), sessionsKey(project), session)
    },
    async beginRegistered(project, { id, epoch, ttlMs = 15000 }) {
      identity(project, id, epoch)
      if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 60000) throw new Error('Invalid preparation deadline')
      return JSON.parse(await client.eval(registeredBeginScript, 3, keyFor(project), sessionsKey(project), `native-git:workspace-epoch:${project}`, id, epoch, ttlMs))
    },
    async begin(project, { id, epoch, sessions, ttlMs = 15000 }) {
      identity(project, id, epoch)
      if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 60000 || !Array.isArray(sessions) || sessions.length > 1000 || sessions.some(s => typeof s !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(s))) throw new Error('Invalid workspace preparation participants or deadline')
      const members = Object.fromEntries(sessions.map(session => [session, 'pending']))
      return JSON.parse(await client.eval(beginScript, 1, keyFor(project), JSON.stringify({id, epoch, state:'waiting', members}), ttlMs))
    },
    // session must come from authenticated socket context, never a request body.
    async acknowledge(project, { id, epoch, session, saved }) {
      identity(project, id, epoch)
      if (typeof saved !== 'boolean' || typeof session !== 'string') throw new Error('Invalid workspace acknowledgement')
      return JSON.parse(await client.eval(updateScript, 1, keyFor(project), id, epoch, session, saved ? 'saved' : 'failed'))
    },
    async claim(project, { id, epoch }) {
      identity(project, id, epoch)
      return JSON.parse(await client.eval(claimScript, 3, keyFor(project), sessionsKey(project), `native-git:workspace-epoch:${project}`, id, epoch, 'waiting'))
    },
    // Recheck immediately before a protected mutation, while holding the
    // independent project write lease. A claim is not permanent permission.
    async assertClaimed(project, { id, epoch }) {
      identity(project, id, epoch)
      return JSON.parse(await client.eval(claimScript, 3, keyFor(project), sessionsKey(project), `native-git:workspace-epoch:${project}`, id, epoch, 'claimed'))
    },
    async advanceMembership(project, { id, epoch }, nextEpoch) {
      identity(project, id, epoch)
      if (!Number.isSafeInteger(nextEpoch) || nextEpoch !== epoch + 1) throw new Error('Invalid preparation epoch transition')
      return JSON.parse(await client.eval(advanceMembershipScript, 3, keyFor(project), sessionsKey(project), `native-git:workspace-epoch:${project}`, id, epoch, nextEpoch))
    },
    async recoverMembership(project, { epoch, nextEpoch, writeToken }) {
      identity(project, writeToken, epoch)
      if (!Number.isSafeInteger(nextEpoch) || nextEpoch !== epoch + 1) throw new Error('Invalid recovery epoch transition')
      return await client.eval(recoverMembershipScript, 4, keyFor(project), sessionsKey(project), `native-git:workspace-epoch:${project}`, `native-git:project-write:${project}`, epoch, nextEpoch, writeToken) === 1
    },
    async cancel(project, id) {
      identity(project, id, 1)
      return await client.eval(cancelScript, 1, keyFor(project), id) === 1
    },
  }
}
module.exports = { createWorkspacePrepareGate, keyFor, sessionsKey }
