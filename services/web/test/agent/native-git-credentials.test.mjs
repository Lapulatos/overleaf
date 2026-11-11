import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, readdir, stat } from 'node:fs/promises'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import AccessTokenEncryptor from '@overleaf/access-token-encryptor'
import { RemoteCredentials, createCredentialEncryptor } from '../../app/src/Features/NativeGit/RemoteCredentials.mjs'
import { GitRepository } from '../../app/src/Features/NativeGit/GitRepository.mjs'
const url = 'https://example.test/team/paper.git'

test('production encryption configuration round-trips with the deployed label format', async () => {
  assert.equal(createCredentialEncryptor(undefined), undefined)
  const encryptor = createCredentialEncryptor('fixture-production-key-only-32characters')
  const encrypted = await encryptor.encryptJson({ token: 'fixture' })
  assert.ok(encrypted.startsWith('nativegit-v3:'))
  assert.deepEqual(await encryptor.decryptToJson(encrypted), { token: 'fixture' })
})

test('credentials use existing encryption and remain account/repository scoped', async t => {
  const root = await mkdtemp(Path.join(tmpdir(), 'git-credentials-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const encryptor = new AccessTokenEncryptor({ cipherLabel: 'test-v3', cipherPasswords: { 'test-v3': 'fixture-only-encryption-password' } }).promises
  const a = new RemoteCredentials(Path.join(root, 'a'), encryptor)
  const b = new RemoteCredentials(Path.join(root, 'b'), encryptor)
  await a.save(url, 'alice', 'fixture-secret-token')
  assert.equal((await a.read(url)).token, 'fixture-secret-token')
  assert.equal(await b.read(url), null)
  assert.equal(await a.read('https://example.test/other.git'), null)
  const file = Path.join(root, 'a', (await readdir(Path.join(root, 'a')))[0])
  assert.equal((await readFile(file, 'utf8')).includes('fixture-secret-token'), false)
  assert.equal((await stat(file)).mode & 0o777, 0o600)
  await a.save(url, 'alice', 'replacement-token')
  assert.equal((await a.read(url)).token, 'replacement-token')
  await a.remove(url)
  assert.equal(await a.read(url), null)
  await assert.rejects(new RemoteCredentials(root).save(url, 'alice', 'token'), /encryption is not configured/)
})

test('per-command authentication never persists secrets and redacts errors', async t => {
  const root = await mkdtemp(Path.join(tmpdir(), 'git-auth-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = await GitRepository.init(root)
  await repo.addRemote('origin', url)
  const credential = { url, username: 'alice', token: 'fixture-secret-token' }
  await repo.withRemoteCredentials(url, credential, async authenticated => {
    const header = await authenticated.git.raw(['config', '--get', `http.${url}.extraHeader`])
    assert.equal(header.trim(), 'Authorization: Basic ' + Buffer.from('alice:fixture-secret-token').toString('base64'))
    assert.equal((await authenticated.git.raw(['config', '--get', 'http.followRedirects'])).trim(), 'false')
  })
  assert.equal((await readFile(Path.join(root, '.git/config'), 'utf8')).includes('Authorization'), false)
  await assert.rejects(repo.withRemoteCredentials(url, credential, async () => {
    throw new Error('Rejected fixture-secret-token ' + Buffer.from('alice:fixture-secret-token').toString('base64'))
  }), error => error.status === 502 && !error.message.includes('fixture-secret-token') && error.message.includes('[redacted]'))
  await assert.rejects(repo.withRemoteCredentials('https://other.test/repo', credential, () => {}), /mismatch/)
  await repo.git.raw(['config', '--add', 'remote.origin.pushurl', url])
  await repo.git.raw(['config', '--add', 'remote.origin.pushurl', 'https://other.test/repo'])
  await assert.rejects(repo.remoteUrl('origin', true), /one repository URL/)
})

test('authenticated HTTPS push and fetch use native smart HTTP without persisting credentials', async t => {
  const { execFile, spawn } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const { createServer } = await import('node:https')
  const { writeFile } = await import('node:fs/promises')
  const exec = promisify(execFile)
  const root = await mkdtemp(Path.join(tmpdir(), 'git-https-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const key = Path.join(root, 'key.pem'), cert = Path.join(root, 'cert.pem')
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'])
  await exec('git', ['init', '--bare', Path.join(root, 'remote.git')])
  await exec('git', ['-C', Path.join(root, 'remote.git'), 'config', 'http.receivepack', 'true'])
  const backend = Path.join((await exec('git', ['--exec-path'])).stdout.trim(), 'git-http-backend')
  const expected = 'Basic ' + Buffer.from('alice:fixture-token').toString('base64')
  let authenticatedRequests = 0
  const server = createServer({ key: await readFile(key), cert: await readFile(cert) }, (req, res) => {
    if (req.headers.authorization !== expected) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="fixture"' }); res.end(); return }
    authenticatedRequests++
    const parsed = new URL(req.url, 'https://localhost')
    const child = spawn(backend, [], { env: { ...process.env, GIT_PROJECT_ROOT: root, GIT_HTTP_EXPORT_ALL: '1',
      PATH_INFO: parsed.pathname, QUERY_STRING: parsed.search.slice(1), REQUEST_METHOD: req.method,
      CONTENT_TYPE: req.headers['content-type'] || '', CONTENT_LENGTH: req.headers['content-length'] || '', REMOTE_USER: 'alice' } })
    const chunks = []
    child.stdout.on('data', chunk => chunks.push(chunk))
    child.stderr.resume()
    child.on('error', () => { res.writeHead(500); res.end() })
    child.on('close', () => {
      const output = Buffer.concat(chunks), end = output.indexOf('\r\n\r\n')
      if (end < 0) { res.writeHead(500); res.end(); return }
      let status = 200
      const headers = {}
      for (const line of output.subarray(0, end).toString().split('\r\n')) {
        const index = line.indexOf(':')
        if (index < 0) continue
        const name = line.slice(0, index), value = line.slice(index + 1).trim()
        if (name.toLowerCase() === 'status') status = Number(value.split(' ')[0])
        else headers[name] = value
      }
      res.writeHead(status, headers); res.end(output.subarray(end + 4))
    })
    req.pipe(child.stdin)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const remote = `https://localhost:${server.address().port}/remote.git`
  const repo = await GitRepository.init(Path.join(root, 'local'))
  await repo.author('Fixture', 'fixture@example.test')
  await repo.git.addConfig('http.sslCAInfo', cert)
  await repo.addRemote('origin', remote)
  await writeFile(Path.join(repo.directory, 'paper.tex'), 'HTTPS fixture\n')
  await repo.stage(['paper.tex'])
  const commit = await repo.commit('HTTPS fixture')
  const credential = { url: remote, username: 'alice', token: 'fixture-token' }
  await assert.rejects(repo.withRemoteCredentials(remote, null, git => git.fetch()))
  await repo.withRemoteCredentials(remote, credential, git => git.push('origin', 'main', { publish: true }))
  await repo.withRemoteCredentials(remote, credential, git => git.fetch())
  assert.equal((await exec('git', ['-C', Path.join(root, 'remote.git'), 'rev-parse', 'refs/heads/main'])).stdout.trim(), commit)
  assert.ok(authenticatedRequests >= 3)
  const bare = Path.join(root, 'remote.git')
  const tree = (await exec('git', ['-C', bare, 'rev-parse', `${commit}^{tree}`])).stdout.trim()
  const incoming = (await exec('git', ['-C', bare, '-c', 'user.name=Remote Author', '-c', 'user.email=remote@example.test',
    'commit-tree', tree, '-p', commit, '-m', 'Remote update'])).stdout.trim()
  await exec('git', ['-C', bare, 'update-ref', 'refs/heads/main', incoming, commit])
  await repo.withRemoteCredentials(remote, credential, git => git.pull('origin', 'main'))
  assert.equal(await repo.head(), incoming)
  assert.equal((await readFile(Path.join(repo.directory, '.git/config'), 'utf8')).includes('fixture-token'), false)
})

test('authentication errors explain credentials rather than exposing terminal prompts or server paths', async t => {
  const root = await mkdtemp(Path.join(tmpdir(), 'git-auth-error-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = await GitRepository.init(root)
  for (const credential of [null, { url, username: 'alice', token: 'fixture' }]) {
    await assert.rejects(repo.withRemoteCredentials(url, credential, async () => {
      throw new Error(`Cloning into '${root}'...\nfatal: could not read Username for 'https://example.test': terminal prompts disabled`)
    }), error => error.status === 400 && error.message.includes(credential ? 'authentication was rejected' : 'requires authentication') && !error.message.includes(root) && !error.message.includes('terminal prompts'))
  }
})
