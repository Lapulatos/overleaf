import { AgentError } from './WritingAssistAgentService.mjs'
export function normalizeScope(scope = []) {
 if (!Array.isArray(scope) || scope.length > 30) throw new AgentError(400, 'Choose up to 30 files or folders')
 return scope.map(item => {
  if (!item || !['file','folder'].includes(item.kind) || typeof item.path !== 'string' || item.path.length > 240 || /[\\\x00-\x1f\x7f]/.test(item.path) || item.path.split('/').some(p=>!p || p==='.' || p==='..' || p.startsWith('.'))) throw new AgentError(400,'Invalid file or folder scope')
  return {kind:item.kind,path:item.path}
 })
}
export function isInScope(path, scope = []) {
 return !scope.length || scope.some(item=>item.kind==='file' ? path===item.path : path.startsWith(item.path+'/'))
}
export function assertScopedProposals(proposals, scope) {
 if (proposals.some(p=>!isInScope(p.path,scope))) throw new AgentError(422,'A proposed change is outside the selected files or folders. No changes were applied.')
}
export function scopeInstruction(scope) {
 return scope.length ? '\n\nUser-selected write scope (enforced by the server): '+scope.map(s=>`${s.kind}: ${s.path}`).join(', ')+'. Read other project files only as supporting context. Modify or create files only inside this scope. If the task needs broader changes, explain the blocker; do not change other files.' : ''
}
