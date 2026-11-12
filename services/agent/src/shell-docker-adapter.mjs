import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { terminalContainerArgs } from '../../web/app/src/Features/NativeGit/TerminalContainer.mjs'
const execute = promisify(execFile)

// No retries: timeout is an unknown Docker outcome, handled by the durable
// lifecycle journal. Only attach is long-lived, and it never starts a container.
export function shellDockerAdapter({ timeout = 20000 } = {}) {
  const run = async args => (await execute('docker', args, { timeout, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 })).stdout
  const id = value => { if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid Docker container id'); return value }
  return {
    async create({ body, volume, image, name, labels, restart, autoRemove }) {
      if (!/^overleaf-draft-[a-f0-9-]{36}$/.test(name) || restart !== 'no' || autoRemove !== false) throw new Error('Invalid draft container policy')
      const args = terminalContainerArgs(body, volume, image)
      args.splice(0, 3, 'create', '-i', '--name', name, '--restart=no')
      for (const [key, value] of Object.entries(labels)) args.splice(1, 0, '--label', `${key}=${value}`)
      return (await run(args)).trim()
    },
    async inspect(name) {
      if (!/^overleaf-draft-[a-f0-9-]{36}$/.test(name)) throw new Error('Invalid draft container name')
      const records = JSON.parse(await run(['inspect', '--type=container', name]))
      if (records.length !== 1) throw new Error('Expected one draft container')
      return records[0]
    },
    async start(containerId) { await run(['start', id(containerId)]) },
    async stop(containerId) { await run(['stop', '--time=5', id(containerId)]) },
    attach(containerId) { return spawn('docker', ['attach', '--sig-proxy=false', id(containerId)], { stdio: ['pipe', 'pipe', 'pipe'] }) },
  }
}
