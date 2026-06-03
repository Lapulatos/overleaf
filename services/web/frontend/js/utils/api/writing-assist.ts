import { postJSON, getJSON, putJSON, deleteJSON } from '../../infrastructure/fetch-json'

import type {
  Category,
  CheckRequest,
  CheckResponse,
  Issue,
  TransformRequest,
  TransformResponse,
  TransformAction,
  SupportedLanguage,
  WritingAssistUserConfig,
  WritingAssistPublicConfig,
} from '../../../../types/writing-assist'

export async function checkWriting(
  text: string,
  enabledCategories: Category[],
  projectId: string,
  signal?: AbortSignal
): Promise<Issue[]> {
  const response = await postJSON<CheckResponse>('/writing-assist/check', {
    body: { text, language: 'en', enabledCategories, projectId } satisfies CheckRequest,
    signal,
  })
  return response.issues ?? []
}

export async function getConfig(): Promise<WritingAssistPublicConfig> {
  return getJSON<WritingAssistPublicConfig>('/writing-assist/config')
}

export async function saveConfig(
  config: Partial<WritingAssistUserConfig>
): Promise<void> {
  await putJSON('/writing-assist/config', { body: config })
}

/** One entry in the per-user dismiss notebook. */
export interface DismissalItem {
  id: string
  text: string
  createdAt?: string
}

export async function listDismissals(
  projectId: string
): Promise<DismissalItem[]> {
  const res = await getJSON<{ items: DismissalItem[] }>(
    `/writing-assist/dismissals?projectId=${encodeURIComponent(projectId)}`
  )
  return res.items ?? []
}

export async function addDismissal(
  text: string,
  projectId: string
): Promise<DismissalItem> {
  const res = await postJSON<{ item: DismissalItem }>(
    '/writing-assist/dismissals',
    { body: { text, projectId } }
  )
  return res.item
}

export async function updateDismissal(
  id: string,
  text: string
): Promise<DismissalItem> {
  const res = await putJSON<{ item: DismissalItem }>(
    `/writing-assist/dismissals/${encodeURIComponent(id)}`,
    { body: { text } }
  )
  return res.item
}

export async function deleteDismissal(id: string): Promise<void> {
  await deleteJSON(`/writing-assist/dismissals/${encodeURIComponent(id)}`)
}

export async function transformText(
  text: string,
  action: TransformAction,
  projectId: string,
  options?: {
    targetLanguage?: SupportedLanguage;
    customInstruction?: string;
    lengthRatio?: number;
    rewriteFidelity?: number;
    context?: { before: string; after: string };
  }
): Promise<string> {
  const body = {
    text,
    action,
    projectId,
    ...(options?.targetLanguage ? { targetLanguage: options.targetLanguage } : {}),
    ...(options?.customInstruction ? { customInstruction: options.customInstruction } : {}),
    ...(options?.lengthRatio != null ? { lengthRatio: options.lengthRatio } : {}),
    ...(options?.rewriteFidelity != null ? { rewriteFidelity: options.rewriteFidelity } : {}),
    ...(options?.context ? { context: options.context } : {}),
  } satisfies TransformRequest
  const response = await postJSON<TransformResponse>('/writing-assist/transform', {
    body,
  })
  return response.result
}
