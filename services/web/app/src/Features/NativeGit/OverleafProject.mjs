import Path from 'node:path'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { projectPath, validateFiles } from './WorktreeFiles.mjs'

const conflict = path => Object.assign(new Error(`Project changed while switching branches: ${path}`), { status: 409 })

// Dependencies are existing Overleaf services, not a replacement document store.
// withExclusiveWrite must exclude collaborative/structural writers during apply;
// a production route must not be enabled without that platform integration.
export function createOverleafProject({ projectId, userId, entities, documents, blobs, editor, isEditable, withExclusiveWrite }) {
  const normalize = path => projectPath(path.replace(/^\//, ''))
  async function inventory() {
    const listed = await entities(projectId)
    const result = new Map()
    for (const { path, doc } of listed.docs) {
      const name = normalize(path)
      if (result.has(name)) throw new Error('Duplicate project path')
      result.set(name, { type: 'doc', id: String(doc._id) })
    }
    for (const { path, file } of listed.files) {
      const name = normalize(path)
      if (result.has(name)) throw new Error('Duplicate project path')
      result.set(name, { type: 'file', id: String(file._id), hash: file.hash })
    }
    const folders = new Map((listed.folders || []).filter(item => item.path && item.path !== '/')
      .map(item => [normalize(item.path.replace(/\/$/, '')), String(item.folder._id)]))
    return { entries: result, folders }
  }
  async function read() {
    const { entries, folders } = await inventory()
    const files = new Map()
    let total = 0
    for (const [path, entry] of entries) {
      if (entry.type === 'doc') {
        const document = await documents.getDocument(projectId, entry.id, -1)
        if (!Array.isArray(document.lines) || !document.lines.every(line => typeof line === 'string')) throw new Error('Invalid project document')
        files.set(path, Buffer.from(document.lines.join('\n')))
        entry.version = document.version
      } else {
        if (!/^[a-f0-9]{40,64}$/i.test(entry.hash || '')) throw new Error('Project asset is missing its stored hash')
        const { stream } = await blobs(projectId, entry.hash, AbortSignal.timeout(30000))
        const chunks = []
        try {
          for await (const chunk of stream) {
            total += chunk.length
            if (total > 256 * 1024 * 1024) throw new Error('Project exceeds Git workspace size limit')
            chunks.push(chunk)
          }
          files.set(path, Buffer.concat(chunks))
        } finally { stream.destroy() }
      }
    }
    const { entries: current } = await inventory()
    if (entries.size !== current.size || [...entries].some(([path, entry]) => {
      const now = current.get(path)
      return !now || now.id !== entry.id || now.hash !== entry.hash || now.type !== entry.type
    })) throw conflict('file tree')
    return { files: validateFiles(files), entries, folders }
  }
  async function apply(changes, expected) {
    if (typeof withExclusiveWrite !== 'function') throw new Error('Exclusive project write access is not configured')
    return withExclusiveWrite(async () => {
      const live = await read()
      // Preflight the whole transfer before the first mutation, including file
      // identity. Content equality alone cannot identify a deleted/recreated doc.
      for (const change of changes) {
        const actual = live.files.get(change.path)
        const wanted = expected.files.get(change.path)
        if (!same(actual, wanted) || live.entries.get(change.path)?.id !== expected.entries.get(change.path)?.id) throw conflict(change.path)
      }
      const temporary = await mkdtemp(Path.join(tmpdir(), 'overleaf-git-import-'))
      try {
        const ordered = [...changes].sort((a, b) => Number(a.after !== undefined) - Number(b.after !== undefined))
        for (const change of ordered) {
          const path = normalize(change.path)
          const existing = live.entries.get(path)
          if (change.after === undefined) {
            if (existing) await editor.deleteEntityWithPath(projectId, path, 'git', userId)
            continue
          }
          if (live.folders.has(path)) {
            // The file transfer already deleted the folder's old file contents.
            // Overleaf's native delete emits the structural update for the now-empty folder.
            await editor.deleteEntityWithPath(projectId, path, 'git', userId)
          }
          const text = change.after.toString('utf8')
          const editable = Buffer.from(text).equals(change.after) && isEditable(text, { filename: Path.basename(path) })
          if (editable && existing?.type === 'doc') {
            // Native docupdater tests the version under the document update lock.
            await documents.setDocument(projectId, existing.id, userId, text.split('\n'), 'git-bridge', existing.version)
          } else if (editable) {
            await editor.upsertDocWithPath(projectId, path, text.split('\n'), 'git', userId)
          } else {
            const file = Path.join(temporary, 'asset')
            await writeFile(file, change.after, { mode: 0o600 })
            await editor.upsertFileWithPath(projectId, path, file, null, 'git', userId)
          }
        }
      } finally { await rm(temporary, { recursive: true, force: true }) }
    })
  }
  return { read, apply }
}

function same(a, b) { return a === undefined ? b === undefined : b !== undefined && a.equals(b) }
