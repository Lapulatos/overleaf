import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import Path from 'node:path'
import { tmpdir } from 'node:os'
import { startRemoteDiscoveryWorker } from '../../app/src/Features/NativeGit/RemoteDiscoveryWorker.mjs'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
test('worker scans only configured projects, publishes state changes and stops', async t => {
 const root = await mkdtemp(Path.join(tmpdir(), 'discovery-worker-'))
 t.after(() => rm(root, { recursive: true, force: true }))
 const configured = 'a'.repeat(24), empty = 'b'.repeat(24)
 await mkdir(Path.join(root, configured, 'remote-discovery', 'schedule'), { recursive: true })
 await mkdir(Path.join(root, empty))
 await mkdir(Path.join(root, 'invalid', 'remote-discovery', 'schedule'), { recursive: true })
 const calls = [], events = [], errors = []
 const stop = startRemoteDiscoveryWorker({ root, intervalMs: 10,
  runtime: { runScheduledDiscovery: async id => { calls.push(id); return calls.length === 1 ? { policy: {} } : null } },
  notify: async (...args) => events.push(args), onError: error => errors.push(error),
 })
 t.after(stop)
 for (let i = 0; i < 100 && !events.length; i++) await delay(10)
 assert.deepEqual(events, [[configured, { command: 'discoverRemote' }]])
 assert.ok(calls.length > 0); assert.ok(calls.every(id => id === configured)); assert.deepEqual(errors, [])
 stop(); await delay(30); const count = calls.length; await delay(30); assert.equal(calls.length, count)
})
test('worker does not overlap scans while execution is pending', async t => {
 const root = await mkdtemp(Path.join(tmpdir(), 'discovery-worker-'))
 t.after(() => rm(root, { recursive: true, force: true }))
 await mkdir(Path.join(root, 'a'.repeat(24), 'remote-discovery', 'schedule'), { recursive: true })
 let calls = 0, release
 const pending = new Promise(resolve => { release = resolve })
 const stop = startRemoteDiscoveryWorker({ root, intervalMs: 5,
  runtime: { runScheduledDiscovery: async () => { calls++; await pending; return null } },
  notify: async () => {}, onError: error => { throw error },
 })
 t.after(() => { stop(); release() })
 for (let i = 0; i < 100 && !calls; i++) await delay(10)
 await delay(50); assert.equal(calls, 1)
 stop(); release(); await delay(20); assert.equal(calls, 1)
})
