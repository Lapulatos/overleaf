// Read display metadata only. Skill instructions remain unchanged in stored files.
export function skillDescription(content = '', fallback = '') {
 const front = content.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
 let description = ''
 if (front) {
  const lines = front.split(/\r?\n/)
  const index = lines.findIndex(line => /^description\s*:/.test(line))
  if (index >= 0) {
   const value = lines[index].replace(/^description\s*:\s*/, '').trim()
   if (/^[>|][+-]?(?:\s+#.*)?$/.test(value)) {
    const parts = []
    for (const line of lines.slice(index + 1)) {
     if (line.trim() && !/^\s/.test(line)) break
     parts.push(line.trim())
    }
    description = parts.join(' ')
   } else if (value.startsWith('"') && value.endsWith('"')) {
    try { description = JSON.parse(value) } catch { description = value.slice(1, -1) }
   } else {
    description = value.replace(/^'(.*)'$/, '$1').replace(/''/g, "'")
   }
  }
 }
 const usable = text => typeof text === 'string' && text.trim() && !/^[>|][+-]?$/.test(text.trim())
 if (!usable(description)) description = usable(fallback) ? fallback : 'An installed Skill with instructions for your AI assistant.'
 return description.replace(/\s+/g, ' ').trim().slice(0, 2000)
}
