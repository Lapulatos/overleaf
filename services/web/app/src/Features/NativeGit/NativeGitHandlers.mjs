import { gitUserError } from './GitUserError.mjs'
import { z } from '@overleaf/validation-tools'
import { commandSchema } from './GitCommands.mjs'

const projectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i)
const initializeSchema = z.object({ branch: z.string().min(1).max(255).default('main') }).strict()

export function createNativeGitHandlers({ enabled, userId, canWrite, runtime }) {
  async function handle(req, res, operation) {
    if (!enabled()) return res.sendStatus(404)
    const user = userId(req)
    if (!user) return res.sendStatus(401)
    const parsed = projectIdSchema.safeParse(req.params.projectId)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid project ID' })
    const projectId = parsed.data.toLowerCase()
    if (!await canWrite(String(user), projectId)) return res.sendStatus(403)
    res.set('Cache-Control', 'no-store')
    try { return res.json(await operation(projectId, String(user))) }
    catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid Git command' })
      if (error.code === 'GIT_PROJECT_BUSY') {
        res.set('Retry-After', String(error.retryAfter))
        return res.status(503).json({ error: error.message, code: error.code })
      }
      if (error.code === 'GIT_CONFLICT') return res.status(409).json({ error: error.message, code: error.code })
      const status = error.status || error.statusCode
      if ([400, 403, 409, 429, 499, 502, 503, 504].includes(status)) return res.status(status).json({ error: error.message })
      const refusal = gitUserError(error)
      if (refusal) return res.status(refusal.status).json({ error: refusal.error, code: 'GIT_REFUSED' })
      throw error
    }
  }
  return {
    status: (req, res) => handle(req, res, (project, user) => runtime.status(project, user)),
    initialize: (req, res) => handle(req, res, (project, user) => runtime.initialize(project, user, initializeSchema.parse(req.body).branch)),
    command: (req, res) => handle(req, res, (project, user) => runtime.execute(project, user, commandSchema.parse(req.body))),
  }
}
