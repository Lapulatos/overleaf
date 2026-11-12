export type RecoveryDocument = {
  docId: string
  name: string
  version: number | null
  epoch: number | null
  content: string
}
function validDocuments(documents: unknown): documents is RecoveryDocument[] | undefined {
  return documents === undefined || (Array.isArray(documents) && documents.every(doc =>
    doc && typeof doc.docId === 'string' && !!doc.docId && typeof doc.name === 'string' &&
    typeof doc.content === 'string' && (doc.version === null || (Number.isSafeInteger(doc.version) && doc.version >= 0)) &&
    (doc.epoch === null || (Number.isSafeInteger(doc.epoch) && doc.epoch >= 1))) &&
    new Set(documents.map(doc => doc.docId)).size === documents.length)
}
export type LocalRecovery = {
  id: string
  userId: string
  workspaceId: string
  epoch: number
  createdAt: string
  content: string
  documents?: RecoveryDocument[]
}
// Keep detached documents available even when browser storage is unavailable.
export function accumulateLocalRecovery(
  previous: Omit<LocalRecovery, 'id' | 'createdAt'> | undefined,
  incoming: Omit<LocalRecovery, 'id' | 'createdAt'>
): Omit<LocalRecovery, 'id' | 'createdAt'> {
  const sameScope = previous?.userId === incoming.userId &&
    previous?.workspaceId === incoming.workspaceId && previous?.epoch === incoming.epoch
  const documents = new Map<string, RecoveryDocument>()
  for (const doc of [...(sameScope ? previous?.documents || [] : []), ...(incoming.documents || [])]) {
    documents.set(doc.docId, { ...doc })
  }
  const retained = [...documents.values()]
  return { ...incoming, documents: retained,
    content: retained.length > 1 ? JSON.stringify({ documents: retained }, null, 2)
      : retained.length === 1 ? retained[0].content : incoming.content }
}
const prefix = 'overleaf.git-recovery.v1.'
const scope = (user: string, workspace: string) => `${prefix}${encodeURIComponent(user)}.${encodeURIComponent(workspace)}.`
// Use separate immutable keys: two tabs must not overwrite a shared array.
// Storage errors deliberately propagate; callers must not claim a backup exists.
export function saveLocalRecovery(storage: Storage, value: Omit<LocalRecovery, 'id' | 'createdAt'>): LocalRecovery {
  if (!value.userId || !value.workspaceId || !Number.isSafeInteger(value.epoch) || value.epoch < 1) throw Error('Missing recovery identity')
  if (!validDocuments(value.documents)) throw Error('Invalid recovery document identities')
  const entry = { ...value, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  const key = scope(value.userId, value.workspaceId) + entry.id
  const raw = JSON.stringify(entry)
  storage.setItem(key, raw)
  if (storage.getItem(key) !== raw) throw Error('Recovery copy could not be verified')
  return entry
}
export function listLocalRecovery(storage: Storage, user: string, workspace: string): LocalRecovery[] {
  const result: LocalRecovery[] = []
  const start = scope(user, workspace)
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith(start)) continue
    // Corrupt entries remain stored and produce an explicit error, not deletion.
    const entry: LocalRecovery = JSON.parse(storage.getItem(key) || '')
    if (entry.userId !== user || entry.workspaceId !== workspace || key !== start + entry.id ||
        typeof entry.content !== 'string' || typeof entry.createdAt !== 'string' ||
        !Number.isSafeInteger(entry.epoch) || entry.epoch < 1 || !validDocuments(entry.documents)) throw Error('Unreadable local recovery copy')
    result.push(entry)
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}
export function removeLocalRecovery(storage: Storage, user: string, workspace: string, id: string) {
  storage.removeItem(scope(user, workspace) + id)
}
