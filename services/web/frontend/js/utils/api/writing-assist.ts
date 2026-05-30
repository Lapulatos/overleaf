import { postJSON, getJSON } from '../../infrastructure/fetch-json'

import type {
  Category,
  CheckRequest,
  CheckResponse,
  Issue,
  WritingAssistUserConfig,
  WritingAssistPublicConfig,
} from '../../../../types/writing-assist'

export async function checkWriting(
  text: string,
  enabledCategories: Category[]
): Promise<Issue[]> {
  const body: CheckRequest = {
    text,
    language: 'en',
    enabledCategories,
  }
  const response = await postJSON<CheckResponse>(
    '/writing-assist/check',
    { body }
  )
  return response.issues ?? []
}

export async function getConfig(): Promise<WritingAssistPublicConfig> {
  return getJSON<WritingAssistPublicConfig>('/writing-assist/config')
}

export async function saveConfig(
  config: Partial<WritingAssistUserConfig>
): Promise<void> {
  await postJSON('/writing-assist/config', { body: config })
}
