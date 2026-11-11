import { randomUUID } from 'node:crypto'

// Deliberately small: arbitrary shell syntax is never classified by a denylist.
export function reviewCommand(command) {
  const safe = new Map([
    ['pwd', '/bin/pwd'],
    ['ls', '/bin/ls --color=never'],
    ['ls -la', '/bin/ls -la --color=never'],
    ['ls -l', '/bin/ls -l --color=never'],
  ])
  return safe.has(command) ? { automatic: true, command: safe.get(command) } : {
    automatic: false, command,
    reason: 'This command is outside the automatic read-only allowlist. Review the complete command before running it in this project container.',
  }
}

export class TerminalReviews {
  pending = new Map()
  authorize(id, key, command, approval) {
    if (typeof command !== 'string' || !command.trim() || command.length > 16384 || command.includes('\0')) throw Error('Invalid command')
    const review = reviewCommand(command)
    if (approval) {
      const grant = this.pending.get(id)
      this.pending.delete(id)
      if (!grant || grant.token !== approval || grant.key !== key || grant.command !== command || grant.expires < Date.now()) throw Error('Command approval expired or does not match. Review again.')
      return { command, automatic: false }
    }
    if (review.automatic) return review
    const token = randomUUID()
    this.pending.set(id, { token, key, command, expires: Date.now() + 60000 })
    return { approvalRequired: true, approval: token, reason: review.reason }
  }
  revoke(id) { this.pending.delete(id) }
}

// Each command gets a fresh Bash with a clean environment; shell aliases, startup
// files and environment mutations cannot alter the next automatically reviewed command.
export const reviewedBridge = String.raw`
import os,sys,json,base64,subprocess
def emit(text):
 print(json.dumps({'data':base64.b64encode(text).decode()}),flush=True)
emit(b'[Reviewed commands: each command starts in the repository directory.]\r\n')
for line in sys.stdin:
 msg=json.loads(line)
 if msg.get('close'): break
 if 'command' not in msg: continue
 env={'PATH':'/usr/bin:/bin','HOME':os.getcwd(),'LANG':'C.UTF-8','TERM':'dumb'}
 emit(('$ '+msg['command']+'\r\n').encode())
 try:
  result=subprocess.run(['/bin/bash','--noprofile','--norc','-c',msg['command']],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60)
  emit(result.stdout[-1048576:].replace(b'\n',b'\r\n'))
  emit(('[Exit '+str(result.returncode)+']\r\n').encode())
 except subprocess.TimeoutExpired:
  emit(b'[Command timed out after 60 seconds]\r\n')
`
