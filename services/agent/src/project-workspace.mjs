import { mkdtemp, mkdir, writeFile, readFile, readdir, lstat, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_TEXT_EXTENSION, validateProjectPath, validateProjectAssets } from '../../../libraries/validation-tools/project-input.mjs'
import { createHash } from 'node:crypto'

const TEXT = PROJECT_TEXT_EXTENSION
export function validateWorkspacePath(path) {
  return validateProjectPath(path)
}

// Replace the complete file in a standards-compliant unified hunk. The server
// still validates every removed line and the exact captured document version.
export function fullFilePatch(path, before, after) {
  validateWorkspacePath(path)
  const lines = text => text === '' ? [] : text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n')
  const oldLines = lines(before), newLines = lines(after)
  const body = (text, values, prefix) => values.map((line, i) => prefix + line + '\n' + (i === values.length - 1 && !text.endsWith('\n') ? '\\ No newline at end of file\n' : '')).join('')
  return `--- a/${path}\n+++ b/${path}\n@@ -${oldLines.length ? 1 : 0},${oldLines.length} +${newLines.length ? 1 : 0},${newLines.length} @@\n${body(before, oldLines, '-')}${body(after, newLines, '+')}`
}

export async function createProjectWorkspace(documents, assets = []) {
  if (!Array.isArray(documents) || !documents.length || documents.length > 100) throw new Error('Invalid project snapshot')
  const base = new Map()
  let bytes = 0
  for (const doc of documents) {
    validateWorkspacePath(doc.path)
    if (base.has(doc.path.toLowerCase())) throw new Error(`Project filenames differ only by letter case: ${base.get(doc.path.toLowerCase()).path} and ${doc.path}. Rename one file before retrying.`)
    if(typeof doc.content !== 'string' || !Number.isSafeInteger(doc.version) || doc.version < 0) throw new Error(`Invalid project document: ${doc.path}`)
    bytes += Buffer.byteLength(doc.content)
    if (bytes > 2000000) throw new Error('Project snapshot exceeds workspace limit')
    base.set(doc.path.toLowerCase(), Object.freeze({ ...doc }))
  }
  const attachments = validateProjectAssets(assets)
  const attachmentHashes = new Map()
  for (const asset of attachments) {
    if (base.has(asset.path.toLowerCase())) throw new Error('Attachment collides with document path')
    attachmentHashes.set(asset.path, createHash('sha256').update(asset.bytes).digest('hex'))
  }
  const parent = await realpath(tmpdir())
  const directory = await mkdtemp(join(parent, 'overleaf-project-'))
  const cleanup = () => rm(directory, { recursive: true, force: true })
  try {
    for (const doc of base.values()) {
      const parts = validateWorkspacePath(doc.path)
      if (parts.length > 1) await mkdir(join(directory, ...parts.slice(0, -1)), { recursive: true, mode: 0o700 })
      await writeFile(join(directory, doc.path), doc.content, { mode: 0o600, flag: 'wx' })
    }
    for (const asset of attachments) {
      const parts = validateProjectPath(asset.path, true)
      if (parts.length > 1) await mkdir(join(directory, ...parts.slice(0, -1)), { recursive: true, mode: 0o700 })
      await writeFile(join(directory, asset.path), asset.bytes, { mode: 0o400, flag: 'wx' })
    }
  } catch (error) { await cleanup(); throw error }
  return {
    directory,
    cleanup,
    async changes() {
      const files = new Map()
      const remainingAttachments = new Map(attachmentHashes)
      let count = 0, total = 0
      async function walk(relative = '') {
        for (const name of await readdir(join(directory, relative))) {
          if (++count > 1000) throw new Error('Workspace contains too many entries')
          const path = relative ? `${relative}/${name}` : name
          const stat = await lstat(join(directory, path))
          if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) throw new Error('Unsupported workspace entry')
          if (stat.isDirectory()) {
            if(path==='template-sources' && ![...base.values()].some(d=>d.path.startsWith('template-sources/')) && ![...attachmentHashes.keys()].some(p=>p.startsWith('template-sources/')))continue
            await walk(path); continue
          }
          if (stat.nlink !== 1 || stat.size > 20000000) throw new Error('Unsupported workspace file')
          total += stat.size
          if (total > 50000000) throw new Error('Workspace output exceeds size limit')
          if (remainingAttachments.has(path)) {
            const hash = createHash('sha256').update(await readFile(join(directory, path))).digest('hex')
            if (hash !== remainingAttachments.get(path)) throw new Error('Project attachment was modified; binary writeback is unsupported')
            remainingAttachments.delete(path)
            continue
          }
          if (!TEXT.test(path)) continue // Compilation outputs are artifacts, never manuscript proposals.
          if (stat.size > 2000000) throw new Error('Project text exceeds file size limit')
          validateWorkspacePath(path)
          const data = await readFile(join(directory, path))
          const content = new TextDecoder('utf-8', { fatal: true }).decode(data)
          files.set(path, content)
        }
      }
      await walk()
      if (remainingAttachments.size) throw new Error('Project attachment was removed; binary writeback is unsupported')
      const changes = []
      for (const doc of base.values()) {
        const after = files.get(doc.path)
        if (after === undefined) { changes.push({ kind: 'delete', path: doc.path, before: doc.content, version: doc.version }); continue }
        files.delete(doc.path)
        if (after !== doc.content) changes.push({ kind: 'edit', path: doc.path, before: doc.content, after, version: doc.version, content: fullFilePatch(doc.path, doc.content, after) })
      }
      for (const [path, after] of files) changes.push({ kind: 'create', path, after })
      return changes
    },
  }
}
