import Path from 'node:path'
import { readFile } from 'node:fs/promises'
import { ChunkResponse, Change } from 'overleaf-editor-core'
import { fetchJson, fetchNothing } from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v)
const conflict = message => Object.assign(Error(message), {status:409})

// Dependencies make interrupted imports resumable without accepting an unrelated
// history with the same length. The destination must still be unpublished.
export async function restoreHistory({ initialSnapshot, changes, client, checkpoint = async () => {} }) {
  let current
  try { current = await client.read() }
  catch (error) {
    if ((error.status || error.response?.status) !== 404) throw error
    await client.initialize(initialSnapshot)
    current = await client.read()
  }
  if (canonical(current.snapshot) !== canonical(initialSnapshot) || current.changes.length > changes.length) throw conflict('Restored history does not match the backup origin')
  const normalized = change => canonical(Change.fromRaw(change).toRaw())
  for (let i=0; i<current.changes.length; i++) if (normalized(current.changes[i]) !== normalized(changes[i])) throw conflict('Restored history differs from the backup; it was not overwritten')
  let cursor = current.changes.length
  while (cursor < changes.length) {
    const batch = changes.slice(cursor, cursor + 100)
    await client.append(batch, cursor)
    cursor += batch.length
    await checkpoint(cursor)
  }
  const final = await client.read()
  if (final.changes.length !== changes.length || canonical(final.snapshot) !== canonical(initialSnapshot) || final.changes.some((c,i)=>normalized(c)!==normalized(changes[i]))) throw conflict('Restored history failed final verification')
  return { endVersion: cursor }
}

export async function restoreWorkspaceHistory(directory, manifest, sourceId, targetId, checkpoint) {
  if (!/^[a-f0-9]{24}$/.test(sourceId) || !/^[a-f0-9]{24}$/.test(targetId) || sourceId === targetId) throw Error('Invalid restore workspace identity')
  const prefix = `workspaces/${sourceId}/history/`
  const entries = manifest.entries.filter(e=>e.path.startsWith(prefix))
  const chunks=[]
  for(const entry of entries.filter(e=>e.path.startsWith(`${prefix}chunks/`))) chunks.push(JSON.parse(await readFile(Path.join(directory,entry.path))))
  chunks.sort((a,b)=>a.chunk.startVersion-b.chunk.startVersion)
  let version=0
  for(const raw of chunks){
    const chunk=ChunkResponse.fromRaw(raw).getChunk()
    if(chunk.getStartVersion()!==version) throw conflict('Backup history is incomplete')
    version=chunk.getEndVersion()
  }
  if(!chunks.length) throw conflict('Backup history is missing')
  const api=Settings.apis.v1_history, base=`${api.url}/projects/${targetId}`
  const options={basicAuth:{user:api.user,password:api.pass},signal:AbortSignal.timeout(60000)}
  // Blob endpoints validate the content hash, not just the archive entry hash.
  for(const entry of entries.filter(e=>e.path.startsWith(`${prefix}blobs/`))){
    const hash=entry.path.slice(`${prefix}blobs/`.length)
    if(!/^[a-f0-9]{40}$/.test(hash)) throw Error('Invalid backup blob identity')
    await fetchNothing(`${base}/blobs/${hash}`,{...options,signal:AbortSignal.timeout(60000),method:'PUT',body:await readFile(Path.join(directory,entry.path))})
  }
  const client={
    initialize: snapshot=>fetchJson(`${base}/import`,{...options,signal:AbortSignal.timeout(60000),method:'POST',json:snapshot}),
    append: (changes,cursor)=>fetchJson(`${base}/changes?end_version=${cursor}`,{...options,signal:AbortSignal.timeout(60000),method:'POST',json:changes}),
    async read(){
      const chain=[];let raw=await fetchJson(`${base}/latest/history`,{...options,signal:AbortSignal.timeout(60000)})
      for(;;){
        chain.unshift(raw)
        const start=raw.chunk.startVersion
        if(start===0) break
        if(chain.length>10000) throw Error('Excessive restored history')
        const previous=await fetchJson(`${base}/versions/${start-1}/history`,{...options,signal:AbortSignal.timeout(60000)})
        if(ChunkResponse.fromRaw(previous).getChunk().getEndVersion()!==start) throw conflict('Restored history has a missing chunk')
        raw=previous
      }
      return {snapshot:chain[0].chunk.history.snapshot,changes:chain.flatMap(c=>c.chunk.history.changes)}
    },
  }
  return restoreHistory({initialSnapshot:chunks[0].chunk.history.snapshot,changes:chunks.flatMap(c=>c.chunk.history.changes),client,checkpoint})
}
