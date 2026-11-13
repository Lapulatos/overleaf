import type { Plugin } from './plugin-library'

export type PluginGroup = { id: string; name: string; owner: string; url: string; plugins: Plugin[] }
export function groupPlugins(plugins: Plugin[]): PluginGroup[] {
  const groups = new Map<string, PluginGroup>()
  for (const plugin of plugins) {
    let id = plugin.id, name = plugin.name, owner = '', url = ''
    if (!plugin.builtin) {
      try {
        const source = new URL(plugin.sourceUrl)
        const [account, repository] = source.pathname.split('/').filter(Boolean)
        if (source.hostname === 'github.com' && source.protocol === 'https:' && account && repository) {
          name = repository.replace(/\.git$/i, ''); owner = account
          url = `https://github.com/${owner}/${name}`
          id = url.toLowerCase()
        }
      } catch { /* Unrecognized sources remain separate. */ }
    }
    if (!groups.has(id)) groups.set(id, { id, name, owner, url, plugins: [] })
    groups.get(id)!.plugins.push(plugin)
  }
  return [...groups.values()]
}
export function matchScore(value: string, query: string): number {
  const text = value.toLowerCase(), needle = query.trim().toLowerCase().replace(/^\//, '')
  if (!needle) return 1
  if (text === needle) return 1000
  if (text.startsWith(needle)) return 800 - Math.min(100, text.length - needle.length)
  const at = text.indexOf(needle)
  if (at >= 0) return 600 - Math.min(100, at)
  let position = -1, first = -1
  for (const char of needle) {
    position = text.indexOf(char, position + 1)
    if (position < 0) break
    if (first < 0) first = position
  }
  if (position >= 0) return 300 - Math.min(200, position - first + text.length - needle.length)
  // Allow a small typing error, but do not return unrelated short names.
  if (needle.length < 4) return 0
  let row = Array.from({ length: needle.length + 1 }, (_, i) => i)
  for (let i = 0; i < text.length; i++) {
    const next = [i + 1]
    for (let j = 0; j < needle.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (text[i] === needle[j] ? 0 : 1)))
    row = next
  }
  return row[needle.length] <= Math.max(1, Math.floor(needle.length / 5)) ? 150 - row[needle.length] : 0
}
export function searchPluginGroups(groups: PluginGroup[], query: string): PluginGroup[] {
  if (!query.trim()) return groups
  return groups.map(group => {
    const repositoryScore = Math.max(matchScore(group.name, query), matchScore(group.owner, query))
    const matches = group.plugins.map(plugin => ({ plugin, score: Math.max(matchScore(plugin.name, query), matchScore(plugin.command, query)) })).sort((a, b) => b.score - a.score)
    return { group: { ...group, plugins: repositoryScore ? matches.map(item => item.plugin) : matches.filter(item => item.score > 0).map(item => item.plugin) }, score: Math.max(repositoryScore, ...matches.map(item => item.score)) }
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).map(item => item.group)
}

// An overview of installed capabilities, rather than an unverified repository description.
export function repositoryOverview(group: PluginGroup): string {
 if(group.plugins.length===1)return group.plugins[0].description.split(/(?<=[.!?])\s/)[0]
 const text=group.plugins.map(plugin=>plugin.name+' '+plugin.description).join(' ').toLowerCase()
 const topics=[[/writ|manuscript|prose/, 'paper writing'],[/visual|figure|diagram/, 'figures'],[/literature|reference/, 'literature research'],[/review|rebuttal/, 'review and rebuttals'],[/experiment|research.engineer/, 'experiments'],[/submission/, 'submission preparation']] as const
 const capabilities=topics.filter(([pattern])=>pattern.test(text)).map(([,label])=>label)
 return capabilities.length ? `A collection of Skills for ${capabilities.join(', ')}.` : `A collection of ${group.plugins.length} Skills. Expand to choose a Skill, edit its instruction command, or enable it.`
}
