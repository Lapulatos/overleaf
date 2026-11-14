import { randomUUID } from 'node:crypto'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import { z } from '../../infrastructure/Validation.mjs'
import { McpService } from '../../models/McpService.mjs'
import { configuration, publicService } from './McpConfiguration.mjs'

const update = z.object({ configuration, revision: z.number().int().nonnegative() }).strict()
const idSchema = z.string().uuid()
export default expressify(async (req, res) => {
  const userId = SessionManager.getLoggedInUserId(req.session).toString()
  const id = req.params.serviceId
  if (id && !idSchema.safeParse(id).success) return res.status(400).json({ error: 'Invalid service ID.' })
  const parsed = req.method === 'POST' ? configuration.safeParse(req.body) : req.method === 'PUT' ? update.safeParse(req.body) : null
  if (parsed && !parsed.success) return res.status(400).json({ error: 'Check the name, transport and connection fields. HTTP URLs must not contain credentials or fragments.' })
  try {
    if (req.method === 'GET') return res.json({ services: (await McpService.find({ userId }).sort({ createdAt: -1 }).lean()).map(publicService) })
    if (req.method === 'POST') {
      const value = await McpService.create({ ...parsed.data, _id: randomUUID(), userId })
      return res.status(201).json(publicService(value.toObject()))
    }
    if (req.method === 'PUT') {
      const { configuration: config, revision } = parsed.data
      const unset = config.transport === 'http' ? { command: '', args: '' } : { url: '' }
      const value = await McpService.findOneAndUpdate({ _id: id, userId, revision }, { $set: config, $unset: { ...unset, verifiedAt: '', tools: '' }, $inc: { revision: 1 } }, { new: true }).lean()
      if (!value) {
        const exists = await McpService.exists({ _id: id, userId })
        return res.status(exists ? 409 : 404).json({ error: exists ? 'This service changed elsewhere. Refresh before editing again.' : 'Service not found.' })
      }
      return res.json(publicService(value))
    }
    if (req.method === 'DELETE') {
      if (!(await McpService.deleteOne({ _id: id, userId })).deletedCount) return res.status(404).json({ error: 'Service not found.' })
      return res.json({ removed: true })
    }
    return res.sendStatus(405)
  } catch {
    return res.status(503).json({ error: 'MCP settings could not be saved or loaded. Please retry.' })
  }
})
