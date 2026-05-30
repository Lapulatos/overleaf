// @ts-check

import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import WritingAssistManager from './WritingAssistManager.mjs'
import WritingAssistEncryption from './WritingAssistEncryption.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'

const ENCRYPTION_KEY = settings.writingAssist?.encryptionKey ?? 'dev-key-change-me'

const checkSchema = z.object({
  body: z.object({
    text: z.string(),
    language: z.literal('en'),
    enabledCategories: z.array(
      z.enum(['correctness', 'clarity', 'conciseness', 'delivery', 'engagement'])
    ),
    context: z.object({ before: z.string(), after: z.string() }).optional(),
  }),
})

const configSchema = z.object({
  body: z.object({
    enabled: z.boolean().optional(),
    provider: z.enum(['openai', 'anthropic', 'custom']).optional(),
    openai: z.object({
      apiKey: z.string(), model: z.string(), endpoint: z.string().optional(),
    }).optional(),
    anthropic: z.object({
      apiKey: z.string(), model: z.string(), endpoint: z.string().optional(),
    }).optional(),
    custom: z.object({
      apiKey: z.string(), endpoint: z.string(), model: z.string(),
    }).optional(),
    categories: z.object({
      correctness: z.boolean().optional(), clarity: z.boolean().optional(),
      conciseness: z.boolean().optional(), delivery: z.boolean().optional(),
      engagement: z.boolean().optional(),
    }).optional(),
    debounceMs: z.number().min(500).max(5000).optional(),
  }),
})

/** @type {Map<string, any>} */
const userConfigs = new Map()

function resolveProviderConfig(userId) {
  const cfg = userConfigs.get(userId) || getDefaultConfig()
  const provider = cfg.provider || 'openai'
  const providerCfgRaw = cfg[provider]
  if (!providerCfgRaw) {
    throw Object.assign(new Error('Provider not configured'), { statusCode: 400 })
  }
  const apiKey = providerCfgRaw.apiKey
    ? WritingAssistEncryption.decrypt(providerCfgRaw.apiKey, ENCRYPTION_KEY)
    : ''
  return { provider, providerConfig: { apiKey, model: providerCfgRaw.model || getDefaultModel(provider), endpoint: providerCfgRaw.endpoint || undefined } }
}

function getDefaultConfig() {
  return {
    enabled: true, provider: 'openai',
    openai: { model: 'gpt-4o', apiKey: '' },
    anthropic: { model: 'claude-sonnet-4-6', apiKey: '' },
    custom: null,
    categories: { correctness: true, clarity: true, conciseness: true, delivery: false, engagement: false },
    debounceMs: 1500,
  }
}

function getDefaultModel(provider) {
  if (provider === 'openai') return 'gpt-4o'
  if (provider === 'anthropic') return 'claude-sonnet-4-6'
  return 'gpt-4o'
}

async function check(req, res) {
  const { body } = parseReq(req, checkSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { provider, providerConfig } = resolveProviderConfig(userId)
  const issues = await WritingAssistManager.promises.check({ text: body.text, enabledCategories: body.enabledCategories, provider, providerConfig })
  res.json({ issues })
}

async function getConfig(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const cfg = userConfigs.get(userId) || getDefaultConfig()
  const result = { enabled: cfg.enabled, provider: cfg.provider, categories: cfg.categories, debounceMs: cfg.debounceMs }
  for (const p of ['openai', 'anthropic', 'custom']) {
    if (cfg[p]) {
      result[p] = { model: cfg[p].model, hasKey: !!cfg[p].apiKey }
      if (p === 'custom') result[p].endpoint = cfg[p].endpoint
    }
  }
  res.json(result)
}

async function putConfig(req, res) {
  const { body } = parseReq(req, configSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const existing = userConfigs.get(userId) || getDefaultConfig()
  const merged = { ...existing }
  if (body.enabled !== undefined) merged.enabled = body.enabled
  if (body.provider !== undefined) merged.provider = body.provider
  if (body.categories) merged.categories = { ...merged.categories, ...body.categories }
  if (body.debounceMs !== undefined) merged.debounceMs = body.debounceMs
  for (const p of ['openai', 'anthropic', 'custom']) {
    if (body[p]) {
      merged[p] = { ...body[p] }
      if (body[p].apiKey) {
        merged[p].apiKey = WritingAssistEncryption.encrypt(body[p].apiKey, ENCRYPTION_KEY)
      }
    }
  }
  userConfigs.set(userId, merged)
  logger.info({ userId }, 'WritingAssist: config updated')
  res.sendStatus(204)
}

export default {
  check: expressify(check),
  getConfig: expressify(getConfig),
  putConfig: expressify(putConfig),
}
