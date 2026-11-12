import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import type { GitSnapshot } from './types'

export type GitCommand = { command: string; [key: string]: unknown }
export type GitApi = {
  projectId?: string
  status: (signal?: AbortSignal) => Promise<GitSnapshot>
  initialize: () => Promise<GitSnapshot>
  command: (command: GitCommand) => Promise<GitSnapshot>
}

export function gitApi(projectId: string): GitApi {
  const base = `/project/${encodeURIComponent(projectId)}/native-git`
  return {
    projectId,
    status: signal => getJSON<GitSnapshot>(base, { signal }),
    initialize: () => postJSON<GitSnapshot>(`${base}/initialize`, { body: { branch: 'main' } }),
    command: async body => {
      const result = await postJSON<GitSnapshot>(`${base}/commands`, { body })
      if (result.workspaceNavigation) {
        // Reload releases old document sockets and compile responses for this tab.
        const { logicalProjectId, workspaceId } = result.workspaceNavigation
        if (!/^[a-f0-9]{24}$/i.test(logicalProjectId) || !/^[a-f0-9]{24}$/i.test(workspaceId)) {
          throw new Error('Invalid workspace destination')
        }
        window.location.assign(workspaceId === logicalProjectId
          ? `/project/${logicalProjectId}` : `/project/${logicalProjectId}/workspace/${workspaceId}`)
      }
      return result
    },
  }
}

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data as { error?: unknown }
    if (typeof data?.error === 'string') return data.error
  }
  if (error && typeof error === 'object' && 'response' in error) {
    const response = error.response as Response | undefined
    if (!response || response.status >= 500) {
      return 'The Git service connection was interrupted. Refresh repository status before retrying an operation.'
    }
  }
  return error instanceof Error ? error.message : 'Git operation failed'
}
