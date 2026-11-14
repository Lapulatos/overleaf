import { z } from '../../infrastructure/Validation.mjs'
const text = length => z.string().trim().max(length).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
const common = { name: text(100).refine(value => value.length > 0), description: text(500).default('') }
// Configuration only. Connections must separately enforce network and execution policy.
export const configuration = z.discriminatedUnion('transport', [
  z.object({ ...common, transport: z.literal('http'), url: text(2000).refine(value => {
    try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.hash
    } catch { return false }
  }, 'Use an HTTP(S) URL without credentials or a fragment.') }).strict(),
  z.object({ ...common, transport: z.literal('stdio'), command: text(500).refine(value => value.length > 0).refine(value => !/[\r\n]/.test(value)), args: z.array(z.string().max(2000).refine(value => !/[\u0000\r\n]/.test(value))).max(50).default([]) }).strict(),
])
export function publicService(value) {
  const { _id, name, description, transport, url, command, args, revision, verifiedAt, tools } = value
  return { id: _id, name, description, transport, ...(transport === 'http' ? { url } : { command, args }), revision, status: verifiedAt ? 'verified' : 'disconnected', ...(verifiedAt ? { verifiedAt, tools: tools || [] } : {}) }
}
