import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import { createOverleafProject } from '../../app/src/Features/NativeGit/OverleafProject.mjs'
import { fileChanges } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'

function fixture() {
  const calls = []
  let locked = false
  const source = new Map([
    ['main.tex', { id: 'doc1', type: 'doc', bytes: Buffer.from('First line\nSecond line\n'), version: 7 }],
    ['figures/p.pdf', { id: 'file1', type: 'file', bytes: Buffer.from([0, 255, 10]), hash: 'a'.repeat(40) }],
  ])
  const services = {
    projectId: 'project', userId: 'user',
    entities: async () => ({
      docs: [...source].filter(([, value]) => value.type === 'doc').map(([path, value]) => ({ path: '/' + path, doc: { _id: value.id } })),
      files: [...source].filter(([, value]) => value.type === 'file').map(([path, value]) => ({ path: '/' + path, file: { _id: value.id, hash: value.hash } })),
      folders: [],
    }),
    documents: {
      getDocument: async (project, id, fromVersion) => {
        assert.equal(project, 'project')
        assert.equal(fromVersion, -1, 'Request latest document without historical operations')
        const doc = [...source.values()].find(value => value.id === id)
        return { lines: doc.bytes.toString().split('\n'), version: doc.version }
      },
      setDocument: async (project, id, actor, lines, origin, version) => {
        assert.equal(locked, true)
        const doc = [...source.values()].find(value => value.id === id)
        assert.equal(version, doc.version)
        calls.push({ type: 'setDocument', id, actor, origin, version })
        doc.bytes = Buffer.from(lines.join('\n')); doc.version++
      },
    },
    blobs: async (project, hash) => {
      assert.equal(project, 'project');assert.equal(hash, 'a'.repeat(40))
      return { stream: Readable.from([source.get('figures/p.pdf').bytes]) }
    },
    editor: {
      deleteEntityWithPath: async (project, path, origin, actor) => {
        assert.equal(locked, true);calls.push({ type: 'delete', path, origin, actor });source.delete(path)
      },
      upsertDocWithPath: async (project, path, lines, origin, actor) => {
        assert.equal(locked, true);calls.push({ type: 'addDoc', path, origin, actor })
        source.set(path, { id: path, type: 'doc', bytes: Buffer.from(lines.join('\n')), version: 0 })
      },
      upsertFileWithPath: async (project, path, diskPath, link, origin, actor) => {
        assert.equal(locked, true);assert.equal(link, null);calls.push({ type: 'addFile', path, origin, actor })
        source.set(path, { id: path, type: 'file', bytes: await readFile(diskPath), hash: 'a'.repeat(40) })
      },
    },
    isEditable: (text, { filename }) => filename.endsWith('.tex') && !text.includes('\0'),
    withExclusiveWrite: async action => { locked = true;try { return await action() } finally { locked = false } },
  }
  return { source, calls, services, project: createOverleafProject(services) }
}

test('Overleaf adapter reads native document lines and binary asset bytes without normalizing them', async () => {
  const f = fixture();const snapshot = await f.project.read()
  assert.equal(snapshot.files.get('main.tex').toString(), 'First line\nSecond line\n')
  assert.deepEqual(snapshot.files.get('figures/p.pdf'), Buffer.from([0, 255, 10]))
  assert.equal(snapshot.entries.get('main.tex').version, 7)
  assert.equal(f.calls.length, 0)
})

test('applies through existing document-version CAS and native create/delete APIs inside exclusive write scope', async () => {
  const f = fixture();const snapshot = await f.project.read()
  const next = new Map([['main.tex', Buffer.from('New title\n')], ['new.tex', Buffer.from('New doc')], ['new.pdf', Buffer.from([0, 255, 13])]])
  await f.project.apply(fileChanges(snapshot.files, next), snapshot)
  assert.deepEqual(f.calls.map(call => call.type), ['delete', 'setDocument', 'addFile', 'addDoc'])
  assert.deepEqual(f.calls.find(call => call.type === 'setDocument'), { type: 'setDocument', id: 'doc1', actor: 'user', origin: 'git-bridge', version: 7 })
  assert.deepEqual(f.source.get('new.pdf').bytes, Buffer.from([0, 255, 13]))
  assert.equal(f.source.has('figures/p.pdf'), false)
})

test('whole transfer preflight prevents any mutation if a collaborator changed one source file', async () => {
  const f = fixture();const before = await f.project.read()
  const next = new Map([['main.tex', Buffer.from('New title')]])
  f.source.get('main.tex').bytes = Buffer.from('Collaborator edit')
  await assert.rejects(f.project.apply(fileChanges(before.files, next), before), { status: 409 })
  assert.deepEqual(f.calls, [])
  assert.equal(f.source.has('figures/p.pdf'), true)
})

test('same bytes with a different document identity are not accepted as the original file', async () => {
  const f = fixture();const before = await f.project.read()
  f.source.get('main.tex').id = 'replacement'
  const next = new Map(before.files);next.set('main.tex', Buffer.from('New title'))
  await assert.rejects(f.project.apply(fileChanges(before.files, next), before), { status: 409 })
  assert.deepEqual(f.calls, [])
})

test('adapter cannot mutate a project until production exclusive-access integration is supplied', async () => {
  const f = fixture();delete f.services.withExclusiveWrite
  const project = createOverleafProject(f.services)
  await assert.rejects(project.apply([], await project.read()), /not configured/)
  assert.deepEqual(f.calls, [])
})
