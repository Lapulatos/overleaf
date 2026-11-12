import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import Path from 'node:path'
import { taskId } from '../../web/app/src/Features/NativeGit/CollaborationTaskStore.mjs'

// Kernel locks are released on process death. Never unlink lock files: doing so
// permits two callers to lock different inodes for the same attempt.
const holder = String.raw`
import os,sys,fcntl,select,time
fd=os.open(sys.argv[1],os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
while True:
 try:
  fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  break
 except BlockingIOError:
  if select.select([sys.stdin],[],[],0.05)[0] and not os.read(0,1): sys.exit(0)
print('locked',flush=True)
sys.stdin.buffer.read()
os.close(fd)
`
export function shellAttemptLock(directory, { timeoutMs = 30000 } = {}) {
  return async (attemptId, operation) => {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const child = spawn('python3', ['-u', '-c', holder, Path.join(directory, `${taskId(attemptId)}.lock`)], { stdio: ['pipe', 'pipe', 'pipe'] })
    let diagnostics = '', acquired = false
    child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-4096) })
    child.stdin.on('error', () => {})
    const exited = new Promise(resolve => { child.once('exit', code => resolve(code)); child.once('error', () => resolve(-1)) })
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Shell attempt lock timed out')) }, timeoutMs)
        const done = (error) => { clearTimeout(timeout); error ? reject(error) : resolve() }
        child.once('error', done)
        child.stdout.once('data', data => { if (String(data).trim() === 'locked') { acquired = true; done() } else done(new Error('Invalid lock acknowledgement')) })
        exited.then(() => { if (!acquired) done(new Error(`Shell attempt lock failed: ${diagnostics}`)) })
      })
      const result = await operation()
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('Shell attempt lock was lost')
      return result
    } finally {
      child.stdin.end()
      await exited
    }
  }
}
