import { StringDecoder } from 'node:string_decoder'

// codex exec --json emits JSONL, not one JSON object per stdout chunk.
export function createCodexEventParser(onProgress = () => {}) {
  const decoder = new StringDecoder('utf8')
  let buffer = ''
  let bytes = 0
  let completed = false
  let failure = null
  const messages = new Map()

  function consume(line) {
    if (!line.trim()) return
    let event
    try { event = JSON.parse(line) }
    catch { throw new Error('Invalid JSON in Codex output') }
    if (event?.type === 'turn.failed') {
      failure = new Error('Codex turn failed')
    } else if (event?.type === 'turn.completed') {
      completed = true
    } else if (event?.type === 'item.completed' && event.item?.type === 'agent_message') {
      const { id, text } = event.item
      if (typeof id !== 'string' || typeof text !== 'string') {
        throw new Error('Invalid Codex agent message')
      }
      messages.set(id, text)
      onProgress(text.slice(0, 200))
    } else if (event?.type === 'item.started') {
      onProgress(`[codex] ${event.item?.type || 'working'}`)
    }
  }
  function drain() {
    let index
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      consume(line)
    }
  }
  return {
    push(chunk) {
      bytes += Buffer.byteLength(chunk)
      if (bytes > 2 * 1024 * 1024) throw new Error('Codex output exceeds 2 MiB')
      buffer += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      drain()
    },
    finish() {
      buffer += decoder.end()
      drain()
      if (buffer.trim()) consume(buffer)
      buffer = ''
      if (failure) throw failure
      if (!completed) throw new Error('Codex output ended before turn completion')
      if (!messages.size) throw new Error('Codex returned no assistant response')
      return [...messages.values()].join('\n\n')
    },
  }
}
