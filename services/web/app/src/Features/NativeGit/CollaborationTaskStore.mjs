import { constants } from 'node:fs'
import { mkdir, open, rename, readdir, rm } from 'node:fs/promises'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'

export function taskId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw Object.assign(new Error('Invalid collaboration task identity'), { status: 400 })
  }
  return value.toLowerCase()
}

// All mutations must hold the project's repository lock. Atomic durable rename
// preserves an explainable task state if the process stops between Git steps.
export class CollaborationTaskStore {
  constructor(directory) { this.directory = Path.resolve(directory) }
  async read(id) {
    const handle = await open(Path.join(this.directory, `${taskId(id)}.json`), constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      if ((await handle.stat()).size > 8 * 1024 * 1024) throw new Error('Collaboration task is too large')
      const state = JSON.parse(await handle.readFile('utf8'))
      if (state.id !== taskId(id) || !Number.isSafeInteger(state.revision) || state.revision < 1) throw new Error('Invalid collaboration task')
      return state
    } finally { await handle.close() }
  }
  async write(state) {
    const id = taskId(state.id)
    if (!Number.isSafeInteger(state.revision) || state.revision < 1) throw new Error('Invalid task revision')
    const json = JSON.stringify(state)
    if (Buffer.byteLength(json) > 8 * 1024 * 1024) throw new Error('Collaboration task is too large')
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const temporary = Path.join(this.directory, `${randomUUID()}.tmp`)
    try {
      const handle = await open(temporary, 'wx', 0o600)
      try { await handle.writeFile(json); await handle.sync() } finally { await handle.close() }
      await rename(temporary, Path.join(this.directory, `${id}.json`))
      const folder = await open(this.directory, constants.O_RDONLY)
      try { await folder.sync() } finally { await folder.close() }
    } finally { await rm(temporary, { force: true }) }
  }
  async list() {
    const names = await readdir(this.directory).catch(error => { if (error.code === 'ENOENT') return []; throw error })
    return Promise.all(names.filter(name => name.endsWith('.json')).map(name => this.read(name.slice(0, -5))))
  }
}
