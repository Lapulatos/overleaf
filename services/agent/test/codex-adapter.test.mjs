import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, chmod, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import codex from '../src/backends/codex.mjs'

test('Codex adapter uses stdin, read-only mode, configured auth and current JSONL', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'overleaf-codex-test-'))
  const previousPath = process.env.PATH
  t.after(async () => {
    process.env.PATH = previousPath
    await rm(directory, { recursive: true, force: true })
  })
  const executable = path.join(directory, 'codex')
  await writeFile(executable, `#!${process.execPath}
let input = '';
process.stdin.on('data', c => { input += c });
process.stdin.on('end', () => {
  const args = process.argv.slice(2);
  if (input !== 'Check this paper' || args.includes('--model') ||
      args[args.indexOf('--sandbox') + 1] !== 'read-only' ||
      process.env.CODEX_API_KEY !== 'test-only-key') process.exit(9);
  process.stdout.write(JSON.stringify({type:'item.completed',item:{id:'answer',type:'agent_message',text:'Checked the paper.'}}) + '\\n');
  process.stdout.write(JSON.stringify({type:'turn.completed'}));
});
`)
  await chmod(executable, 0o700)
  process.env.PATH = `${directory}${path.delimiter}${previousPath}`
  const result = await codex.execute('Check this paper', {
    taskId: 'test', taskType: 'check', context: {}, onProgress() {},
    maxSteps: 2, timeout: 5000, apiKey: 'test-only-key',
  })
  assert.equal(result.summary, 'Checked the paper.')
  assert.deepEqual(result.diffs, [])
})

test('Codex image argument points to a private temporary file that is removed after execution', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'overleaf-codex-image-test-'))
  const previousPath = process.env.PATH
  t.after(async () => {
    process.env.PATH = previousPath
    await rm(directory, { recursive: true, force: true })
  })
  const executable = path.join(directory, 'codex')
  await writeFile(executable, `#!${process.execPath}
const fs = require('node:fs');
process.stdin.resume();
process.stdin.on('end', () => {
  const args = process.argv.slice(2);
  const file = args[args.indexOf('--image') + 1];
  if (!args.includes('--image') || args[args.indexOf('--sandbox') + 1] !== 'read-only') process.exit(9);
  const detail = { path: file, size: fs.readFileSync(file).length, mode: fs.statSync(file).mode & 511 };
  console.log(JSON.stringify({type:'item.completed',item:{id:'answer',type:'agent_message',text:JSON.stringify(detail)}}));
  console.log(JSON.stringify({type:'turn.completed'}));
});
`)
  await chmod(executable, 0o700)
  process.env.PATH = `${directory}${path.delimiter}${previousPath}`
  const result = await codex.execute('Transcribe the attached formula', {
    taskId: 'image-test', taskType: 'writing', context: { images: [{ name: '../../formula.png', mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO3sAAAAASUVORK5CYII=' }] },
    onProgress() {}, maxSteps: 1, timeout: 5000,
  })
  const detail = JSON.parse(result.summary)
  assert.equal(detail.mode, 0o600)
  assert.ok(detail.size > 0)
  assert.equal(path.basename(detail.path), '0.png')
  await assert.rejects(stat(detail.path), { code: 'ENOENT' })
})
