import { createHash, randomBytes } from 'node:crypto'
import { z } from '../../infrastructure/Validation.mjs'
export const hash = value => createHash('sha256').update(value).digest('hex')
export const secret = () => randomBytes(32).toString('base64url')
const text = z.string().trim().min(1).max(100)
const size = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const identity = z.object({ hostname: text, platform: z.enum(['linux','darwin','win32']), arch: text }).strict()
export const resources = z.object({
  scope: z.enum(['host','container']), cpuCount: z.number().int().min(1).max(65536),
  cpuTopology: z.object({sockets:z.number().int().positive().max(65536).nullable(),cores:z.number().int().positive().max(65536).nullable(),threads:z.number().int().positive().max(65536)}).strict().optional(),
  memoryTotal: size, memoryAvailable: size.nullable(), diskTotal: size.nullable(), diskFree: size.nullable(),
  load1: z.number().finite().nonnegative().nullable(),
  docker: z.object({ available: z.boolean(), cpuCount: size.nullable(), memoryTotal: size.nullable(), version: z.string().max(80).nullable() }).strict(),
  gpu: z.enum(['not-probed']),
  usage: z.object({
    cpuPercent: z.number().finite().min(0).max(100).nullable(),
    sampleSeconds: z.number().finite().positive().max(60),
    gpu: z.object({
      status: z.enum(['available','unavailable']), reason: z.string().max(150),
      devices: z.array(z.object({ name: text, utilization: z.number().finite().min(0).max(100).nullable(), memoryUsed: size.nullable(), memoryTotal: size.nullable() }).strict().refine(v=>v.memoryUsed===null||v.memoryTotal===null||v.memoryUsed<=v.memoryTotal)).max(16),
    }).strict(),
  }).strict().optional(),
}).strict().refine(v => v.memoryAvailable === null || v.memoryAvailable <= v.memoryTotal)
export const enrollment = z.object({ name: text }).strict()
export const registration = z.object({ identity, resources }).strict()
export const heartbeat = z.object({ sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), resources }).strict()
export function publicNode(node, now = Date.now()) {
  const fresh=(value,ttl)=>Number.isFinite(new Date(value).getTime())&&now-new Date(value).getTime()>=0&&now-new Date(value).getTime()<=ttl
  const standby=node.executionSettings?.mode==='on-demand'&&node.runnerPowerState==='standby'&&!node.revokedAt
  const connections={runner:node.protocol!=='gitlab-runner'?'not-configured':node.revokedAt?'revoked':standby?'standby':fresh(node.runnerLastSeenAt,45000)?'online':'offline',ssh:!node.sshConfigured?'not-configured':node.revokedAt?'revoked':!fresh(node.sshLastCheckedAt,45000)?'unknown':node.sshReachable?'online':'offline',monitor:node.revokedAt?'revoked':fresh(node.lastSeenAt,15000)?'live':node.lastSeenAt?'stale':'unknown'}
  const status = node.revokedAt ? 'revoked' : !node.registeredAt ? (new Date(node.enrollmentExpiresAt).getTime() <= now ? 'expired' : 'pending') : !standby&&fresh(node.protocol==='gitlab-runner'?node.runnerLastSeenAt:node.lastSeenAt,45000) ? 'online' : 'offline'
  return { executionSettings:node.executionSettings,runnerPowerState:node.runnerPowerState,runnerPowerError:node.runnerPowerError,connections, sshConfigured:node.sshConfigured,sshEndpoint:node.sshEndpoint,sshTunnel:node.sshTunnel,sshTunnelPort:node.sshTunnelPort,id: node._id, name: node.name, status, protocol:node.protocol||'legacy', runnerId:node.runnerId, systemId:node.systemId, runnerInfo:node.runnerInfo, runnerLastSeenAt:node.runnerLastSeenAt, identity: node.identity, resources: node.resources,
    lastSeenAt: node.lastSeenAt, registeredAt: node.registeredAt, enrollmentExpiresAt: node.enrollmentExpiresAt }
}
