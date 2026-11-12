import { createHmac, createHash, timingSafeEqual, randomBytes, randomUUID } from 'node:crypto'
import { readDiscoverySchedule } from './RemoteDiscoverySchedule.mjs'
export const webhookConfigId = '00000000-0000-4000-8000-000000000002'
const refuse = (message, status = 409) => Object.assign(Error(message), { status })
export async function readWebhook(store) {
  try { return await store.read(webhookConfigId) } catch (e) { if (e.code !== 'ENOENT') throw e; return null }
}
export function githubRepository(url) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url)
  if (!match) throw refuse('Webhook notifications require a github.com remote.', 400)
  return match[1].toLowerCase()
}
export function publicWebhook(value) {
  if (!value) return { enabled: false, revision: 0 }
  const { enabled, revision, remote, repository, hookId, projectId, lastReceivedAt, lastDelivery, lastEvent } = value
  return { enabled, revision, remote, repository, lastReceivedAt, lastDelivery, lastEvent,
    path: `/native-git/webhooks/github/${projectId}/${hookId}` }
}
// All calls hold the same repository lock as scheduled discovery. The event is
// only a wake-up hint: refs/files are never updated from payload commit IDs.
export async function configureWebhook({ store, schedules, ownerId, projectId, command, remoteUrl, encryptor }) {
  const previous = await readWebhook(store)
  if ((previous?.revision || 0) !== command.revision) throw refuse('Webhook settings changed; reload settings.')
  if (!command.enabled) {
    if (!previous) return publicWebhook(null)
    const next = { ...previous, enabled: false, revision: previous.revision + 1, encrypted: undefined }
    await store.write(next); return publicWebhook(next)
  }
  if (!encryptor) throw refuse('Git credential encryption is not configured.', 503)
  const schedule = await readDiscoverySchedule(schedules)
  if (!schedule?.enabled || schedule.state === 'paused' || schedule.ownerId !== ownerId) throw refuse('Enable automatic remote checks before enabling webhook notifications.')
  const url = await remoteUrl(schedule.remote)
  if (url !== schedule.url) throw refuse('Remote target changed; review automatic remote checks first.')
  const repository = githubRepository(url), secret = randomBytes(32).toString('hex')
  const next = { id: webhookConfigId, revision: (previous?.revision || 0) + 1, enabled: true, ownerId, projectId,
    hookId: randomUUID(), remote: schedule.remote, url, repository, encrypted: await encryptor.encryptJson({ secret }), receipts: [] }
  await store.write(next)
  return { ...publicWebhook(next), secret }
}
export async function receiveWebhook({ store, schedules, encryptor, hookId, body, signature, delivery, event, ownerId, remoteUrl, now = Date.now }) {
  const config = await readWebhook(store)
  if (!config?.enabled || config.hookId !== hookId || config.ownerId !== ownerId) throw refuse('Webhook not found.', 404)
  if (!Buffer.isBuffer(body) || body.length > 2 * 1024 * 1024) throw refuse('Invalid webhook body.', 400)
  if (!/^sha256=[a-f0-9]{64}$/.test(signature || '')) throw refuse('Invalid webhook signature.', 401)
  if (!encryptor) throw refuse('Webhook encryption is unavailable.', 503)
  const { secret } = await encryptor.decryptToJson(config.encrypted)
  const expected = createHmac('sha256', secret).update(body).digest()
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) throw refuse('Invalid webhook signature.', 401)
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(delivery || '')) throw refuse('Invalid webhook delivery.', 400)
  if (!['push', 'ping'].includes(event)) return { ignored: true }
  let payload
  try { payload = JSON.parse(body.toString('utf8')) } catch { throw refuse('Invalid webhook JSON.', 400) }
  if (payload.repository?.full_name?.toLowerCase() !== config.repository || !Number.isSafeInteger(payload.repository?.id) || payload.repository.id < 1) throw refuse('Webhook repository does not match its binding.', 403)
  if (config.repositoryId && config.repositoryId !== payload.repository.id) throw refuse('Webhook repository identity changed.', 403)
  const schedule = await readDiscoverySchedule(schedules)
  if (!schedule?.enabled || schedule.state === 'paused' || schedule.ownerId !== ownerId || schedule.remote !== config.remote || schedule.url !== config.url || await remoteUrl(config.remote) !== config.url) throw refuse('Webhook target is no longer active; review automatic remote checks.')
  const digest = createHash('sha256').update(event).update(body).digest('hex')
  const receipts = config.receipts || []
  if (receipts.some(r => r.delivery === delivery || r.digest === digest)) return { duplicate: true }
  // Persist the wake-up before its receipt. A crash can cause another harmless
  // fetch, but cannot acknowledge and lose the wake-up. Periodic checks remain.
  if (event === 'push') await schedules.write({ ...schedule, revision: schedule.revision + 1, nextAt: Math.min(schedule.nextAt, now()) })
  await store.write({ ...config, revision: config.revision + 1, repositoryId: payload.repository.id,
    receipts: [...receipts, { delivery, digest }].slice(-256), lastReceivedAt: new Date(now()).toISOString(), lastDelivery: delivery, lastEvent: event })
  return { accepted: true, queued: event === 'push' }
}
