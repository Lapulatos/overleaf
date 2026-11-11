import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { readGraphSettings, saveGraphSettings } from '../../app/src/Features/NativeGit/GraphSettings.mjs'
test('graph settings persist per user and reject executable link schemes and incomplete identities', async t => {
 const root = await mkdtemp(Path.join(tmpdir(), 'native-git-settings-')); t.after(() => rm(root, { recursive: true, force: true }))
 const defaults = await readGraphSettings(root, 'user1')
 await saveGraphSettings(root, 'user1', { ...defaults, name: 'Paper', firstParent: true, userName: 'Writer', userEmail: 'writer@example.test', issueUrl: 'https://example.com/issues/{issue}' })
 assert.equal((await readGraphSettings(root, 'user1')).firstParent, true)
 assert.equal((await readGraphSettings(root, 'user2')).firstParent, false)
 await assert.rejects(saveGraphSettings(root, 'user1', { ...defaults, issueUrl: 'javascript:alert(1)' }))
 await assert.rejects(saveGraphSettings(root, 'user1', { ...defaults, userName: 'Writer' }))
})
