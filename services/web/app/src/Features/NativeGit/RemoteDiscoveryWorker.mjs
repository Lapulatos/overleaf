import { readdir, access } from 'node:fs/promises'
import Path from 'node:path'
// Every process may scan; due checks and execution are serialized by the shared
// logical-project lock. No browser session is required for discovery to run.
export function startRemoteDiscoveryWorker({ root, runtime, notify, onError, intervalMs = 15000 }) {
  let stopped = false, running = false
  const tick = async () => {
    if (stopped || running) return
    running = true
    try {
      const projects = await readdir(root, { withFileTypes: true }).catch(error => {
        if (error.code === 'ENOENT') return []; throw error
      })
      for (const entry of projects) {
        if (stopped) break
        if (!entry.isDirectory() || !/^[a-f0-9]{24}$/.test(entry.name)) continue
        try {
          try { await access(Path.join(root, entry.name, 'remote-discovery', 'schedule')) }
          catch (error) { if (error.code === 'ENOENT') continue; throw error }
          const result = await runtime.runScheduledDiscovery(entry.name)
          if (result) await notify(entry.name, { command: 'discoverRemote' })
        } catch (error) { onError(error, entry.name) }
      }
    } catch (error) { onError(error) }
    finally { running = false }
  }
  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref?.()
  void tick()
  return () => { stopped = true; clearInterval(timer) }
}
