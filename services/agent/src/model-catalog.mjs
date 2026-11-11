import { tmpdir } from 'node:os'
import { createCodexAppServer } from './codex-app-server.mjs'
import { DOCUMENT_CONFIG_OVERRIDES } from './document-harness-config.mjs'
export async function readModelCatalog(client) {
  const models = []
  let cursor
  for (let page = 0; page < 10; page++) {
    const result = await client.request('model/list', { includeHidden: false, ...(cursor ? { cursor } : {}) })
    for (const model of result.data) {
      if (model.hidden) continue
      models.push({ id: model.model, name: model.displayName, isDefault: model.isDefault, defaultEffort: model.defaultReasoningEffort, efforts: model.supportedReasoningEfforts.map(option => option.reasoningEffort) })
    }
    if (!result.nextCursor) return models
    if (result.nextCursor === cursor) throw new Error('Invalid model catalog pagination')
    cursor = result.nextCursor
  }
  throw new Error('Model catalog exceeds page limit')
}
export function createModelCatalog({ createClient = createCodexAppServer, ttl = 300000 } = {}) {
  let cached, expires = 0, pending
  return async function getModels() {
    if (cached && Date.now() < expires) return cached
    if (pending) return pending
    pending = (async () => {
      const client = await createClient({ cwd: tmpdir(), configOverrides: DOCUMENT_CONFIG_OVERRIDES })
      try { cached = await readModelCatalog(client); expires = Date.now() + ttl; return cached }
      finally { await client.close() }
    })()
    try { return await pending } finally { pending = undefined }
  }
}
