// Public execution activity only. Reasoning items/deltas are deliberately ignored.
// Keep tool output bounded and avoid disclosing common credential forms.
export function activityText(value, workspace = '', limit = 4000) {
  let text = typeof value === 'string' ? value : ''
  if (workspace) text = text.split(workspace).join('[project]')
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '$1[redacted]')
    .replace(/((?:api[_-]?key|token|password|secret)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '[redacted]')
    .slice(0, limit)
}

export function documentActivity(method, item, workspace) {
  if (!['item/started', 'item/completed'].includes(method) || !item || typeof item.id !== 'string') return null
  const completed = method === 'item/completed'
  const base = { id: item.id, status: completed ? ((item.status === 'failed' || (item.type === 'commandExecution' && Number.isInteger(item.exitCode) && item.exitCode !== 0)) ? 'failed' : 'completed') : 'running' }
  const clean = value => activityText(value, workspace)
  switch (item.type) {
    case 'commandExecution':
      return { ...base, kind: 'command', title: 'Run command', command: clean(item.command),
        ...(completed ? { output: clean(item.aggregatedOutput), outputTruncated:String(item.aggregatedOutput||'').length>4000, exitCode: Number.isInteger(item.exitCode) ? item.exitCode : null } : {}) }
    case 'fileChange':
      return { ...base, kind: 'files', title: 'Edit files', files: (Array.isArray(item.changes) ? item.changes : []).slice(0, 100).map(change => clean(change.path)) }
    case 'mcpToolCall':
      return { ...base, kind: 'tool', title: clean(`${item.server || ''}/${item.tool || ''}`) }
    case 'dynamicToolCall':
      return { ...base, kind: 'tool', title: clean(item.tool) }
    case 'agentMessage':
      return completed && item.text ? { ...base, kind: 'message', title: 'Assistant update', text: clean(item.text) } : null
    default:
      return null
  }
}
