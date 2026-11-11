// Isolated HTTPS native Git fixture. Run only inside the candidate container.
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:https'
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import Path from 'node:path'
const exec = promisify(execFile)
const root = '/tmp/native-git-deployed-https-r21'
await mkdir(root, { recursive: true, mode: 0o755 })
await chmod(root, 0o755)

  const key = Path.join(root, 'key.pem'), cert = Path.join(root, 'cert.pem')
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'])
  await exec('git', ['init', '--bare', '--initial-branch=main', Path.join(root, 'remote.git')])
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

await writeFile(Path.join(root, 'ready.json'), JSON.stringify({url:`https://localhost:${server.address().port}/remote.git`,cert,root}))
console.log('Isolated HTTPS fixture ready')
process.on('SIGTERM', () => server.close(() => process.exit(0)))
