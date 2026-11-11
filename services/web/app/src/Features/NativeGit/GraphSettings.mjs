import { z } from '@overleaf/validation-tools'
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import Path from 'node:path'
import { randomUUID } from 'node:crypto'
const text = z.string().max(1024).refine(value => !/[\0\r\n]/.test(value))
const link = text.refine(value => !value || /^https?:\/\//.test(value))
export const graphSettingsSchema = z.object({
  name: text.default(''), initialMode: z.enum(['all', 'auto', 'selected']).default('all'), initialRefs: z.array(text).max(100).default([]),
  showRemotes: z.boolean().default(true), showTags: z.boolean().default(true), showStashes: z.boolean().default(true),
  includeReflogs: z.boolean().default(false), firstParent: z.boolean().default(false),
  userName: text.default(''), userEmail: text.default(''), hiddenRemotes: z.array(text).max(100).default([]),
  issueUrl: link.default(''), pullRequestUrl: link.default(''),
}).strict().refine(value => !!value.userName === !!value.userEmail, 'Provide both name and email')
export async function readGraphSettings(root, user) {
  try { return graphSettingsSchema.parse(JSON.parse(await readFile(Path.join(root, 'graph-settings', user + '.json'), 'utf8'))) }
  catch (error) { if (error.code === 'ENOENT') return graphSettingsSchema.parse({}); throw error }
}
export async function saveGraphSettings(root, user, input) {
  const value = graphSettingsSchema.parse(input), directory = Path.join(root, 'graph-settings')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const temporary = Path.join(directory, randomUUID() + '.tmp')
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' })
  await rename(temporary, Path.join(directory, user + '.json'))
  return value
}
