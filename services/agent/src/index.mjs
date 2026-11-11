import {fetchOfficialMetrics} from '../../web/app/src/Features/SubmissionDeadlines/OfficialMetricSources.mjs'
import {fetchLetPubInBrowser} from './letpub-browser.mjs'
import {fetchPublicPage,sourceFailureDetails} from '../../web/app/src/Features/SubmissionDeadlines/PublicPage.mjs'
import {createSourceNetwork} from './source-network.mjs'
import {createEnvironmentMaintenance} from './environment-maintenance.mjs'
// @ts-check
/**
 * overleaf-agent — Local Agent Daemon for Overleaf WritingAssist.
 *
 * Runs an Express server that accepts task requests from the Overleaf container
 * (via host.docker.internal:47291), executes them through a configurable AI
 * backend, and streams progress back via Server-Sent Events (SSE).
 */

import express from 'express'
import { validateImages } from '../../../libraries/validation-tools/image-input.mjs'
import { isIP } from 'node:net'
import { createTaskManager } from './task-manager.mjs'
import { createBackendAdapter } from './backends/index.mjs'
import { createLogger } from './logger.mjs'
import { createSpeechService } from './speech-service.mjs'
import { createModelCatalog } from './model-catalog.mjs'

const TERMINAL_STATUSES = ['completed', 'failed', 'timeout', 'cancelled']

/**
 * @param {import('./types.mjs').AgentConfig} config
 */
