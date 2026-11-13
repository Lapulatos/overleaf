import type { GitPresence } from './git-presence'
import MaterialIcon from '@/shared/components/material-icon'
import { formatGitDate } from './format-date'

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
const color = (id: string) => ['#376c93', '#8762a1', '#327c6b', '#956526'][[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 4]
export function UserAvatar({userId, displayName}: {userId: string; displayName: string}) {
 return <span className="native-git-person-avatar" style={{backgroundColor: color(userId)}} aria-hidden="true">{initials(displayName)}</span>
}
function Avatar({ session }: { session: GitPresence }) {
 return <span className={`native-git-person-avatar ${session.online ? 'is-online' : ''}`} style={{ backgroundColor: color(session.userId) }} aria-hidden="true">{initials(session.displayName)}</span>
}
export function PresenceMarkers({ sessions, hash }: { sessions: GitPresence[]; hash: string }) {
 const users = new Map<string, GitPresence>()
 for (const s of [...sessions].sort((a,b) => b.lastSeen-a.lastSeen)) {
  if (s.online && (s.head === hash || s.viewedCommit === hash) && !users.has(s.userId)) users.set(s.userId,s)
 }
 if (!users.size) return null
 return <span className="native-git-presence-markers">{[...users.values()].slice(0,3).map(s => <span key={s.userId} title={`${s.displayName} · ${s.viewedCommit === hash && s.head !== hash ? 'Viewing history' : s.readOnly ? 'Viewing' : 'Editing'} · ${s.branch || 'Detached HEAD'}`} aria-label={`${s.displayName} online`}><Avatar session={s} /></span>)}{users.size>3 && <span className="native-git-person-overflow">+{users.size-3}</span>}</span>
}
export default function GitPresenceList({ sessions, loaded, onLocate }: { sessions: GitPresence[]; loaded: Set<string>; onLocate(hash: string): void }) {
 const users = new Map<string, GitPresence[]>()
 for (const s of [...sessions].sort((a,b) => Number(b.online)-Number(a.online) || b.lastSeen-a.lastSeen)) {
  const entries=users.get(s.userId)||[]
  if (!entries.some(e=>e.branch===s.branch && e.online===s.online)) entries.push(s)
  users.set(s.userId,entries)
 }
 if (!users.size) return null
 const online=[...users.values()].filter(entries=>entries[0].online)
 return <details className="native-git-presence-list">
  <summary><MaterialIcon type="group" /><span>{online.length ? `${online.length} online` : 'Collaborators'}</span><span className="native-git-avatar-stack">{online.slice(0,4).map(entries=><Avatar key={entries[0].userId} session={entries[0]} />)}</span><MaterialIcon type="expand_more" /></summary>
  <div className="native-git-presence-groups">{[...users.entries()].map(([id, entries])=>{
   const current=entries.filter(s=>s.online);const shown=current.length?current:[entries[0]]
   return <div className="native-git-presence-user" key={id}>
    <div className="native-git-person-heading"><Avatar session={shown[0]} /><strong title={shown[0].displayName}>{shown[0].displayName}</strong><span>{current.length?'Online':'Offline'}</span></div>
    {shown.map(s=><button key={s.sessionId} type="button" className="native-git-person-location" disabled={!s.head} onClick={()=>s.head&&onLocate(s.head)} title={`${s.readOnly?'Viewing':'Editing'} ${s.branch || 'Detached HEAD'}${s.dirty?' · Uncommitted changes':''}${s.online?'':` · Last seen ${formatGitDate(new Date(s.lastSeen).toISOString())}`}${s.head&&!loaded.has(s.head)?' · Locate in history':''}`}><MaterialIcon type="account_tree" /><span>{s.branch||'Detached HEAD'}</span>{s.dirty&&<span className="native-git-dirty-dot" title="Uncommitted changes" />}<MaterialIcon type="my_location" /></button>)}
   </div>
  })}</div>
 </details>
}
