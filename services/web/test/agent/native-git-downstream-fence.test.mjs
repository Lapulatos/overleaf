import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import Redis from 'ioredis'
import Gate from '@overleaf/redis-wrapper/ProjectWriteGate.js'
const require = createRequire(import.meta.url)
const { createDocumentDeletionFence } = require('../../../document-updater/app/js/DocumentDeletionFence.js')
const url = process.env.NATIVE_GIT_TEST_REDIS_URL

for (const loss of ['expired', 'replaced']) {
  test(`in-flight downstream write is rejected after its project lease is ${loss}`, { skip: !url }, async t => {
    const client = new Redis(url)
    const project = randomUUID().replaceAll('-', '').slice(0, 24)
    const doc = randomUUID().replaceAll('-', '').slice(0, 24)
    const keys = Object.fromEntries(['docVersion', 'docLines'].map(name => [name, ({doc_id}) => `category2:${name}:{${doc_id}}`]))
    const gate = Gate.createProjectWriteGate(client)
    const fence = createDocumentDeletionFence(client, keys)
    t.after(async () => { await client.del(Gate.keyFor(project), keys.docVersion({doc_id:doc}), keys.docLines({doc_id:doc})); await client.quit() })
    await client.set(keys.docLines({doc_id:doc}), 'original')
    const admitted = Promise.withResolvers(), resume = Promise.withResolvers()
    let downstream
    await assert.rejects(gate.withExclusive(project, async () => {
      downstream = gate.withWriter(project, () => fence.withOperation(doc, async () => false, async () => {
        const batch = fence.batch(doc).set(keys.docLines({doc_id:doc}), 'stale replacement')
        admitted.resolve()
        await resume.promise
        return batch.exec()
      }))
      // Attach the rejection handler before releasing the paused request.
      const rejected = assert.rejects(downstream, /PROJECT_WRITE_BUSY/)
      await admitted.promise
      if (loss === 'expired') await client.del(Gate.keyFor(project))
      else await client.set(Gate.keyFor(project), randomUUID())
      await client.set(keys.docLines({doc_id:doc}), 'newer accepted content')
      resume.resolve()
      await rejected
      assert.equal(await client.get(keys.docLines({doc_id:doc})), 'newer accepted content')
    }), /being updated by Git/)
  })
}

test('stopped downstream process cannot write with an expired owner token when resumed', { skip: !url, timeout: 15000 }, async t => {
  const { spawn } = await import('node:child_process')
  const client = new Redis(url), project = randomUUID().replaceAll('-', '').slice(0,24), doc = randomUUID().replaceAll('-', '').slice(0,24), token = randomUUID()
  const key = `category2:process:{${doc}}`
  await client.set(Gate.keyFor(project),token,'PX',500)
  await client.set(key,'original')
  const source = `
    import Redis from 'ioredis'; import {createRequire} from 'node:module';
    const require=createRequire(process.cwd()+'/test/agent/native-git-downstream-fence.test.mjs');
    const Gate=require('@overleaf/redis-wrapper/ProjectWriteGate.js');
    const {createDocumentDeletionFence}=require('../../../document-updater/app/js/DocumentDeletionFence.js');
    const c=new Redis(process.env.NATIVE_GIT_TEST_REDIS_URL);
    const f=createDocumentDeletionFence(c,{docVersion:()=>${JSON.stringify(key+':version')},docLines:()=>${JSON.stringify(key)}});
    await Gate.runWithToken(${JSON.stringify(project)},${JSON.stringify(token)},()=>f.withOperation(${JSON.stringify(doc)},async()=>false,async()=>{
      process.send({ready:true});await new Promise(r=>process.once('message',r));
      try {await f.batch(${JSON.stringify(doc)}).set(${JSON.stringify(key)},'stale process').exec();process.send({wrote:true})}
      catch(e){process.send({error:e.message})}
    }));await c.quit();process.exit(0);`
  const child=spawn(process.execPath,['--input-type=module','-e',source],{stdio:['ignore','ignore','pipe','ipc'],env:process.env})
  t.after(async()=>{child.kill('SIGKILL');await client.del(key,key+':version',Gate.keyFor(project));await client.quit()})
  const message=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('child response timeout')),7000);child.once('message',v=>{clearTimeout(timer);resolve(v)})})
  assert.equal((await message()).ready,true)
  child.kill('SIGSTOP')
  await new Promise(r=>setTimeout(r,650))
  assert.equal(await client.get(Gate.keyFor(project)),null)
  await client.set(key,'newer accepted content')
  const result=message();child.send('continue');child.kill('SIGCONT')
  assert.match((await result).error,/PROJECT_WRITE_BUSY/)
  assert.equal(await client.get(key),'newer accepted content')
})
