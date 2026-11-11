import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ProjectGetter from '/overleaf/services/web/app/src/Features/Project/ProjectGetter.mjs'
import Entities from '/overleaf/services/web/app/src/Features/Project/ProjectEntityHandler.mjs'
import Documents from '/overleaf/services/web/app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import { withExclusiveProjectWrite } from '/overleaf/services/web/app/src/Features/NativeGit/ProjectWriteAccess.mjs'
const [project, user] = process.argv.slice(2)
const metadata = await ProjectGetter.promises.getProject(project, { name: 1, owner_ref: 1 })
assert.equal(metadata.name, 'Native Git isolated acceptance 20261109')
assert.equal(String(metadata.owner_ref), user)
const { docs } = await Entities.promises.getAllEntities(project)
const id = String(docs.find(entry => entry.path.endsWith('main.tex')).doc._id)
const before = await Documents.promises.getDocument(project, id, -1)
await withExclusiveProjectWrite(project, async () => {
  const privileged = await Documents.promises.getDocument(project, id, -1)
  assert.deepEqual(privileged.lines, before.lines)
  const rejected = await fetch(`http://127.0.0.1:3003/project/${project}/doc/${id}/conditional`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines: ['MUST NOT BE APPLIED'], source: 'git', user_id: user, expectedVersion: before.version }),
  })
  assert.equal(rejected.status, 409)
  assert.equal((await rejected.json()).code, 'PROJECT_WRITE_BUSY')
  const realtime = `
    import assert from 'node:assert/strict';
    import Manager from './app/js/DocumentUpdaterManager.js';
    import Settings from '@overleaf/settings';
    import Redis from '@overleaf/redis-wrapper';
    const [project,doc]=process.argv.slice(1);
    const redis=Redis.createClient(Settings.redis.documentupdater);
    const key=Settings.redis.documentupdater.key_schema.pendingUpdates({doc_id:doc});
    const before=await redis.llen(key);
    await assert.rejects(Manager.promises.queueChange(project,doc,{v:0,op:[{p:0,i:'MUST NOT QUEUE'}]}),/pushing update/);
    assert.equal(await redis.llen(key),before);
    console.log('PASS real-time writer refused and pending queue unchanged');process.exit(0);
  `
  const result = await promisify(execFile)('node', ['--input-type=module', '-e', realtime, project, id], {
    cwd: '/overleaf/services/real-time', timeout: 30000,
  })
  assert.match(result.stdout, /PASS real-time writer/)
  const after = await Documents.promises.getDocument(project, id, -1)
  assert.deepEqual(after.lines, before.lines)
  assert.equal(after.version, before.version)
})
const after = await Documents.promises.getDocument(project, id, -1)
assert.deepEqual(after.lines, before.lines)
console.log('PASS privileged document access, concurrent write rejection, unchanged bytes/version, released write gate')
process.exit(0)
