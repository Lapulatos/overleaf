import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'

// Private stdio connection: no listening port, credentials or raw logs exposed.
export async function createCodexAppServer({ cwd, onNotification = () => {}, onRequest, spawnProcess = spawn, requestTimeout = 30000, configOverrides = [] } = {}) {
  const proc = spawnProcess('codex', ['app-server', '--listen', 'stdio://', '-c', 'analytics.enabled=false', ...configOverrides.flatMap(value => ['-c', value])], {
    cwd, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
  })
  let nextId = 1, buffer = '', total = 0, closed = false, stopped = false
  const pending = new Map()
  const decoder = new StringDecoder('utf8')
  let resolveClosed
  const didClose = new Promise(resolve => { resolveClosed = resolve })
  function rejectPending(error) {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error) }
    pending.clear()
  }
  function kill(signal) {
    try {
      if (process.platform !== 'win32' && proc.pid) process.kill(-proc.pid, signal)
      else proc.kill(signal)
    } catch { /* process may already have exited */ }
  }
  function fail(message) {
    rejectPending(new Error(message))
    kill('SIGTERM')
  }
  function send(message) {
    if (closed || stopped) throw new Error('Codex connection closed')
    proc.stdin.write(JSON.stringify(message) + '\n')
  }
  async function receive(message) {
    if (!message || typeof message !== 'object') throw new Error('Invalid Codex response')
    if (message.method) {
      if (message.id !== undefined) {
        try {
          if (!onRequest) {
            send({ id: message.id, error: { code: -32601, message: 'Unsupported host request' } })
            return
          }
          const result = await onRequest(message.method, message.params)
          send({ id: message.id, result })
        } catch {
          if (!closed && !stopped) send({ id: message.id, error: { code: -32603, message: 'Host tool request failed' } })
        }
      } else onNotification(message.method, message.params)
      return
    }
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id); clearTimeout(entry.timer)
    if (message.error) entry.reject(new Error(`Codex ${entry.method} failed (${message.error.code ?? 'unknown'})`))
    else entry.resolve(message.result)
  }
  proc.stdout.on('data', chunk => {
    total += chunk.length
    buffer += decoder.write(chunk)
    if (total > 64 * 1024 * 1024 || buffer.length > 4 * 1024 * 1024) return fail('Codex output exceeds limit')
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1)
      if (!line.trim()) continue
      try { void receive(JSON.parse(line)).catch(() => fail('Invalid Codex protocol message')) }
      catch { return fail('Invalid Codex protocol JSON') }
    }
  })
  proc.stderr.resume()
  proc.stdin.on('error', () => fail('Codex input connection failed'))
  proc.on('error', () => { closed = true; rejectPending(new Error('Could not start Codex app-server')); resolveClosed() })
  proc.on('close', () => { closed = true; rejectPending(new Error('Codex app-server exited')); resolveClosed() })
  function request(method, params = {}) {
    if (closed || stopped) return Promise.reject(new Error('Codex connection closed'))
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Codex ${method} timed out`)) }, requestTimeout)
      pending.set(id, { method, resolve, reject, timer })
      try { send({ id, method, params }) } catch (error) { clearTimeout(timer); pending.delete(id); reject(error) }
    })
  }
  async function close() {
    if (closed) return
    stopped = true
    rejectPending(new Error('Codex connection closed'))
    proc.stdin.end()
    kill('SIGTERM')
    const escalation = setTimeout(() => kill('SIGKILL'), 2000)
    await didClose
    clearTimeout(escalation)
  }
  try {
    await request('initialize', { clientInfo: { name: 'overleaf_document_harness', title: 'Overleaf Document Harness', version: '0.1.0' }, capabilities: { experimentalApi: true } })
    send({ method: 'initialized', params: {} })
    return { request, close }
  } catch (error) { await close(); throw error }
}
