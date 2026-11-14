import { z } from '../../infrastructure/Validation.mjs'
export const runnerToken = z.string().regex(/^glrt-[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/)
export const systemId = z.string().regex(/^[rs]_[a-zA-Z0-9]{6,64}$/)
export const runnerRequest = z.object({token:runnerToken,system_id:systemId,info:z.object({version:z.string().max(80).optional(),platform:z.string().max(80).optional(),architecture:z.string().max(80).optional(),executor:z.string().max(80).optional()}).passthrough().optional()}).passthrough()
