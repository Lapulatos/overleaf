import MaterialIcon from '@/shared/components/material-icon'
import type { TerminalIndicator } from './types'
import { UserAvatar } from './git-presence-list'

export default function TerminalIndicators({ sessions = [] }: { sessions?: TerminalIndicator[] }) {
  const users = new Map<string, TerminalIndicator[]>()
  for (const session of sessions) users.set(session.userId, [...(users.get(session.userId) || []), session])
  if (!users.size) return null
  return <span className="native-git-terminal-indicators">{[...users.entries()].map(([id, entries]) => {
    const state = entries.some(entry => entry.state === 'running') ? 'running' : entries.some(entry => entry.state === 'unavailable') ? 'unavailable' : 'stopped'
    const labels = { running: 'Running', stopped: 'Ended', unavailable: 'Connection unavailable', ready: 'Not started' }
    const title = `${entries[0].displayName}\n${entries.map(entry => `${entry.name} · ${labels[entry.state]}${entry.branch ? ` · ${entry.branch}` : ""}`).join('\n')}`
    return <span key={id} className={`native-git-terminal-user is-${state}`} title={title} aria-label={title}>
      <UserAvatar userId={id} displayName={entries[0].displayName}/><MaterialIcon type="terminal"/>{entries.length > 1 && <small>{entries.length}</small>}
    </span>
  })}</span>
}
