import type { GitApi } from './api'

// Attach the existing terminal view to a retained draft. Closing the view only
// detaches it; stopping and sealing is an explicit action in the draft dialog.
export function shellTerminalApi(api: GitApi, draftId: string): GitApi {
  let cursor = 0, generation = 0
  return {
    ...api,
    projectId: `${api.projectId || "project"}/terminal/${draftId}`,
    command: async body => {
      if (body.command === 'terminalOpen') {
        generation++; cursor = 0
        const response = await api.command({ command: 'shellDraftGet', id: draftId })
        if ((response.result as { state?: string })?.state !== 'running') {
          throw new Error('This draft has no running shell. Refresh its status.')
        }
        if ((response.result as {permissionMode?:string}).permissionMode === 'auto-review') throw new Error('This older reviewed session cannot accept interactive input. Create a new terminal; its existing files are retained.')
        return { ...response, result: { id: draftId, directory: 'Private shell draft' } }
      }
      if (body.command === 'terminalClose') return { connected: true }
      if (body.command === 'accessPolicy') { const response=await api.command({command:'shellDraftGet',id:draftId});return {...response,result:{mode:(response.result as {permissionMode?:string}).permissionMode || 'workspace-write',directories:[]}} }
      switch (body.command) {
        case 'terminalPoll': {
          const current = generation
          const response = await api.command({ command: 'shellDraftPoll', id: draftId, cursor })
          const next = (response.result as { cursor?: number })?.cursor
          if (current === generation && Number.isSafeInteger(next) && next! >= cursor) cursor = next!
          return response
        }
        case 'terminalInput': return api.command({ command: 'shellDraftInput', id: draftId, input: body.input })
        case 'terminalRun': return api.command({ command: 'shellDraftRun', id: draftId, text: body.text, ...(body.approval ? { approval: body.approval } : {}) })
        case 'terminalResize': return api.command({ command: 'shellDraftResize', id: draftId, cols: body.cols, rows: body.rows })
        default: throw new Error('Unsupported draft terminal action')
      }
    },
  }
}
