import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createCitationService,
  assertCitationAbsent,
} from '../../app/src/Features/WritingAssist/WritingAssistCitationService.mjs'
const citation = {
  doi: '10.1234/example',
  key: 'Author2024_abcd',
  title: 'Paper',
  bibtex: '@article{Author2024_abcd,\n doi={10.1234/example}\n}\n',
  source: 'Crossref',
  url: 'https://doi.org/10.1234/example',
}
function fixture(documents = []) {
  const records = new Map()
  const state = { allowed: true, lookups: 0 }
  const service = createCitationService({
    canWrite: async () => state.allowed,
    literature: {
      lookup: async () => {
        state.lookups++
        return citation
      },
    },
    snapshot: async () => structuredClone(documents),
    store: { create: async (task) => records.set(task.id, task) },
    tasks: {
      get: async (user, project, id) => ({ ...records.get(id), taskId: id }),
    },
  })
  return { service, records, state }
}
test('new bibliography preview creates only a pending proposal, with source provenance', async () => {
  const f = fixture()
  const result = await f.service.preview('u', 'p', citation.doi, {
    newName: 'references.bib',
  })
  assert.equal(result.task.proposals[0].mode, 'create-bibliography')
  assert.equal(result.task.proposals[0].status, 'pending')
  assert.equal(result.task.proposals[0].before, '')
  assert.equal(result.task.proposals[0].after, citation.bibtex)
  assert.deepEqual(result.task.proposals[0].citation, {
    doi: citation.doi,
    key: citation.key,
  })
  assert.match(result.task.summary, /Source: Crossref/)
})
test('existing bibliography preview preserves original text and exact version', async () => {
  const f = fixture([
    { id: 'bib', path: 'refs/library.bib', content: '% existing', version: 7 },
  ])
  const { task } = await f.service.preview('u', 'p', citation.doi, {
    docId: 'bib',
  })
  assert.equal(task.proposals[0].version, 7)
  assert.equal(task.proposals[0].after, '% existing\n\n' + citation.bibtex)
  assert.equal(task.proposals[0].docId, 'bib')
  assert.equal(task.proposals[0].mode, undefined)
})
test('duplicate DOI is rejected without altering existing records', async () => {
  for (const content of [
    'doi = {10.1234/EXAMPLE}',
    'url={https://doi.org/10.1234/example}',
  ]) {
    const f = fixture([{ id: 'bib', path: 'refs.bib', content, version: 1 }])
    await assert.rejects(
      f.service.preview('u', 'p', citation.doi, { docId: 'bib' }),
      { status: 409 }
    )
    assert.equal(f.records.size, 0)
  }
  assert.doesNotThrow(() =>
    assertCitationAbsent(
      [{ path: 'refs.bib', content: 'doi={10.1234/example-other}' }],
      citation
    )
  )
})
test('unsafe destinations, non-bibliography targets and existing new names are refused', async () => {
  const f = fixture([
    { id: 'doc', path: 'main.tex', content: '', version: 1 },
    { id: 'bib', path: 'references.bib', content: '', version: 0 },
  ])
  for (const destination of [
    { newName: '../references.bib' },
    {},
    { docId: 'bib', newName: 'new.bib' },
  ])
    await assert.rejects(
      f.service.preview('u', 'p', citation.doi, destination),
      { status: 400 }
    )
  await assert.rejects(
    f.service.preview('u', 'p', citation.doi, { docId: 'doc' }),
    { status: 404 }
  )
  await assert.rejects(
    f.service.preview('u', 'p', citation.doi, { newName: 'references.bib' }),
    { status: 409 }
  )
})
test('revoked access is checked before provider requests and document reads', async () => {
  const f = fixture()
  f.state.allowed = false
  await assert.rejects(
    f.service.preview('u', 'p', citation.doi, { newName: 'references.bib' }),
    { status: 403 }
  )
  await assert.rejects(f.service.destinations('u', 'p'), { status: 403 })
  assert.equal(f.state.lookups, 0)
})

test('batch creates one versioned proposal, skips existing and repeated DOI, and preserves provenance', async () => {
  const a = { ...citation, sourceId: 'users/1/items/ABCDEFGH' }
  const b = { ...citation, doi: '10.1234/second', key: 'Second', title: 'Second paper', bibtex: '@article{Second,doi={10.1234/second}}\n' }
  const records = []
  const service = createCitationService({ canWrite: async () => true,
    literature: { lookup: async (u,p,id) => id === 'b' ? b : a },
    snapshot: async () => [{ id: 'bib', path: 'refs.bib', version: 2, content: a.bibtex }],
    store: { create: async record => records.push(record) }, tasks: { get: async () => records[0] } })
  const result = await service.preview('u','p',['a','b','b'],{ docId: 'bib' })
  assert.equal(records.length,1);assert.equal(result.task.proposals.length,1)
  assert.equal(result.skipped.length,2);assert.equal(result.citations.length,1)
  const proposal = result.task.proposals[0]
  assert.equal(proposal.version,2);assert.equal(proposal.before,a.bibtex)
  assert.equal(proposal.after,a.bibtex+'\n'+b.bibtex)
  assert.deepEqual(proposal.citations,[{doi:b.doi,key:b.key}])
  assert.match(result.task.summary,/Skipped 2/)
})
test('batch lookup failure, all duplicates and oversized selections never create partial tasks', async () => {
  const records=[]
  const service=createCitationService({canWrite:async()=>true,
    literature:{lookup:async(u,p,id)=>{if(id==='bad')throw new Error('provider failed');return citation}},
    snapshot:async()=>[],store:{create:async record=>records.push(record)},tasks:{get:async()=>records[0]}})
  await assert.rejects(service.preview('u','p',['ok','bad'],{newName:'refs.bib'}),/provider failed/)
  await assert.rejects(service.preview('u','p',[],{newName:'refs.bib'}),{status:400})
  await assert.rejects(service.preview('u','p',Array(51).fill('ok'),{newName:'refs.bib'}),{status:400})
  assert.equal(records.length,0)
  const f=fixture([{id:'bib',path:'refs.bib',content:citation.bibtex,version:1}])
  await assert.rejects(f.service.preview('u','p',['ok'],{docId:'bib'}),{status:409})
  assert.equal(f.records.size,0)
})
test('batch of two distinct references has one combined change and two duplicate guards', async()=>{
 const records=[]
 const service=createCitationService({canWrite:async()=>true,literature:{lookup:async(u,p,id)=>({...citation,doi:'10.1234/'+id,key:id,bibtex:`@article{${id},doi={10.1234/${id}}}\n`})},snapshot:async()=>[],store:{create:async r=>records.push(r)},tasks:{get:async()=>records[0]}})
 const {task}=await service.preview('u','p',['one','two'],{newName:'refs.bib'})
 assert.equal(task.proposals.length,1);assert.equal(task.proposals[0].citations.length,2)
 assert.match(task.proposals[0].after,/@article{one/);assert.match(task.proposals[0].after,/@article{two/)
})

test('a different reference with a colliding key receives a suffix without changing existing entries', async () => {
  const existing = `@article{${citation.key}, title={Other}}`
  const f = fixture([{ id: 'bib', path: 'refs.bib', content: existing, version: 1 }])
  const result = await f.service.preview('u', 'p', citation.doi, { docId: 'bib' })
  assert.equal(result.citation.key, citation.key + 'a')
  assert.ok(result.task.proposals[0].after.startsWith(existing))
  assert.match(result.citation.bibtex, /Author2024_abcda/)
})
