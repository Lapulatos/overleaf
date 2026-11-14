import { randomUUID } from 'node:crypto'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import { McpService } from '../../models/McpService.mjs'
import { publicService } from './McpConfiguration.mjs'

export const demoUrl = 'http://overleaf-mcp-demo:3100/mcp'
const inspectorUrl = 'http://overleaf-mcp-demo:3100/inspect'
export default expressify(async (req, res) => {
  const userId = SessionManager.getLoggedInUserId(req.session).toString()
  const action = req.params.action
  try {
    if (!req.params.serviceId) {
      let service = await McpService.findOne({ userId, transport: 'http', url: demoUrl }).lean()
      if (!service) service = (await McpService.create({ _id: randomUUID(), userId, name: 'Local MCP Demo', description: 'Read-only tools: current time and message echo.', transport: 'http', url: demoUrl, revision: 0 })).toObject()
      return res.json(publicService(service))
    }
    const service = await McpService.findOne({ _id: req.params.serviceId, userId }).lean()
    if (!service) return res.status(404).json({ error: 'Service not found.' })
    if (service.transport !== 'http' || service.url !== demoUrl) return res.status(422).json({ error: 'This step supports the local read-only demo. Other service connections are not enabled yet.' })
    if (!['probe', 'call'].includes(action)) return res.sendStatus(404)
    if (action === 'call' && !['get_current_time', 'echo_message'].includes(req.body?.name)) return res.status(400).json({ error: 'Unknown demo tool.' })
    const response = await fetch(inspectorUrl, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...(action === 'call' ? { name: req.body.name, arguments: req.body.arguments } : {}) }), signal: AbortSignal.timeout(15000) })
    if (!response.ok) return res.status(response.status === 400 ? 400 : 502).json({ error: response.status === 400 ? 'Check the tool arguments (message: 1–500 characters).' : 'The demo MCP service is unavailable. Retry the connection test.' })
    const data = await response.json()
    const value = await McpService.findOneAndUpdate({ _id: service._id, userId, revision: service.revision }, { $set: { verifiedAt: new Date(data.verifiedAt), tools: data.tools.map(({ name, description }) => ({ name, description })) } }, { new: true }).lean()
    if (!value) return res.status(409).json({ error: 'Configuration changed during the request. Refresh and test again.' })
    return res.json({ service: publicService(value), server: data.server, ...(data.result ? { result: data.result } : {}) })
  } catch { return res.status(502).json({ error: 'The demo MCP service is unavailable. Retry the connection test.' }) }
})
