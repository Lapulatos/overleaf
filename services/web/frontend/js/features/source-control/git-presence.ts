export type GitPresence = {
 sessionId: string; userId: string; workspaceId: string; epoch: number
 readOnly?: boolean; displayName: string; branch: string; head: string | null; dirty: boolean
 viewedCommit: string | null; online: boolean; lastSeen: number; sequence: number
}
export type PresenceSnapshot = { generation: string; revision: number; sessions: GitPresence[] }
type Socket = {
 on(event: string, callback: (...args: any[]) => void): unknown
 removeListener(event: string, callback: (...args: any[]) => void): unknown
 emit(event: string, intent: { viewedCommit: string | null }, callback: (error: unknown, snapshot?: PresenceSnapshot) => void): unknown
}
export function bindGitPresence({ socket, publish, heartbeatMs = 20000, onIntent }: {
 socket: Socket; publish(snapshot: PresenceSnapshot | null): void; heartbeatMs?: number
 onIntent(listener: (commit: string | null) => void): () => void
}) {
 let alive = true, generation: string | undefined, revision = -1, request = 0
 let viewedCommit: string | null = null
 let pending = false, again = false, connected = true
 let timeout: ReturnType<typeof setTimeout> | undefined
 const valid = (value?: PresenceSnapshot): value is PresenceSnapshot => !!value && typeof value.generation === 'string' &&
   Number.isSafeInteger(value.revision) && value.revision >= 0 && Array.isArray(value.sessions)
 const accept = (snapshot: PresenceSnapshot, authoritative: boolean) => {
  if (!valid(snapshot)) return
  if (snapshot.generation !== generation) {
   if (!authoritative) return
   generation = snapshot.generation; revision = -1
  }
  if (snapshot.revision < revision) return
  revision = snapshot.revision; publish(snapshot)
 }
 const refresh = () => {
  if (!alive || !connected) return
  if (pending) { again = true; return }
  pending = true
  const id = ++request
  timeout = setTimeout(() => {
   if (!alive || id !== request) return
   ++request; pending = false; publish(null)
   if (again) { again = false; refresh() }
  }, 12000)
  socket.emit('nativeGitPresence', { viewedCommit }, (error, snapshot) => {
   if (!alive || id !== request) return
   clearTimeout(timeout); pending = false
   if (!error && valid(snapshot)) accept(snapshot, true)
   else publish(null)
   if (again) { again = false; refresh() }
  })
 }
 const changed = (snapshot: PresenceSnapshot) => {
  if (!alive || !connected || !valid(snapshot)) return
  if (snapshot.generation !== generation) { refresh(); return }
  accept(snapshot, false)
 }
 const disconnect = () => { connected = false; ++request; pending = false; clearTimeout(timeout); publish(null) }
 const connect = () => { connected = true; refresh() }
 const intent = (commit: string | null) => { viewedCommit = commit; refresh() }
 socket.on('nativeGitPresenceChanged', changed)
 socket.on('disconnect', disconnect)
 socket.on('connect', connect)
 const unlisten = onIntent(intent)
 const timer = setInterval(refresh, heartbeatMs)
 if (!pending) refresh()
 return () => {
  alive = false; ++request; clearTimeout(timeout); clearInterval(timer); unlisten()
  socket.removeListener('nativeGitPresenceChanged', changed)
  socket.removeListener('disconnect', disconnect); socket.removeListener('connect', connect)
  publish(null)
 }
}
