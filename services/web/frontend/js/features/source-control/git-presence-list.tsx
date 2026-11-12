import type { GitPresence } from './git-presence'
import { formatGitDate } from './format-date'
export function PresenceMarkers({ sessions, hash }: { sessions: GitPresence[]; hash: string }) {
 const groups = new Map<string, { location: 'editing' | 'viewing history'; dirty: boolean; sessions: GitPresence[] }>()
 for (const session of sessions) {
  for (const location of ['editing', 'viewing history'] as const) {
   if ((location === 'editing' ? session.head : session.viewedCommit) !== hash) continue
   const dirty = location === 'editing' && session.dirty
   const key = JSON.stringify([session.userId, location, session.online, dirty])
   const group = groups.get(key) || { location, dirty, sessions: [] }
   group.sessions.push(session); groups.set(key, group)
  }
 }
 return <span className="native-git-presence-markers">{[...groups].map(([key, group]) => {
  const ordered = [...group.sessions].sort((a, b) => b.lastSeen - a.lastSeen || a.sessionId.localeCompare(b.sessionId))
  const session = ordered[0]
  const label = `${session.displayName} · ${session.online ? '' : 'last '}${group.location}${group.dirty ? ' · Working Changes based on this commit' : ''} · ${ordered.length} session${ordered.length === 1 ? '' : 's'} · ${session.online ? 'online' : 'offline'}`
  const title = label + '\n' + ordered.map(item => `${item.branch || 'detached HEAD'} · session ${item.sessionId}${item.online ? '' : ` · last seen ${formatGitDate(new Date(item.lastSeen).toISOString())}`}`).join('\n')
  return <span key={key} className={`native-git-presence-avatar ${session.online ? '' : 'is-offline'}`} title={title} aria-label={label}>
   {group.location === 'viewing history' ? '◉ ' : group.dirty ? '✎ ' : ''}{session.displayName.slice(0, 2)}{ordered.length > 1 && ` ×${ordered.length}`}
  </span>
 })}</span>
}

export default function GitPresenceList({ sessions, loaded, onLocate }: {
 sessions: GitPresence[]; loaded: Set<string>; onLocate(hash: string): void
}) {
 if (!sessions.length) return null
 const users = new Map<string, GitPresence[]>()
 for (const session of sessions) {
  const group = users.get(session.userId) || []
  group.push(session); users.set(session.userId, group)
 }
 const groups = [...users.entries()].map(([userId, entries]) => {
  const ordered = [...entries].sort((a, b) => b.lastSeen - a.lastSeen || a.sessionId.localeCompare(b.sessionId))
  return { userId, name: ordered[0].displayName, online: ordered.filter(s => s.online), offline: ordered.filter(s => !s.online) }
 }).sort((a, b) => Number(b.online.length > 0) - Number(a.online.length > 0) || a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId))
 const row = (session: GitPresence) => <div key={session.sessionId} className="native-git-presence-person" data-session-id={session.sessionId}>
   <span title={`Session ${session.sessionId}`}>Session {session.sessionId.slice(0, 8)}</span>
   <span>{session.online ? 'Online' : `Last seen ${formatGitDate(new Date(session.lastSeen).toISOString())}`}</span>
   <button type="button" disabled={!session.head} onClick={() => session.head && onLocate(session.head)}
    title={session.head && !loaded.has(session.head) ? 'Locate commit outside the current filter or loaded page' : 'Locate editing position'}>
    {session.readOnly ? (session.online ? 'Viewing' : 'Last viewing') : (session.online ? 'Editing' : 'Last editing')} {session.branch || 'detached HEAD'}{session.dirty ? ' · Working Changes' : ''}{!session.head ? ' · no commits' : ''}
   </button>
   {session.viewedCommit && <button type="button" onClick={() => onLocate(session.viewedCommit!)}>{session.online ? 'Viewing history' : 'Last viewed'} {session.viewedCommit.slice(0, 8)}</button>}
  </div>
 return <details className="native-git-presence-list" open><summary>Collaborator positions ({users.size} users, {sessions.filter(s => s.online).length} online sessions)</summary>
  <div className="native-git-presence-groups">
   {groups.map(group => <details className="native-git-presence-user" key={group.userId} data-user-id={group.userId} open={group.online.length > 0}>
    <summary><span>{group.name}</span> · {group.online.length} online{group.offline.length > 0 && ` · ${group.offline.length} offline`}</summary>
    {group.online.map(row)}
    {group.offline.length > 0 && <details className="native-git-presence-offline"><summary>Offline sessions ({group.offline.length})</summary>{group.offline.map(row)}</details>}
   </details>)}
  </div>
 </details>
}
