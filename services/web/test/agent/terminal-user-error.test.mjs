import {test} from 'node:test'
import assert from 'node:assert/strict'
import {terminalUserError} from '../../app/src/Features/NativeGit/TerminalUserError.mjs'
test('private file paths and Docker diagnostics do not reach users',()=>{
 for(const message of ["ENOENT: no such file or directory, open '/Users/private/.local/attempt.json'",'Failed to read /var/lib/overleaf/private/file','Command failed: docker inspect private-container']) {
  const safe=terminalUserError(new Error(message));assert.ok(!safe.includes('/'));assert.ok(!safe.includes('ENOENT'));assert.ok(!safe.includes('private-container'))
 }
 assert.match(terminalUserError(Error('Terminal session expired')),/Terminal session expired/)
 assert.equal(terminalUserError(Error('The session changed; refresh before deleting')),'The session changed; refresh before deleting')
})
