import type { ScopeItem } from './composer-context'

export const PROJECT_ENTITIES_MIME = 'application/x-overleaf-project-entities'
export function mentionText(item: ScopeItem) {
  const path = item.path + (item.kind === 'folder' ? '/' : '')
  return '@' + (/^[\w./-]+$/.test(path) ? path : JSON.stringify(path))
}
export function mentions(value: string) {
  const matches: {start:number;end:number;item:ScopeItem}[] = []
  const expression = /@("(?:[^"\\]|\\.)+"|[\w./-]+)/g
  for (const match of value.matchAll(expression)) {
    const start = match.index!
    if (start && /[\w@]/.test(value[start - 1])) continue // email addresses
    let path: string
    try { path = match[1].startsWith('"') ? JSON.parse(match[1]) : match[1] } catch { continue }
    const kind = path.endsWith('/') ? 'folder' : 'file'
    if (kind === 'folder') path = path.slice(0, -1)
    if (!path || path.startsWith('/') || /[\x00-\x1f]/.test(path) || path.split('/').some(p=>!p || p==='..' || p==='.')) continue
    matches.push({ start, end: start + match[0].length, item: {kind,path} })
  }
  return matches
}
export function referencedScope(value:string, known:ScopeItem[]) {
  return known.filter((item,index)=>known.findIndex(other=>other.kind===item.kind&&other.path===item.path)===index && mentions(value).some(m=>m.item.kind===item.kind&&m.item.path===item.path))
}
export function restoreMentionDraft(value:string, scope:ScopeItem[]) {
  const missing=scope.filter(item=>!referencedScope(value,[item]).length)
  return value+(missing.length?(value?'\n':'')+missing.map(mentionText).join(' '):'')
}
export function readProjectDrop(data:string,projectId:string):ScopeItem[] {
  try {
    const payload=JSON.parse(data)
    if(payload.projectId!==projectId || !Array.isArray(payload.items) || payload.items.length>30)return []
    return payload.items.filter((item:ScopeItem)=>item && ['file','folder'].includes(item.kind) && typeof item.path==='string' && mentions(mentionText(item)).some(m=>m.item.path===item.path))
  } catch { return [] }
}
export function MentionText({value,scope}:{value:string;scope:ScopeItem[]}) {
  const parts=[];let end=0
  for(const match of mentions(value)) {
    if(!scope.some(item=>item.kind===match.item.kind&&item.path===match.item.path)&&!/^terminal\/(ssh|paper)\/[a-f0-9-]{36}$/.test(match.item.path))continue
    parts.push(value.slice(end,match.start))
    parts.push(<span className="paper-inline-reference" key={match.start} title={match.item.path}>{value.slice(match.start,match.end)}</span>)
    end=match.end
  }
  parts.push(value.slice(end))
  return <>{parts}</>
}
