// Bound durable transcript size independently of the daemon's retention policy.
// Events originate from the authenticated daemon, never from a message POST.
export function boundedActivity(events, budget = 64000) {
  if (!Array.isArray(events)) return []
  const result = []
  let used = 0
  for (const event of events.slice(0, 200)) {
    if (!event || !['command', 'files', 'tool', 'message'].includes(event.kind)) continue
    const size = Buffer.byteLength(JSON.stringify(event), 'utf8')
    if (used + size > budget) {
      const compact={id:event.id,kind:event.kind,title:event.title,status:event.status,files:event.files,truncated:true}
      const compactSize=Buffer.byteLength(JSON.stringify(compact),'utf8')
      if(used+compactSize<=budget){result.push(compact);used+=compactSize}
      continue
    }
    result.push(event)
    used += size
  }
  return result
}