export async function startServer(config) {
  if (!config.agentToken) {
    throw new Error('OVERLEAF_AGENT_TOKEN or --agent-token is required')
  }
  const host = config.host || '127.0.0.1'
  if (!isIP(host)) throw new Error('Agent listen host must be an IP address')
  const log = createLogger({ level: /** @type {any} */ (config.logLevel) || 'info' })
  const app = express()
  const backend = createBackendAdapter(config)
  const taskManager = createTaskManager(backend, config)
  const sourceNetwork = await createSourceNetwork(config)
  const maintenance = await createEnvironmentMaintenance(config,{busy:()=>taskManager.getConcurrency().running>0})
  config.prepareEnvironmentRepair = maintenance ? (user,issue) => maintenance.analyze(user,issue,{fromAgent:true}) : undefined
  const speech = createSpeechService({ python: config.speechPython, model: config.speechModel })
  const getModels = createModelCatalog()

  // ── API bridge config ────────────────────────────────────────────────────
  const apiConfig = {
    waHostUrl: config.waHostUrl || 'http://127.0.0.1:3050',
  }

  // ── Middleware ──────────────────────────────────────────────────────────────

  // ── Auth middleware ──────────────────────────────────────────────────────────
  if (config.agentToken) {
    app.use('/agent', (req, res, next) => {
      const token = req.headers['x-agent-token']
      if (token !== config.agentToken) {
        return res.status(403).json({ error: 'invalid or missing X-Agent-Token header' })
      }
      next()
    })
  }
  app.use(express.json({ limit: '40mb' }))

  let officialMetricsBusy=false
  app.post('/agent/official-venue-metrics',async(req,res)=>{
    const venues=req.body?.venues
    if(!Array.isArray(venues)||venues.length>2000||venues.some(v=>!v||!['journal','conference','special-issue'].includes(v.kind)||typeof v.description!=='string'||v.description.length>500||v.year!==null&&!Number.isInteger(v.year)))return res.status(400).json({error:'Invalid venue catalog'})
    if(officialMetricsBusy)return res.status(429).json({error:'Official metric reader is busy'})
    officialMetricsBusy=true
    try{
      if(req.body.stream){res.type('application/x-ndjson');res.flushHeaders();const result=await fetchOfficialMetrics(venues,{onEntries:async part=>res.write(JSON.stringify({type:'entries',...part})+'\n')});res.end(JSON.stringify({type:'done',errors:result.errors})+'\n')}
      else res.json(await fetchOfficialMetrics(venues))
    }catch{if(res.headersSent)res.end(JSON.stringify({type:'error',error:'Official source update incomplete; saved values retained.'})+'\n');else res.status(502).json({error:'Latest official metric lists could not be retrieved; saved snapshots were retained.'})}finally{officialMetricsBusy=false}
  })

  let metricReadBusy=false
  app.post('/agent/letpub-metrics-source',async(req,res)=>{
    if(typeof req.body?.url!=='string'||req.body.url.length>2000)return res.status(400).json({error:'Invalid LetPub URL'})
    if(metricReadBusy)return res.status(429).json({error:'LetPub reader is busy'})
    metricReadBusy=true
    try{res.json(await fetchLetPubInBrowser(req.body.url))}catch{res.status(502).json({error:'LetPub could not be read. Open a signed-in LetPub tab in Chrome and enable JavaScript from Apple Events.'})}finally{metricReadBusy=false}
  })

  let sourceReads=0
  app.post('/agent/public-guide',async(req,res)=>{
    if(typeof req.body?.url!=='string'||req.body.url.length>2000)return res.status(400).json({error:'Invalid public source URL'})
    if(sourceReads>=12)return res.status(429).json({error:'Source readers are busy'})
    sourceReads++
    try{const page=await fetchPublicPage(req.body.url,0,{extendedTimeout:true});if(!/html|text/i.test(page.contentType))return res.status(422).json({error:'No HTML submission guide at this URL'});return res.json(page)}catch(e){const detail=sourceFailureDetails(e,req.body.url);return res.status(502).json({error:detail.explanation,kind:detail.kind})}finally{sourceReads--}
  })

  app.all('/agent/source-network',async(req,res)=>{
    if(!sourceNetwork)return res.status(503).json({error:'Computer owner has not configured local source access'})
    const user=req.headers['x-overleaf-user-id']
    try{if(req.method==='GET')return res.json(sourceNetwork.status(user));if(req.method!=='POST')return res.sendStatus(405)
      if(req.body?.action==='save')return res.json(await sourceNetwork.save(user,req.body))
      if(req.body?.action==='test')return res.json(await sourceNetwork.test(user,req.body.url))
      return res.status(400).json({error:'Unsupported proxy action'})
    }catch(e){return res.status(e.status||500).json({error:e.status?e.message:'Source proxy operation failed'})}
  })

  app.all('/agent/environment',async(req,res)=>{
    if(!maintenance)return res.status(503).json({error:'Computer owner has not configured environment maintenance'})
    const user=req.headers['x-overleaf-user-id']
    try{const action=req.body?.action;let value
      if(req.method==='GET')value=await maintenance.status(user)
      else if(req.method!=='POST')return res.sendStatus(405)
      else if(action==='permission')value=await maintenance.permission(user,req.body.enabled)
      else if(action==='prepare')value=await maintenance.prepare(user)
      else if(action==='diagnose')value=await maintenance.analyze(user,req.body.issue)
      else value=await maintenance.operate(user,req.body.planId,action,req.body.confirmation)
      res.json(value)
    }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Environment operation failed; inspect the maintenance record'})}
  })

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/agent/health', async (_req, res) => {
    const backendOk = await backend.healthCheck()
    const { running, max } = taskManager.getConcurrency()
    res.json({
      status: backendOk ? 'ok' : 'degraded',
      version: '0.1.0',
      backend: config.backend,
      backendOk,
      capabilities: { images: config.backend === 'codex', speech: speech.configured, documentHarness: config.backend === 'codex' && Boolean(config.compilerImage) },
      concurrency: { running, max },
    })
  })

  app.post('/agent/transcribe', async (req, res) => {
    const controller = new AbortController()
    const cancel = () => { if (!res.writableEnded) controller.abort() }
    res.on('close', cancel)
    try {
      const result = await speech.transcribe(req.body, controller.signal)
      if (!controller.signal.aborted) res.json(result)
    } catch (error) {
      if (!controller.signal.aborted) res.status(error.status || 500).json({ error: error.status ? error.message : 'Transcription failed' })
    } finally {
      res.off('close', cancel)
    }
  })

  app.get('/agent/models', async (_req, res) => {
    if (config.backend !== 'codex') return res.status(422).json({ error: 'Model selection requires the Codex backend' })
    try { res.json({ models: await getModels() }) }
    catch { res.status(503).json({ error: 'Could not load the Codex model catalog' }) }
  })

  // ── Submit task ────────────────────────────────────────────────────────────
  app.post('/agent/task', async (req, res) => {
    try {
      if(maintenance?.isBusy())return res.status(409).json({error:'Environment maintenance is running; retry after it finishes'})
      const taskRequest = req.body
      if (typeof taskRequest?.taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(taskRequest.taskId) || typeof taskRequest.type !== 'string' || !taskRequest.type) {
        return res.status(400).json({ error: 'taskId and type are required' })
      }
      if (typeof taskRequest.instruction !== 'string' || !taskRequest.instruction.trim() || taskRequest.instruction.length > 32000) {
        return res.status(400).json({ error: 'instruction is required' })
      }

      if (taskRequest.timeout !== undefined &&
          (!Number.isSafeInteger(taskRequest.timeout) || taskRequest.timeout < 1 || taskRequest.timeout > config.timeout)) {
        return res.status(400).json({ error: 'timeout must be a positive integer within the configured limit' })
      }
      if (taskRequest.context !== undefined &&
          (!taskRequest.context || typeof taskRequest.context !== 'object' || Array.isArray(taskRequest.context))) {
        return res.status(400).json({ error: 'context must be an object' })
      }
      if (taskRequest.model !== undefined || taskRequest.effort !== undefined) {
        if (config.backend !== 'codex' || !config.compilerImage) return res.status(422).json({ error: 'Model selection requires the document harness' })
        const models = await getModels()
        const selected = models.find(model => model.id === (taskRequest.model || config.model)) || (!taskRequest.model && !config.model ? models.find(model => model.isDefault) : null)
        if (!selected || (taskRequest.effort !== undefined && !selected.efforts.includes(taskRequest.effort))) return res.status(400).json({ error: 'Unsupported model or reasoning effort' })
      }

      try {
        const images = validateImages(taskRequest.context?.images)
        if (images.length && config.backend !== 'codex') return res.status(422).json({ error: 'Image input requires the Codex backend' })
        if (images.length) taskRequest.context.images = images
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }

      // Check for duplicate taskId
      const existing = taskManager.getTask(taskRequest.taskId)
      if (existing) {
        return res.status(409).json({ error: `taskId '${taskRequest.taskId}' already exists`, taskId: taskRequest.taskId })
      }

      // Concurrency cap: refuse new work when the daemon is saturated so the
      // backend CLI processes don't pile up. Caller can retry later.
      if (!taskManager.hasCapacity()) {
        const { running, max } = taskManager.getConcurrency()
        return res.status(429).json({
          error: 'too many concurrent tasks',
          running,
          max,
        })
      }

      const task = taskManager.createTask(taskRequest)
      log.info('task accepted', { taskId: task.id, type: task.type })
      // Start execution asynchronously — don't block the response
      taskManager.executeTask(task.id, apiConfig).catch((err) => {
        log.error('task execution failed', { taskId: task.id, err: err.message })
      })

      res.status(201).json({
        taskId: task.id,
        status: task.status,
        _links: {
          stream: `/agent/task/${task.id}/stream`,
          result: `/agent/task/${task.id}`,
        },
      })
    } catch (err) {
      log.error('failed to create task', { err: err.message })
      res.status(500).json({ error: 'internal server error' })
    }
  })

  // ── Cancel task ────────────────────────────────────────────────────────────
  app.delete('/agent/task/:taskId', (req, res) => {
    const task = taskManager.getTask(req.params.taskId)
    if (!task) {
      return res.status(404).json({ error: 'task not found', code: 'TASK_NOT_FOUND' })
    }
    if (task.isTerminal()) {
      return res.status(400).json({ error: 'task already terminal', status: task.status })
    }
    task.cancel()
    res.json({ taskId: task.id, status: task.status })
  })

  // ── Get task result ────────────────────────────────────────────────────────
  app.get('/agent/task/:taskId', (req, res) => {
    const task = taskManager.getTask(req.params.taskId)
    if (!task) {
      return res.status(404).json({ error: 'task not found', code: 'TASK_NOT_FOUND' })
    }
    res.json(task.toJSON())
  })

  // ── SSE progress stream ────────────────────────────────────────────────────
  app.get('/agent/task/:taskId/stream', (req, res) => {
    const task = taskManager.getTask(req.params.taskId)
    if (!task) {
      return res.status(404).json({ error: 'task not found', code: 'TASK_NOT_FOUND' })
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    })

    // Send current state immediately
    res.write(`data: ${JSON.stringify(task.toProgressEvent())}\n\n`)

    // If already finished, close the stream
    if (task.isTerminal()) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
      return
    }

    // SSE heartbeat — prevent proxy/firewall timeout
    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n')
    }, 15000)

    // Subscribe to progress updates
    const unsubscribe = task.onProgress((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
      if (TERMINAL_STATUSES.includes(event.status)) {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        res.end()
        clearInterval(heartbeat)
        unsubscribe()
      }
    })

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })

  // ── List active tasks ──────────────────────────────────────────────────────
  app.get('/agent/tasks', (_req, res) => {
    res.json(taskManager.listTasks().map((t) => t.toSummary()))
  })

  // ── Error handler ──────────────────────────────────────────────────────────
  app.use((err, _req, res, _next) => {
    log.error('server error', { err: err?.message || String(err) })
    res.status(500).json({ error: 'internal server error' })
  })

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const server = await new Promise((resolve, reject) => {
    const srv = app.listen(config.port, host, (error) => {
      if (error) return reject(error)
      log.info('daemon listening', {
        host,
        port: config.port,
        backend: config.backend,
        maxConcurrent: config.maxConcurrentTasks,
      })
      resolve(srv)
    })
    srv.once('error', reject)
  })

  function shutdown() {
    taskManager.shutdown()
    server.close()
    server.closeAllConnections()
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
  server.once('close', () => {
    taskManager.shutdown()
    process.removeListener('SIGTERM', shutdown)
    process.removeListener('SIGINT', shutdown)
  })

  return server
}
