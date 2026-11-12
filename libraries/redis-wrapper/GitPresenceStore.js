const { randomUUID } = require('node:crypto')
const keyFor = project => `native-git:presence:${project}`
const script = `
local clock=redis.call('TIME')
local now=tonumber(clock[1])*1000+math.floor(tonumber(clock[2])/1000)
-- Count only retained records before mutating: expired sessions must not
-- prevent a fresh connection from triggering pruning. A genuine overflow
-- still leaves both the snapshot and revision unchanged.
if ARGV[2]~='snapshot' and redis.call('HEXISTS',KEYS[1],ARGV[5])==0 and redis.call('HLEN',KEYS[1])>=1002 then
 local retained=0
 local entries=redis.call('HGETALL',KEYS[1])
 for i=1,#entries,2 do
  if string.sub(entries[i],1,2)~='__' and now-cjson.decode(entries[i+1]).lastSeen<tonumber(ARGV[4]) then retained=retained+1 end
 end
 if retained>=1000 then return redis.error_reply('GIT_PRESENCE_LIMIT') end
end
if redis.call('HEXISTS',KEYS[1],'__generation')==0 then
 redis.call('HSET',KEYS[1],'__generation',ARGV[1],'__revision',0)
end
local changed=false
local all=redis.call('HGETALL',KEYS[1])
for i=1,#all,2 do
 if string.sub(all[i],1,2)~='__' then
  local item=cjson.decode(all[i+1])
  if now-item.lastSeen>=tonumber(ARGV[4]) then
   redis.call('HDEL',KEYS[1],all[i]); changed=true
  elseif item.online and now-item.lastSeen>=tonumber(ARGV[3]) then
   item.online=false;redis.call('HSET',KEYS[1],all[i],cjson.encode(item));changed=true
  end
 end
end
local accepted=false
if ARGV[2]=='update' then
 local incoming=cjson.decode(ARGV[6])
 local raw=redis.call('HGET',KEYS[1],ARGV[5])
 local previous=raw and cjson.decode(raw)
 if not previous or (not previous.closed and incoming.sequence>previous.sequence) then
  incoming.lastSeen=now;incoming.online=true;incoming.closed=false
  redis.call('HSET',KEYS[1],ARGV[5],cjson.encode(incoming));changed=true;accepted=true
 end
elseif ARGV[2]=='leave' then
 local raw=redis.call('HGET',KEYS[1],ARGV[5])
 -- Keep a tombstone even if a delayed first update arrives after disconnect.
 local item=raw and cjson.decode(raw) or {sessionId=ARGV[5],sequence=0,lastSeen=now}
 if not item.closed then
  item.online=false;item.closed=true
  redis.call('HSET',KEYS[1],ARGV[5],cjson.encode(item));changed=true
 end
end
if changed then redis.call('HINCRBY',KEYS[1],'__revision',1) end
local sessions={}
all=redis.call('HGETALL',KEYS[1])
for i=1,#all,2 do
 if string.sub(all[i],1,2)~='__' then
  local item=cjson.decode(all[i+1])
  if item.userId then table.insert(sessions,item) end
 end
end
return cjson.encode({generation=redis.call('HGET',KEYS[1],'__generation'),revision=tonumber(redis.call('HGET',KEYS[1],'__revision')),sessions=sessions,accepted=accepted})`
const objectId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
const validSession = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) && !value.startsWith('__')
const oid = value => typeof value === 'string' && /^[a-f0-9]{40,64}$/.test(value)

// Internal API: caller must derive identity, editing branch/HEAD and dirty state
// from authenticated server state and authorize viewedCommit. No document text.
function createGitPresenceStore(client, { offlineMs = 60000, retainMs = 86400000 } = {}) {
 if (typeof client.nodes === 'function') throw Error('Git presence requires non-clustered Redis')
 if (!Number.isSafeInteger(offlineMs) || offlineMs < 1 || !Number.isSafeInteger(retainMs) || retainMs <= offlineMs) throw Error('Invalid presence retention')
 async function run(project, action, session = '', value = '') {
  if (!objectId(project)) throw Error('Invalid presence project')
  const result=JSON.parse(await client.eval(script,1,keyFor(project),randomUUID(),action,offlineMs,retainMs,session,value))
  if (!Array.isArray(result.sessions)) result.sessions=[]
  result.sessions.sort((a,b)=>a.sessionId.localeCompare(b.sessionId))
  return result
 }
 return {
  snapshot: project => run(project,'snapshot'),
  async update(project, value) {
   if (!value || !validSession(value.sessionId) || !objectId(value.userId) || !objectId(value.workspaceId) ||
       !Number.isSafeInteger(value.sequence) || value.sequence < 1 || !Number.isSafeInteger(value.epoch) || value.epoch < 1 ||
       (value.readOnly !== undefined && typeof value.readOnly !== 'boolean') ||
       typeof value.displayName !== 'string' || value.displayName.length > 200 ||
       typeof value.branch !== 'string' || value.branch.length > 255 ||
       (value.head !== null && !oid(value.head)) || typeof value.dirty !== 'boolean' ||
       (value.viewedCommit !== null && !oid(value.viewedCommit))) throw Error('Invalid verified presence')
   // Explicit projection excludes email, request tokens and document contents.
   const {sessionId,userId,workspaceId,sequence,epoch,displayName,branch,head,dirty,viewedCommit,readOnly=false}=value
   return run(project,'update',sessionId,JSON.stringify({sessionId,userId,workspaceId,sequence,epoch,displayName,branch,head,dirty,viewedCommit,readOnly}))
  },
  leave(project, session) {
   if (!validSession(session)) throw Error('Invalid presence session')
   return run(project,'leave',session)
  },
 }
}
module.exports = {createGitPresenceStore,keyFor}
