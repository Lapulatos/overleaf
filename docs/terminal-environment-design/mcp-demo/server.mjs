import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { z } from 'zod'

const app = express()
app.use(express.json({ limit: '8kb' }))
const port = Number(process.env.PORT || 3100)
const names = new Set(['get_current_time', 'echo_message'])
function createServer() {
  const server = new McpServer({ name: 'overleaf-readonly-demo', version: '1.0.0' })
  server.registerTool('get_current_time', {
    description: 'Return the current UTC time from the MCP server.', inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => ({ content: [{ type: 'text', text: JSON.stringify({ utc: new Date().toISOString(), source: 'overleaf-readonly-demo' }) }] }))
  server.registerTool('echo_message', {
    description: 'Return your text unchanged to verify a real round trip.', inputSchema: { message: z.string().min(1).max(500) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ message }) => ({ content: [{ type: 'text', text: message }] }))
  return server
}
app.post('/mcp', async (req, res) => {
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}) })
  try { await server.connect(transport); await transport.handleRequest(req, res, req.body) }
  catch { if (!res.headersSent) res.status(500).json({ error: 'MCP request failed.' }) }
})
app.get('/mcp', (_, res) => res.sendStatus(405))
app.delete('/mcp', (_, res) => res.sendStatus(405))
// The gateway only talks to this local SDK server, never to user-supplied targets.
app.post('/inspect', async (req, res) => {
  const call = req.body?.action === 'call'
  if (!['probe', 'call'].includes(req.body?.action) || (call && !names.has(req.body.name))) return res.status(400).json({ error: 'Unsupported demo action.' })
  if (call && req.body.name === 'echo_message' && (!req.body.arguments || typeof req.body.arguments.message !== 'string' || !req.body.arguments.message || req.body.arguments.message.length > 500)) return res.status(400).json({ error: 'Enter a message of 1–500 characters.' })
  const client = new Client({ name: 'overleaf-demo-inspector', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`))
  try {
    await client.connect(transport, { timeout: 5000 })
    const listing = await client.listTools({}, { timeout: 5000 })
    const tools = listing.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
    const result = call ? await client.callTool({ name: req.body.name, arguments: req.body.name === 'echo_message' ? { message: req.body.arguments.message } : {} }, undefined, { timeout: 5000 }) : undefined
    res.json({ server: client.getServerVersion(), protocol: transport.protocolVersion, verifiedAt: new Date().toISOString(), tools, ...(result ? { result } : {}) })
  } catch { res.status(502).json({ error: 'The local MCP demo did not respond. Try testing the connection again.' }) }
  finally { await client.close().catch(() => {}) }
})
app.get('/health', (_, res) => res.json({ ok: true }))
app.listen(port, '0.0.0.0', () => console.log(`Read-only MCP demo listening on ${port}`))
