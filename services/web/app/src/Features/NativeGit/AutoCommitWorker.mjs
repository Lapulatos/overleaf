import { readdir, access } from 'node:fs/promises'
import Path from 'node:path'
const ids = entries => entries.filter(entry => entry.isDirectory() && /^[a-f0-9]{24}$/.test(entry.name))
async function directories(path) {
  try { return ids(await readdir(path, { withFileTypes: true })) }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
// Multiple web processes may scan. Runtime checks due state inside the shared
// logical-project operation lock; this in-process guard only prevents overlap.
export function startAutoCommitWorker({ root, runtime, notify, onError, intervalMs = 15000, folder = 'auto-commit', run = (workspace, project) => runtime.runScheduledAutoCommit(workspace, project), command = 'autoCommit' }) {
  let stopped = false, running = false
  const tick = async () => {
    if (stopped || running) return
    running = true
    try {
      for (const project of await directories(root)) {
        if (stopped) break
        try {
          for (const workspace of await directories(Path.join(root, project.name, folder))) {
            if (stopped) break
            try {
              try { await access(Path.join(root, project.name, folder, workspace.name, 'schedule')) }
              catch (error) { if (error.code === 'ENOENT') continue; throw error }
              const result = await run(workspace.name, project.name)
              if (result) await notify(workspace.name, { command })
            } catch (error) { onError(error, workspace.name) }
          }
        } catch (error) { onError(error, project.name) }
      }
    } catch (error) { onError(error) }
    finally { running = false }
  }
  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref?.()
  void tick()
  return () => { stopped = true; clearInterval(timer) }
}
