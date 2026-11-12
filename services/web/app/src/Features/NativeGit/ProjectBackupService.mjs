import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import Settings from '@overleaf/settings'
import { fetchJson } from '@overleaf/fetch-utils'
import Path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { readdir, readFile, lstat } from 'node:fs/promises'
import { ChunkResponse } from 'overleaf-editor-core'
import { Project } from '../../models/Project.mjs'
import CollaboratorsGetter from '../Collaborators/CollaboratorsGetter.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import Chat from '../Chat/ChatApiHandler.mjs'
import { createOverleafProject } from './OverleafProject.mjs'
import { snapshotIdentity } from './MergeDraftService.mjs'
import { BackupArchive } from './BackupArchive.mjs'
import { captureHistory } from './HistoryBackup.mjs'
import { taskId, CollaborationTaskStore } from './CollaborationTaskStore.mjs'

const projection = 'name description owner_ref collaberator_refs reviewer_refs readOnly_refs rootDoc_id rootFolder mainBibliographyDoc_id version compiler imageName spellCheckLanguage archived trashed deletedDocs track_changes gitWorkspace gitWorkspaceEnabled gitWorkspaceFenceEnabled gitWorkspacePrepareEnabled gitWorkspaceEpoch overleaf.history'
const controls = ['binding', 'workspace-bindings', 'collaboration-tasks', 'drafts', 'transfers', 'history-restores', 'auto-commit', 'auto-sync', 'shell-draft-tasks', 'session-recovery', 'remote-discovery', 'merge-validations', 'worktrees']
const excluded = ['webhook secrets and bindings', 'credentials', 'access-policy', 'clones', 'browser sessions', 'share tokens', 'Git configuration and hooks', 'compiler caches']
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const conflict = () => Object.assign(Error('Project changed during backup capture. Retry after collaborators finish saving.'), { status: 409 })
const json = value => Buffer.from(canonical(value))

