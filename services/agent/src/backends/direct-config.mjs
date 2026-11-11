/** Resolve protocol, credentials and endpoint together to avoid cross-provider
 * key fallback. Explicit options take precedence over provider-specific env. */
export function resolveDirectConfig(options, env = process.env) {
  const model = options.model || env.OVERLEAF_AGENT_MODEL
  if (!model) throw new Error('Direct backend requires --model or OVERLEAF_AGENT_MODEL')
  const selected = options.provider || env.OVERLEAF_AGENT_PROVIDER || 'auto'
  if (!['auto', 'openai', 'anthropic'].includes(selected)) {
    throw new Error('Provider must be auto, openai or anthropic')
  }
  const provider = selected === 'auto'
    ? (model.startsWith('claude-') ? 'anthropic' : 'openai')
    : selected
  const apiKey = options.apiKey || (provider === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY)
  if (!apiKey) throw new Error(`Missing API key for ${provider}`)
  const endpoint = options.endpoint || (provider === 'anthropic' ? env.ANTHROPIC_BASE_URL : env.OPENAI_BASE_URL)
    || (provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')
  const url = new URL(endpoint)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Endpoint must be an HTTP(S) base URL without embedded credentials or query parameters')
  }
  url.pathname = url.pathname.replace(/\/+$/, '')
  if (provider === 'anthropic') url.pathname = url.pathname.replace(/\/v1$/, '')
  else if (url.pathname === '' || url.pathname === '/') url.pathname = '/v1'
  return { model, provider, apiKey, endpoint: url.toString().replace(/\/$/, '') }
}
