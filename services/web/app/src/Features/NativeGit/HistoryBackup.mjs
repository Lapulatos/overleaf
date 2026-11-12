import { ChunkResponse } from 'overleaf-editor-core'
import { fetchJson } from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'
import HistoryManager from '../History/HistoryManager.mjs'

// Export actual chunks and every referenced historical blob, including assets
// deleted from the current document tree. A current-file ZIP cannot replace this.
export async function captureHistory(projectId, historyId, archive, prefix) {
  await HistoryManager.promises.flushProject(projectId)
  await HistoryManager.promises.ensureNoResyncPending(projectId)
  const latest = await HistoryManager.promises.getLatestHistory(projectId)
  const initial = ChunkResponse.fromRaw(latest).getChunk()
  const hashes = new Set(), visited = new Set()
  let raw = latest
  for (;;) {
    const chunk = ChunkResponse.fromRaw(raw).getChunk(), start = chunk.getStartVersion()
    if (visited.has(start) || visited.size >= 10000) throw Error('Invalid or excessive history chunk chain')
    visited.add(start)
    chunk.getHistory().findBlobHashes(hashes)
    await archive.add(`${prefix}/chunks/${start}.json`, Buffer.from(JSON.stringify(raw)))
    if (start === 0) break
    const api = Settings.apis.v1_history
    raw = await fetchJson(`${api.url.replace(/\/$/, '')}/projects/${historyId}/versions/${start - 1}/history`, {
      basicAuth: { user: api.user, password: api.pass }, signal: AbortSignal.timeout(30000),
    })
    if (ChunkResponse.fromRaw(raw).getChunk().getEndVersion() !== start) throw Error('History chunks are not contiguous')
  }
  for (const hash of [...hashes].sort()) {
    if (!/^[a-f0-9]{40}$/.test(hash)) throw Error('Invalid history blob identity')
    const { stream } = await HistoryManager.promises.requestBlobWithProjectId(projectId, hash, 'GET', '', AbortSignal.timeout(30000))
    const parts = []; let bytes = 0
    for await (const part of stream) {
      bytes += part.length
      if (bytes + archive.bytes > archive.maxBytes) { stream.destroy(); throw Object.assign(Error('Backup exceeds configured export size limit'), { status: 413 }) }
      parts.push(part)
    }
    await archive.add(`${prefix}/blobs/${hash}`, Buffer.concat(parts))
  }
  return { historyId: String(historyId), startVersion: 0, endVersion: initial.getEndVersion(), chunks: visited.size, blobs: hashes.size }
}
