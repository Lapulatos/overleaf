import { isHistoryReadCommand } from './HistoryReadCommands.mjs'
import { downloadBackup } from './BackupDownload.mjs'
import { storageFailure } from './StorageCapacity.mjs'
import { gitUserError } from './GitUserError.mjs'
import { z } from '@overleaf/validation-tools'
import { commandSchema } from './GitCommands.mjs'

const projectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i)
const initializeSchema = z.object({ branch: z.string().min(1).max(255).default('main') }).strict()

export function createNativeGitHandlers({ enabled, userId, canWrite, canRead = canWrite, runtime, notify = async () => {} }) {
  async function handle(req, res, operation, stream = false, historyRead = false) {
    if (!enabled()) return res.sendStatus(404)
    const user = userId(req)
    if (!user) return res.sendStatus(401)
    const parsed = projectIdSchema.safeParse(req.params.projectId)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid project ID' })
    const projectId = parsed.data.toLowerCase()
    if (!await (historyRead ? canRead : canWrite)(String(user), projectId)) return res.sendStatus(403)
    res.set('Cache-Control', 'no-store')
    try {
      const result = await operation(projectId, String(user))
      return stream ? await downloadBackup(res, result) : res.json(result)
    }
    catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid Git command' })
      if (error.code === 'GIT_PROJECT_BUSY') {
        res.set('Retry-After', String(error.retryAfter))
        return res.status(503).json({ error: error.message, code: error.code })
      }
      if (error.code === 'GIT_CONFLICT') return res.status(409).json({ error: error.message, code: error.code })
      if (['ENOSPC', 'EDQUOT'].includes(error.code)) return res.status(507).json({ error: storageFailure().message })
      const status = error.status || error.statusCode
      if ([400, 403, 404, 409, 413, 429, 499, 502, 503, 504, 507].includes(status)) return res.status(status).json({ error: error.message })
      const refusal = gitUserError(error)
      if (refusal) return res.status(refusal.status).json({ error: refusal.error, code: 'GIT_REFUSED' })
      throw error
    }
  }
  return {
    backup: (req, res) => handle(req, res, (project, user) => runtime.backupFile(project, user, z.string().uuid().parse(req.params.backupId)), true),
    status: (req, res) => handle(req, res, (project, user) => runtime.status(project, user), false, true),
    initialize: (req, res) => handle(req, res, (project, user) => runtime.initialize(project, user, initializeSchema.parse(req.body).branch)),
    command: (req, res) => handle(req, res, async (project, user) => {
      const command = commandSchema.parse(req.body)
      try { return await runtime.execute(project, user, command) }
      finally { await notify(project, command) }
    }, false, isHistoryReadCommand(req.body?.command)),
  }
}
