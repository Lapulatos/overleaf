import test from 'node:test'
import assert from 'node:assert/strict'
import { remoteWebLinks } from '../../app/src/Features/NativeGit/RemoteWebLinks.mjs'
const remote = (url, name = 'origin') => ({ name, refs: { fetch: url, push: url } })
test('maps native HTTPS and SSH remotes to provider commit pages without credentials', () => {
  for (const url of ['https://user:secret@gitee.com/owner/repo.git?token=secret#fragment', 'git@gitee.com:owner/repo.git', 'ssh://git@gitee.com/owner/repo.git']) {
    assert.deepEqual(remoteWebLinks([remote(url)]), [{ name: 'origin', provider: 'Gitee', commitBaseUrl: 'https://gitee.com/owner/repo/commit/' }])
  }
  assert.equal(remoteWebLinks([remote('https://github.com/octocat/Hello-World.git')])[0].commitBaseUrl, 'https://github.com/octocat/Hello-World/commit/')
  assert.equal(remoteWebLinks([remote('git@gitlab.com:group/subgroup/repo.git')])[0].commitBaseUrl, 'https://gitlab.com/group/subgroup/repo/-/commit/')
  assert.equal(remoteWebLinks([remote('https://bitbucket.org/team/repo')])[0].commitBaseUrl, 'https://bitbucket.org/team/repo/commits/')
})
test('omits unsupported or malformed remotes without guessing provider routes', () => {
  for (const url of ['/tmp/repository', 'https://constructor/team/repo', 'https://__proto__/team/repo', 'javascript:alert(1)', 'https://github.com.attacker.test/team/repo', 'https://github.com/team', 'https://github.com/team/repo/extra', 'https://github.com/team%2frepo/project', 'https://github.com:8443/team/repo', 'file://github.com/team/repo']) {
    assert.deepEqual(remoteWebLinks([remote(url)]), [], url)
  }
})
test('keeps separate named remote destinations', () => {
  assert.deepEqual(remoteWebLinks([remote('git@github.com:me/project.git'), remote('git@gitee.com:upstream/project.git', 'upstream')]).map(x => x.name), ['origin', 'upstream'])
})
