import { randomBytes, randomUUID, createHash } from 'node:crypto'

const identity = value => {
  const id = String(value)
  if (!/^[a-f0-9]{24}$/.test(id)) throw Error('Invalid identity in backup')
  return id
}
const newIdentity = () => randomBytes(12).toString('hex')
const refuse = message => Object.assign(Error(message), { status: 409 })

// A restoration is a new private logical project, never an overwrite. Old
// document IDs, session epochs and runnable task leases cannot address it.
export function planBackupRestore(manifest, metadata, actorId, { allocate = newIdentity, operationId = randomUUID() } = {}) {
  identity(actorId)
  if (manifest.format !== 'overleaf-git-collaboration-backup' || manifest.version !== 1) throw refuse('Unsupported backup format')
  const sourceProjectId = identity(manifest.projectId)
  const sourceIds = manifest.workspaces.map(w => identity(w.workspaceId))
  if (new Set(sourceIds).size !== sourceIds.length || !sourceIds.includes(sourceProjectId) || metadata.length !== sourceIds.length) throw refuse('Incomplete workspace inventory')
  const ids = {}, allocated = new Set(sourceIds)
  const rememberFolder = folder => {
    allocated.add(identity(folder._id))
    for (const entry of [...(folder.docs || []), ...(folder.fileRefs || [])]) allocated.add(identity(entry._id))
    for (const nested of folder.folders || []) rememberFolder(nested)
  }
  for (const data of metadata) {
    for (const folder of data.project.rootFolder) rememberFolder(folder)
    for (const doc of data.deletedDocuments || []) allocated.add(identity(doc._id))
  }
  const reserve = old => {
    old = identity(old)
    if (ids[old]) return ids[old]
    const next = identity(allocate())
    if (allocated.has(next) || next === old) throw Error('Restore identity collision')
    allocated.add(next); ids[old] = next
    return next
  }
  for (const id of sourceIds) reserve(id)
  const restoredName = `${metadata.find(data=>String(data.project._id)===sourceProjectId)?.project.name.slice(0,139)} (restored)`
  const seen = new Set()
  const workspaces = metadata.map(data => {
    const source = data.project, sourceId = identity(source._id)
    if (!sourceIds.includes(sourceId) || seen.has(sourceId)) throw refuse('Invalid workspace metadata inventory')
    seen.add(sourceId)
    if (sourceId !== sourceProjectId && String(source.gitWorkspace?.logicalProjectId) !== sourceProjectId) throw refuse('Workspace belongs to another project')
    const oldEpoch = source.gitWorkspaceEpoch ?? source.gitWorkspace?.epoch ?? 1
    if (!Number.isSafeInteger(oldEpoch) || oldEpoch < 1 || oldEpoch >= Number.MAX_SAFE_INTEGER) throw refuse('Invalid workspace epoch')
    const remapFolder = folder => ({
      _id: reserve(folder._id), name: folder.name,
      folders: (folder.folders || []).map(remapFolder),
      docs: (folder.docs || []).map(doc => ({ _id: reserve(doc._id), name: doc.name })),
      // Linked assets are restored as captured bytes; old provider bindings are
      // not activated against a newly restored private project.
      fileRefs: (folder.fileRefs || []).map(file => ({ _id: reserve(file._id), name: file.name, hash: file.hash, size: file.size, created: file.created })),
    })
    if (source.deletedDocs?.length && !data.deletedDocuments) throw refuse('This backup lacks deleted document recovery contents; create a fresh backup')
    const deletedDocuments = (data.deletedDocuments || []).map(doc => ({ ...doc, _id: reserve(doc._id) }))
    const rootFolder = source.rootFolder.map(remapFolder)
    const documents = Object.fromEntries(Object.entries(data.documents).map(([path, doc]) => {
      if (!ids[identity(doc.id)]) throw refuse('Backup document is not present in its file tree')
      return [path, { ...doc, id: ids[doc.id] }]
    }))
    const project = {
      _id: ids[sourceId], owner_ref: actorId,
      name: restoredName,
      description: source.description, compiler: source.compiler, imageName: source.imageName,
      spellCheckLanguage: source.spellCheckLanguage, track_changes: source.track_changes,
      version: source.version, rootFolder,
      deletedDocs: deletedDocuments.map(doc=>({_id:doc._id,name:doc.name,deletedAt:doc.deletedAt})),
      rootDoc_id: source.rootDoc_id ? ids[String(source.rootDoc_id)] : undefined,
      mainBibliographyDoc_id: source.mainBibliographyDoc_id ? ids[String(source.mainBibliographyDoc_id)] : undefined,
      publicAccesLevel: 'private', collaberator_refs: [], reviewer_refs: [], readOnly_refs: [],
      gitWorkspaceEnabled: sourceId === sourceProjectId,
      gitWorkspaceFenceEnabled: true, gitWorkspacePrepareEnabled: true, gitWorkspaceEpoch: oldEpoch + 1,
      overleaf: { history: { id: ids[sourceId], display: true, rangesSupportEnabled: source.overleaf?.history?.rangesSupportEnabled === true } },
    }
    if (sourceId !== sourceProjectId) project.gitWorkspace = {
      logicalProjectId: ids[sourceProjectId], branch: source.gitWorkspace.branch,
      state: source.gitWorkspace.state === 'archived' ? 'archived' : 'ready', epoch: oldEpoch + 1,
    }
    if (source.rootDoc_id && !project.rootDoc_id) throw refuse('Root document is missing from backup')
    return { sourceId, project, documents, deletedDocuments, threads: data.threads, messages: data.messages, labels: data.labels || [] }
  })
  return {
    id: operationId, revision: 1, kind: 'backup-restore', state: 'planned', actorId,
    sourceProjectId, targetProjectId: ids[sourceProjectId], backupId: manifest.id,
    manifestHash: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
    ids, workspaces, taskPolicy: 'evidence-only', schedulePolicy: 'disabled', accessPolicy: 'owner-only',
    createdAt: Date.now(), completedSteps: [],
  }
}
