import { z } from '@overleaf/validation-tools'
const objectId = z.string().regex(/^[a-f0-9]{24}$/i)
const requestSchema = z.object({ userId: objectId,
  viewedCommit: z.string().regex(/^[a-f0-9]{40,64}$/).nullable().optional() }).strict()

// Mounted only behind requirePrivateApiAuth. userId is supplied by real-time's
// authenticated socket context, never by a public browser HTTP endpoint.
export function createGitPresenceHandler({ enabled, runtime }) {
  return async (req, res) => {
    if (!enabled()) return res.sendStatus(404)
    const project = objectId.safeParse(req.params.Project_id)
    const body = requestSchema.safeParse(req.body)
    if (!project.success || !body.success) return res.status(400).json({ error: 'Invalid presence request' })
    res.set('Cache-Control', 'no-store')
    try {
      const position = await runtime.presencePosition(project.data.toLowerCase(), body.data.userId.toLowerCase(), body.data.viewedCommit ?? null)
      return res.json(position)
    } catch (error) {
      if ([400,403,404,409,503].includes(error.status)) return res.status(error.status).json({ error: error.message })
      throw error
    }
  }
}