export class ProjectBackupService {
  constructor(c, actorId) { this.c = c; this.actorId = String(actorId); this.root = Path.join(c.root, 'backups') }
  async authorize() {
    const access = await CollaboratorsGetter.promises.getProjectAccess(this.c.logicalProjectId)
    if (String(access.getOwnerId()) !== this.actorId) throw Object.assign(Error('Only the project owner can export or download a full project backup.'), { status: 403 })
  }
  projects() {
    return Project.find({ $or: [{ _id: this.c.logicalProjectId }, { 'gitWorkspace.logicalProjectId': this.c.logicalProjectId }] }).select(projection).sort({ _id: 1 }).lean().exec()
  }
  reader(id) {
    return createOverleafProject({ projectId: id, userId: this.actorId, entities: p => ProjectEntityHandler.promises.getAllEntities(p),
      documents: DocumentUpdaterHandler.promises, blobs: (p, h, signal) => HistoryManager.promises.requestBlobWithProjectId(p, h, 'GET', '', signal) })
  }
  async state(project) {
    const id = String(project._id), snapshot = await this.reader(id).read(), documents = {}
    for (const [path, entry] of snapshot.entries) {
      if (entry.type === 'doc') {
        const doc = await DocumentUpdaterHandler.promises.getDocument(id, entry.id, -1)
        if (doc.version !== entry.version) throw conflict()
        documents[path] = { id: entry.id, version: doc.version, lines: doc.lines, ranges: doc.ranges || {} }
      }
    }
    const deletedDocuments = []
    for (const doc of await DocstoreManager.promises.getAllDeletedDocs(id)) {
      deletedDocuments.push({ ...doc, ...await DocstoreManager.promises.getDoc(id, String(doc._id), { include_deleted: true }) })
    }
    deletedDocuments.sort((a,b) => String(a._id).localeCompare(String(b._id)))
    const threads = await Chat.promises.getThreads(id)
    const messages = await Chat.promises.getGlobalMessages(id, 0)
    const labels = await fetchJson(`${Settings.apis.project_history.url}/project/${id}/labels`)
    const metadata = { project, documents, deletedDocuments, threads, messages, labels, identity: snapshotIdentity(snapshot) }
    return { snapshot, metadata, fingerprint: hash(json(metadata)) }
  }
  async create() {
    await this.authorize()
    return this.c.recoveryLock(async () => {
      await this.authorize()
      const deadline = Date.now() + 5 * 60 * 1000
      const shellTasks = await new CollaborationTaskStore(Path.join(this.c.root, 'shell-draft-tasks')).list()
      if (shellTasks.some(task => ['preparing', 'starting', 'running', 'stopping', 'sealing'].includes(task.state) ||
        (task.state === 'recovery-required' && ['start', 'stop'].includes(task.failurePhase)))) {
        throw Object.assign(Error('Stop and seal active Shell drafts before creating a consistent backup.'), { status: 409 })
      }
      const id = randomUUID(), archive = new BackupArchive(Path.join(this.root, id))
      await archive.begin()
      const projects = await this.projects(), states = [], sources = [], inventories = []
      for (const project of projects) {
        const workspaceId = String(project._id)
        // Capture before flush so an intervening edit cannot make history lag the exported text.
        const before = await this.state(project)
        await DocumentUpdaterHandler.promises.flushProjectToMongo(workspaceId)
        const history = await captureHistory(workspaceId, project.overleaf?.history?.id, archive, `workspaces/${workspaceId}/history`)
        const after = await this.state(project)
        if (before.fingerprint !== after.fingerprint) throw conflict()
        for (const [path, bytes] of after.snapshot.files) await archive.add(`workspaces/${workspaceId}/files/${path}`, bytes)
        await archive.add(`workspaces/${workspaceId}/metadata.json`, json(after.metadata))
        states.push({ workspaceId, fingerprint: after.fingerprint, history })
      }
      const refs = await this.c.repository.git.raw(['show-ref', '--head']).catch(error => { if (error.exitCode === 1) return ''; throw error })
      await archive.add('git/refs.txt', Buffer.from(refs))
      const gitdir = (await this.c.repository.git.raw(['rev-parse', '--absolute-git-dir'])).trim()
      const inventory = async (directory, prefix, skip = new Set()) => {
        const result = []
        const entries = await readdir(directory, { withFileTypes: true }).catch(e => { if (e.code === 'ENOENT') return []; throw e })
        for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
          if (skip.has(entry.name)) continue
          if (entry.isSymbolicLink()) throw Object.assign(Error('A backup source contains a symbolic link; export was not published.'), { status: 409 })
          const source = Path.join(directory, entry.name), name = `${prefix}/${entry.name}`
          if (entry.isDirectory()) result.push(...await inventory(source, name, skip))
          else if (entry.isFile()) {
            result.push({ source, name })
          } else throw Error('Unsupported backup source')
        }
        return result
      }
      const copyTree = async (directory, prefix, skip = new Set()) => {
        const files = await inventory(directory, prefix, skip)
        inventories.push({ directory, prefix, skip, files })
        for (const {source, name} of files) {
          await archive.addFile(name, source)
          sources.push({ source, name, hash: archive.entries.get(name).sha256 })
        }
      }
      // Keep all Git objects, including unreferenced task commits. Configuration,
      // hooks and authentication are deliberately not restored from an archive.
      for (const dir of ['objects', 'refs', 'logs', 'worktrees']) await copyTree(Path.join(gitdir, dir), `git/${dir}`)
      for (const name of ['HEAD', 'packed-refs', 'shallow', 'index']) {
        const source = Path.join(gitdir, name)
        try { await archive.addFile(`git/${name}`, source); sources.push({ source, name: `git/${name}`, hash: archive.entries.get(`git/${name}`).sha256 }) }
        catch (e) { if (e.code !== 'ENOENT') throw e }
      }
      for (const dir of controls) await copyTree(Path.join(this.c.root, dir), `control/${dir}`, new Set(['.git']))
      const manifest = await archive.publish({ projectId: this.c.logicalProjectId, createdBy: this.actorId, id, workspaces: states, excluded }, async () => {
        if (Date.now() >= deadline) return false
        await this.authorize()
        const now = await this.projects()
        if (canonical(now) !== canonical(projects)) return false
        for (const project of now) {
          const previous = states.find(s => s.workspaceId === String(project._id))
          if ((await this.state(project)).fingerprint !== previous.fingerprint) return false
          const chunk = ChunkResponse.fromRaw(await HistoryManager.promises.getLatestHistory(String(project._id))).getChunk()
          if (chunk.getEndVersion() !== previous.history.endVersion) return false
        }
        if (await this.c.repository.git.raw(['show-ref', '--head']) !== refs) return false
        for (const item of inventories) if (canonical(await inventory(item.directory, item.prefix, item.skip)) !== canonical(item.files)) return false
        for (const source of sources) {
          if (!(await lstat(source.source)).isFile() || hash(await readFile(source.source)) !== source.hash) return false
        }
        return Date.now() < deadline
      })
      return this.summary(manifest)
    })
  }
  summary(manifest) {
    return { id: manifest.id, capturedAt: manifest.capturedAt, files: manifest.entries.length, bytes: manifest.totalBytes,
      workspaces: manifest.workspaces.length, excluded: manifest.excluded,
      downloadUrl: `/project/${this.c.logicalProjectId}/native-git/backups/${manifest.id}/download` }
  }
  async list() {
    await this.authorize()
    const names = await readdir(this.root).catch(e => { if (e.code === 'ENOENT') return []; throw e })
    const result = []
    for (const id of names) {
      try { result.push(this.summary((await this.resolve(id)).manifest)) }
      catch (e) { if (e.code !== 'ENOENT') throw e }
    }
    return result.sort((a,b) => b.capturedAt.localeCompare(a.capturedAt))
  }
  async resolve(id) {
    await this.authorize(); taskId(id)
    const directory = Path.join(this.root, id), manifest = JSON.parse(await readFile(Path.join(directory, 'manifest.json')))
    if (manifest.projectId !== this.c.logicalProjectId || manifest.id !== id) throw Error('Backup scope mismatch')
    return { directory, manifest }
  }
}
