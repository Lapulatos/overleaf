// @ts-check

import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import WritingAssistManager from './WritingAssistManager.mjs'
import WritingAssistDismissalManager from './WritingAssistDismissalManager.mjs'
import WritingAssistConfigManager from './WritingAssistConfigManager.mjs'
import WritingAssistTransformManager from './WritingAssistTransformManager.mjs'
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
    projectId: z.string(),
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
    concurrency: z.number().min(1).max(12).optional(),
    timeoutMs: z.number().min(2000).max(60000).optional(),
    analysisMode: z.enum(['lazy', 'eager']).optional(),
    underlineStyle: z.enum(['wavy', 'solid', 'dotted', 'dashed']).optional(),
  }),
})

const dismissalCreateSchema = z.object({
  body: z.object({ text: z.string().min(1).max(2000), projectId: z.string() }),
})

const dismissalListSchema = z.object({
  query: z.object({ projectId: z.string() }),
})

const dismissalUpdateSchema = z.object({
  body: z.object({ text: z.string().min(1).max(2000) }),
  params: z.object({ id: z.string() }),
})

const dismissalDeleteSchema = z.object({
  params: z.object({ id: z.string() }),
})

const transformSchema = z.object({
  body: z.object({
    text: z.string().min(1).max(8000),
    action: z.enum(['polish', 'translate', 'rewrite', 'custom', 'expand', 'condense']),
    targetLanguage: z.string().optional(),
    customInstruction: z.string().optional(),
    /** Length ratio for expand (positive) / condense (negative).
     *  Expand: 0.0 < ratio <= 5.0;  Condense: -0.8 <= ratio < 0 */
    lengthRatio: z.number().min(-0.8).max(5.0).optional(),
    /** Rewrite fidelity (0 <= fidelity <= 0.9). Higher = closer to original. */
    rewriteFidelity: z.number().min(0).max(0.9).optional(),
    projectId: z.string(),
    context: z.object({ before: z.string(), after: z.string() }).optional(),
  }),
})

/**
 * Resolve the active provider config for a user, reading the persisted config
 * (falling back to the env-seeded default when the user has none saved yet).
 *
 * @param {string} userId
 */
async function resolveProviderConfig(userId) {
  const cfg = (await WritingAssistConfigManager.promises.get(userId)) || getDefaultConfig()
  const provider = cfg.provider || 'openai'
  const providerCfgRaw = cfg[provider]
  if (!providerCfgRaw) {
    throw Object.assign(new Error('Provider not configured'), { statusCode: 400 })
  }
  const apiKey = providerCfgRaw.apiKey
    ? WritingAssistEncryption.decrypt(providerCfgRaw.apiKey, ENCRYPTION_KEY)
    : ''
  return {
    provider,
    providerConfig: {
      apiKey,
      model: providerCfgRaw.model || getDefaultModel(provider),
      endpoint: providerCfgRaw.endpoint || undefined,
      // Per-user timeout override; Manager falls back to settings default.
      timeout: typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : undefined,
    },
  }
}

function getDefaultConfig() {
  // No provider/key/endpoint is hardcoded. An optional pre-configured provider
  // can be supplied entirely via environment variables for local testing:
  //   WRITING_ASSIST_DEFAULT_API_KEY, _MODEL, _ENDPOINT
  // When unset, the custom provider is left blank and the user configures it in
  // the settings panel.
  const defaultKey = process.env.WRITING_ASSIST_DEFAULT_API_KEY || ''
  return {
    enabled: true,
    provider: 'custom',
    openai: { model: 'gpt-4o', apiKey: '' },
    anthropic: { model: 'claude-sonnet-4-6', apiKey: '' },
    custom: {
      model: process.env.WRITING_ASSIST_DEFAULT_MODEL || '',
      apiKey: defaultKey
        ? WritingAssistEncryption.encrypt(defaultKey, ENCRYPTION_KEY)
        : '',
      endpoint: process.env.WRITING_ASSIST_DEFAULT_ENDPOINT || '',
    },
    categories: { correctness: true, clarity: true, conciseness: true, delivery: true, engagement: true },
    debounceMs: 1500,
    concurrency: 4,
    timeoutMs: 20000,
    analysisMode: 'lazy',
    underlineStyle: 'solid',
  }
}


/** @param {string} provider */
function getDefaultModel(provider) {
  if (provider === 'openai') return 'gpt-4o'
  if (provider === 'anthropic') return 'claude-sonnet-4-6'
  return 'gpt-4o'
}

/** @param {any} req @param {any} res */
async function check(req, res) {
  const { body } = parseReq(req, checkSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)

  // Backstop: if the submitted text matches a note in the user's dismiss
  // notebook (diff-pattern or plain sentence), skip the LLM entirely and return
  // no issues. The frontend checker sends one sentence per request, so a single
  // match test covers it (and saves the API call/token cost).
  const dismissed = await WritingAssistDismissalManager.promises.isDismissed(
    userId,
    body.projectId,
    body.text
  )
  if (dismissed) {
    return res.json({ issues: [] })
  }

  const { provider, providerConfig } = await resolveProviderConfig(userId)
  const issues = await WritingAssistManager.promises.check({ text: body.text, enabledCategories: body.enabledCategories, provider, providerConfig })
  res.json({ issues })
}

