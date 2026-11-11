import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCodexEventParser } from '../src/backends/codex-events.mjs'
import { parseResult } from '../src/backends/utils.mjs'

const answer = '修订建议\n```diff\n--- a/main.tex\n+++ b/main.tex\n@@ -1 +1 @@\n-old\n+new\n```'
const events = [
  { type: 'thread.started', thread_id: 'thread' },
  { type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: answer } },
  { type: 'turn.completed', usage: {} },
]
const stream = Buffer.from(events.map(event => JSON.stringify(event)).join('\n'))

test('preserves UTF-8 and diff blocks when every byte arrives separately', () => {
  const parser = createCodexEventParser()
  for (const byte of stream) parser.push(Buffer.from([byte]))
  assert.equal(parser.finish(), answer)
})

test('handles multiple events in one chunk and missing final newline', () => {
  const parser = createCodexEventParser()
  parser.push(stream)
  assert.equal(parseResult(parser.finish()).diffs[0].path, 'main.tex')
})

test('does not mistake an intermediate answer for task success', () => {
  const parser = createCodexEventParser()
  parser.push(JSON.stringify(events[1]))
  assert.throws(() => parser.finish(), /before turn completion/)
})

test('failed turns do not return partial modifications as success', () => {
  const parser = createCodexEventParser()
  parser.push(JSON.stringify(events[1]) + '\n' + JSON.stringify({ type: 'turn.failed' }))
  assert.throws(() => parser.finish(), /turn failed/)
})

test('completed turns without an assistant response fail explicitly', () => {
  const parser = createCodexEventParser()
  parser.push(JSON.stringify(events[2]))
  assert.throws(() => parser.finish(), /no assistant response/)
})

test('rejects malformed output instead of using raw JSON as a manuscript response', () => {
  const parser = createCodexEventParser()
  assert.throws(() => parser.push('not JSON\n'), /Invalid JSON/)
})

test('bounds captured output', () => {
  const parser = createCodexEventParser()
  assert.throws(() => parser.push(Buffer.alloc(2 * 1024 * 1024 + 1)), /exceeds/)
})

test('ignores reasoning and command output when extracting suggested edits', () => {
  const parser = createCodexEventParser()
  parser.push(JSON.stringify({ type: 'item.completed', item: { id: 'reasoning', type: 'reasoning', text: 'internal thoughts' } }) + '\n')
  parser.push(stream)
  assert.equal(parser.finish(), answer)
})
