import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, symlink, access, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createProjectWorkspace, fullFilePatch, validateWorkspacePath } from '../src/project-workspace.mjs'
import { documentChangesToDiffs } from '../src/backends/codex.mjs'
import { buildProposals } from '../../web/app/src/Features/WritingAssist/WritingAssistAgentService.mjs'
const doc = { id: 'a'.repeat(24), path: 'chapters/intro.tex', version: 4, content: 'Original\n' }
test('workspace mutations produce real versioned file diffs and cleanup removes temporary files', async () => {
  const workspace = await createProjectWorkspace([doc])
  try {
    await writeFile(join(workspace.directory, doc.path), 'Revised\n')
    const changes = await workspace.changes()
    assert.equal(changes.length, 1)
    assert.equal(changes[0].version, 4)
    assert.equal(buildProposals(changes, [doc])[0].after, 'Revised\n')
    assert.equal(doc.content, 'Original\n')
  } finally { await workspace.cleanup() }
  await assert.rejects(() => access(workspace.directory))
})
test('whole-file patches preserve empty files and final newline differences', () => {
  for (const before of ['', 'a', 'a\n', 'a\nb']) for (const after of ['', 'new', 'new\n', 'x\ny']) {
    if (before === after) continue
    assert.equal(buildProposals([{ content: fullFilePatch('main.tex', before, after) }], [{ ...doc, path: 'main.tex', content: before }])[0].after, after)
  }
})
test('paths cannot escape the workspace or install project agent instructions', async () => {
  for (const path of ['../main.tex', '/main.tex', 'x/../main.tex', '.codex/config.md', 'AGENTS.md', 'x\\main.tex', 'x\n.tex']) assert.throws(() => validateWorkspacePath(path))
  await assert.rejects(() => createProjectWorkspace([doc, { ...doc, path: 'Chapters/Intro.tex' }]))
})
test('symlinks are rejected without reading their target', async () => {
  const workspace = await createProjectWorkspace([doc])
  try { await symlink('/etc/passwd', join(workspace.directory, 'escape.tex')); await assert.rejects(() => workspace.changes(), /Unsupported workspace entry/) }
  finally { await workspace.cleanup() }
})
test('created and deleted documents are reported explicitly rather than silently discarded', async () => {
  const workspace = await createProjectWorkspace([doc])
  try {
    await unlink(join(workspace.directory, doc.path))
    await writeFile(join(workspace.directory, 'new.tex'), 'New')
    assert.deepEqual((await workspace.changes()).map(x => x.kind), ['delete', 'create'])
  } finally { await workspace.cleanup() }
})
test('binary and template attachments are materialized, excluded from proposals, and immutable', async()=>{
 const asset={path:'figures/plot.png',data:Buffer.from([0,255,1,2]).toString('base64')}
 const template={path:'template.cls',data:Buffer.from('template bytes').toString('base64')}
 const workspace=await createProjectWorkspace([doc],[asset,template])
 try {
  assert.deepEqual(await workspace.changes(),[])
  const {readFile,chmod}=await import('node:fs/promises')
  assert.deepEqual(await readFile(join(workspace.directory,asset.path)),Buffer.from([0,255,1,2]))
  await chmod(join(workspace.directory,asset.path),0o600)
  await writeFile(join(workspace.directory,asset.path),'modified')
  await assert.rejects(workspace.changes(),/attachment was modified/)
 }finally{await workspace.cleanup()}
})
test('attachments reject traversal, collisions, invalid base64, and deletion',async()=>{
 for(const asset of [{path:'../a.png',data:'AA=='},{path:doc.path,data:'AA=='},{path:'plot.png',data:'invalid'}]) await assert.rejects(createProjectWorkspace([doc],[asset]))
 const workspace=await createProjectWorkspace([doc],[{path:'plot.png',data:'AA=='}])
 try{await unlink(join(workspace.directory,'plot.png'));await assert.rejects(workspace.changes(),/attachment was removed/)}finally{await workspace.cleanup()}
})

test('actual removed workspace file reaches gated review as a deletion, not an empty edit', async()=>{
 const workspace=await createProjectWorkspace([doc])
 try {
  await unlink(join(workspace.directory,doc.path))
  const diffs=documentChangesToDiffs(await workspace.changes())
  assert.throws(()=>buildProposals(diffs,[doc]),{status:422})
  const [proposal]=buildProposals(diffs,[doc],{allowDeletion:true})
  assert.equal(proposal.mode,'delete-document')
  assert.equal(proposal.docId,doc.id)
  assert.equal(proposal.before,doc.content)
  assert.equal(proposal.version,doc.version)
  assert.equal(proposal.status,'pending')
 } finally {await workspace.cleanup()}
})