/** @param {any} req @param {any} res */
async function getConfig(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const cfg = (await WritingAssistConfigManager.promises.get(userId)) || getDefaultConfig()
  /** @type {any} */
  const result = { enabled: cfg.enabled, provider: cfg.provider, categories: cfg.categories, debounceMs: cfg.debounceMs, concurrency: cfg.concurrency ?? 4, timeoutMs: cfg.timeoutMs ?? 20000, analysisMode: cfg.analysisMode ?? 'lazy', underlineStyle: cfg.underlineStyle ?? 'solid' }
  for (const p of ['openai', 'anthropic', 'custom']) {
    if (cfg[p]) {
      result[p] = { model: cfg[p].model, hasKey: !!cfg[p].apiKey }
      if (p === 'custom') result[p].endpoint = cfg[p].endpoint
    }
  }
  res.json(result)
}

/** @param {any} req @param {any} res */
async function putConfig(req, res) {
  const { body } = parseReq(req, configSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const existing = (await WritingAssistConfigManager.promises.get(userId)) || getDefaultConfig()
  /** @type {any} */
  const merged = { ...existing }
  if (body.enabled !== undefined) merged.enabled = body.enabled
  if (body.provider !== undefined) merged.provider = body.provider
  if (body.categories) merged.categories = { ...merged.categories, ...body.categories }
  if (body.debounceMs !== undefined) merged.debounceMs = body.debounceMs
  if (body.concurrency !== undefined) merged.concurrency = body.concurrency
  if (body.timeoutMs !== undefined) merged.timeoutMs = body.timeoutMs
  if (body.analysisMode !== undefined) merged.analysisMode = body.analysisMode
  if (body.underlineStyle !== undefined) merged.underlineStyle = body.underlineStyle
  for (const p of ['openai', 'anthropic', 'custom']) {
    const incoming = /** @type {any} */ (body)[p]
    if (incoming) {
      /** @type {any} */
      const prev = existing[p] || {}
      // Merge onto the previously stored provider config so model/endpoint
      // survive a partial save.
      merged[p] = { ...prev, ...incoming }
      if (incoming.apiKey) {
        // A non-empty key was supplied — encrypt and store it.
        merged[p].apiKey = WritingAssistEncryption.encrypt(incoming.apiKey, ENCRYPTION_KEY)
      } else {
        // Blank key means "keep the existing key" (GET never returns the real
        // key, so the UI sends blank when unchanged). Without this, saving any
        // other setting would wipe the stored key and break checking.
        merged[p].apiKey = prev.apiKey || ''
      }
    }
  }
  await WritingAssistConfigManager.promises.set(userId, merged)
  logger.info({ userId }, 'WritingAssist: config updated')
  res.sendStatus(204)
}

/** @param {any} req @param {any} res */
async function listDismissals(req, res) {
  const { query } = parseReq(req, dismissalListSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const items = await WritingAssistDismissalManager.promises.list(userId, query.projectId)
  res.json({ items })
}

/** @param {any} req @param {any} res */
async function addDismissal(req, res) {
  const { body } = parseReq(req, dismissalCreateSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const item = await WritingAssistDismissalManager.promises.add(userId, body.projectId, body.text)
  if (!item) {
    return res.status(400).json({ error: 'empty text' })
  }
  res.status(201).json({ item })
}

/** @param {any} req @param {any} res */
async function updateDismissal(req, res) {
  const { body, params } = parseReq(req, dismissalUpdateSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const item = await WritingAssistDismissalManager.promises.update(
    userId,
    params.id,
    body.text
  )
  if (!item) {
    return res.status(404).json({ error: 'not found' })
  }
  res.json({ item })
}

/** @param {any} req @param {any} res */
async function deleteDismissal(req, res) {
  const { params } = parseReq(req, dismissalDeleteSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const ok = await WritingAssistDismissalManager.promises.remove(
    userId,
    params.id
  )
  if (!ok) {
    return res.status(404).json({ error: 'not found' })
  }
  res.sendStatus(204)
}

/** @param {any} req @param {any} res */
async function transform(req, res) {
  const { body } = parseReq(req, transformSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { provider, providerConfig } = await resolveProviderConfig(userId)
  const result = await WritingAssistTransformManager.promises.transform({
    text: body.text,
    action: body.action,
    targetLanguage: body.targetLanguage,
    customInstruction: body.customInstruction,
    lengthRatio: body.lengthRatio,
    rewriteFidelity: body.rewriteFidelity,
    provider,
    providerConfig,
  })
  res.json(result)
}

export default {
  check: expressify(check),
  getConfig: expressify(getConfig),
  putConfig: expressify(putConfig),
  listDismissals: expressify(listDismissals),
  addDismissal: expressify(addDismissal),
  updateDismissal: expressify(updateDismissal),
  deleteDismissal: expressify(deleteDismissal),
  transform: expressify(transform),
}
