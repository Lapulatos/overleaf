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
        assert.ok(path.startsWith('/'), 'Native mkdirp requires an absolute project path'); path = path.slice(1)
        assert.equal(locked, true);calls.push({ type: 'addDoc', path, origin, actor })
        source.set(path, { id: path, type: 'doc', bytes: Buffer.from(lines.join('\n')), version: 0 })
      },
      upsertFileWithPath: async (project, path, diskPath, link, origin, actor) => {
        assert.ok(path.startsWith('/'), 'Native mkdirp requires an absolute project path'); path = path.slice(1)
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

test('edit followed by undo invalidates an old mutation even when bytes match', async () => {
  const f = fixture()
  const before = await f.project.read()
  f.source.get('main.tex').version += 2
  const next = new Map(before.files); next.set('main.tex', Buffer.from('stale planned change'))
  await assert.rejects(f.project.apply(fileChanges(before.files, next), before), { status: 409 })
  assert.deepEqual(f.calls, [])
})

test('snapshot refuses documents changed during collection instead of committing mixed versions', async () => {
  const f = fixture()
  const read = f.services.documents.getDocument
  let calls = 0
  f.services.documents.getDocument = async (...args) => {
    if (++calls === 2) f.source.get('main.tex').version++
    return read(...args)
  }
  await assert.rejects(f.project.read(), { status: 409 })
  assert.deepEqual(f.calls, [])
})

test('transaction holds one write scope across snapshots and writes; leaked capability is rejected', async () => {
  const f = fixture()
  let count = 0, leaked
  const lock = f.services.withExclusiveWrite
  f.services.withExclusiveWrite = action => { count++; return lock(action) }
  const project = createOverleafProject(f.services)
  const phases = []
  await project.transaction(async tx => {
    leaked = tx
    const before = await tx.read(), next = new Map(before.files)
    next.set('main.tex', Buffer.from('transaction update'))
    await tx.apply(fileChanges(before.files, next), before, event => phases.push(event.phase))
    assert.equal((await tx.read()).files.get('main.tex').toString(), 'transaction update')
  })
  assert.equal(count, 1)
  assert.deepEqual(phases, ['before', 'after'])
  await assert.rejects(leaked.read(), /no longer active/)
  await assert.rejects(leaked.apply([], {}), /no longer active/)
})

test('lease loss after the first document stops the next write and preserves the step boundary', async () => {
  const f = fixture()
  let valid = true
  const lock = f.services.withExclusiveWrite
  f.services.withExclusiveWrite = action => lock(() => action(async () => {
    if (!valid) throw new Error('lost lease')
  }))
  const project = createOverleafProject(f.services), before = await project.read()
  const next = new Map(before.files)
  next.set('main.tex', Buffer.from('first update'))
  next.set('second.tex', Buffer.from('must not be written'))
  const phases = []
  await assert.rejects(project.transaction(tx => tx.apply(fileChanges(before.files, next), before, event => {
    phases.push(event)
    if (event.phase === 'after') valid = false
  })), /lost lease/)
  assert.equal(f.source.get('main.tex').bytes.toString(), 'first update')
  assert.equal(f.source.has('second.tex'), false)
  assert.deepEqual(phases.map(x => x.phase), ['before', 'after'])
})

test('prepared transaction refuses an unconfigured adapter instead of falling back', async () => {
 const f=fixture()
 await assert.rejects(f.project.transaction(()=>assert.fail('must not run'),{prepare:true,epoch:7}),/Prepared project write access/)
 assert.deepEqual(f.calls,[])
})
test('prepared transaction delegates epoch advancement and expires its capability on return', async () => {
 const f=fixture();let retained,advances=0,checks=0
 f.services.withPreparedWrite=async(epoch,callback)=>{
  assert.equal(epoch,7)
  return callback(async()=>{checks++},{advanceEpoch:async()=>{advances++;return 8}})
 }
 const project=createOverleafProject(f.services)
 const result=await project.transaction(async tx=>{retained=tx;return tx.advanceEpoch()},{prepare:true,epoch:7})
 assert.equal(result,8);assert.equal(advances,1);assert.ok(checks>=2)
 await assert.rejects(retained.advanceEpoch(),/no longer active/)
 assert.equal(advances,1)
})
