import { mkdir, open, rename, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import Path from 'node:path'

// Server-owned, project-scoped binding metadata. Call under the project lock.
// Git owns every branch, commit, index and working tree; this only records which
// native worktree is displayed in the editor and an interrupted file transfer.
export class WorkspaceStore {
  constructor(directory) {
    this.directory = Path.resolve(directory)
    this.file = Path.join(this.directory, 'workspace.json')
  }

  async read() {
    const handle = await open(this.file, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      if ((await handle.stat()).size > 64 * 1024) throw new Error('Invalid workspace binding size')
      return validate(JSON.parse(await handle.readFile('utf8')))
    } finally { await handle.close() }
  }

  async initialize(binding) {
    try { return await this.read() } catch (error) { if (error.code !== 'ENOENT') throw error }
    await this.write(binding)
    return this.read()
  }

  async beginMutation(taskId) {
    const binding = await this.read()
    if (binding.pending || binding.mutationTaskId) throw new Error('A workspace mutation is already pending')
    await this.write({ ...binding, mutationTaskId: taskId })
  }

  async finishMutation(taskId) {
    const binding = await this.read()
    if (binding.mutationTaskId !== taskId) throw new Error('Workspace mutation ownership changed')
    const { mutationTaskId, ...rest } = binding
    await this.write(rest)
  }

  async begin(pending) {
    const binding = await this.read()
    if (binding.pending || binding.mutationTaskId) throw new Error('A file transfer is already pending')
    await this.write({ ...binding, pending })
  }

  async finish(binding) {
    if ((await this.read()).mutationTaskId) throw new Error('A collaboration mutation is pending')
    await this.write({ directory: binding.directory, branch: binding.branch })
  }

  async write(binding) {
    validate(binding)
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const temporary = Path.join(this.directory, `${randomUUID()}.tmp`)
    try {
      const handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(JSON.stringify(binding))
        await handle.sync()
      } finally { await handle.close() }
      await rename(temporary, this.file)
      const directory = await open(this.directory, constants.O_RDONLY)
      try { await directory.sync() } finally { await directory.close() }
    } finally { await rm(temporary, { force: true }) }
  }
}

function validate(binding) {
  const absolute = value => typeof value === 'string' && Path.isAbsolute(value) && !value.includes('\0')
  const branch = value => value === null || (typeof value === 'string' && value.length > 0)
  if (!binding || !absolute(binding.directory) || !branch(binding.branch)) throw new Error('Invalid workspace binding')
  if (binding.mutationTaskId !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(binding.mutationTaskId)) throw new Error('Invalid mutation task identity')
  if (binding.pending) {
    const pending = binding.pending
    if (!absolute(pending.directory) || !branch(pending.branch) ||
        !(absolute(pending.previousDirectory) !== absolute(pending.beforeDirectory))) {
      throw new Error('Invalid pending file transfer')
    }
  }
  return binding
}
