import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { validateFiles, fileChanges, writeWorktree } from '../../app/src/Features/NativeGit/WorktreeFiles.mjs'
const files = paths => new Map(paths.map(p => [p, Buffer.from(p)]))
for (const paths of [['main.tex', 'Main.tex'], ['Figures/a.png','figures/b.png'], ['FIGURES','figures/a.png'], ['café.tex','cafe\u0301.tex']]) {
  test(`reject ambiguous paths before import: ${paths.join(', ')}`, () => {
    assert.throws(() => validateFiles(files(paths)), {code:'PROJECT_PATH_COLLISION',status:409})
  })
}
test('ordinary distinct files and a case-only rename remain valid', () => {
  assert.equal(validateFiles(files(['main.tex','figures/a.png','figures/b.png'])).size,3)
  const changes=fileChanges(files(['main.tex']),files(['Main.tex']))
  assert.equal(changes.length,2)
})
test('rejected collision does not remove or overwrite existing worktree bytes', async t => {
  const directory=await mkdtemp(Path.join(tmpdir(),'git-case-collision-'))
  t.after(()=>rm(directory,{recursive:true,force:true}))
  await writeFile(Path.join(directory,'main.tex'),'collaborator edits')
  await assert.rejects(writeWorktree(directory,files(['Main.tex','main.tex'])),{code:'PROJECT_PATH_COLLISION'})
  assert.equal(await readFile(Path.join(directory,'main.tex'),'utf8'),'collaborator edits')
})
