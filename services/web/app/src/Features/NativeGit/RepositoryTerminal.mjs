import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { StringDecoder } from 'node:string_decoder'
const sessions = new Map()
export const terminalBridge = String.raw`
import os,pty,sys,select,json,base64,fcntl,termios,struct,signal
pid,fd=pty.fork()
if pid==0:
 os.execv('/bin/bash',['bash','--noprofile','--norc','-i'])
pending=b''
try:
 while True:
  ready,_,_=select.select([fd,sys.stdin],[],[],1)
  if fd in ready:
   try: data=os.read(fd,65536)
   except OSError: break
   if not data: break
   print(json.dumps({'data':base64.b64encode(data).decode()}),flush=True)
  if sys.stdin in ready:
   data=os.read(0,65536)
   if not data: break
   pending+=data
   while b'\n' in pending:
    line,pending=pending.split(b'\n',1)
    msg=json.loads(line)
    if 'input' in msg: os.write(fd,msg['input'].encode())
    if 'cols' in msg: fcntl.ioctl(fd,termios.TIOCSWINSZ,struct.pack('HHHH',msg['rows'],msg['cols'],0,0))
    if msg.get('close'): sys.exit(0)
finally:
 try: os.killpg(pid,signal.SIGHUP)
 except ProcessLookupError: pass
 os.close(fd)
`
function requireSession(id, key) {
 const s=sessions.get(id)
 if (!s || s.key!==key) throw Object.assign(new Error('Terminal session expired. Reopen the terminal.'),{status:409})
 s.touched=Date.now(); return s
}
export function openTerminal(directory,key,spawnChild) {
 for(const [id,s] of sessions) if(s.key===key) closeTerminal(id,key)
 const id=randomUUID(), decoder=new StringDecoder('utf8')
 const child=spawnChild ? spawnChild() : spawn('python3',['-u','-c',terminalBridge],{cwd:directory,env:{PATH:process.env.PATH,HOME:directory,HISTFILE:'/dev/null',TERM:'xterm-256color',LANG:'C.UTF-8',PS1:'\\w \\$ '},stdio:['pipe','pipe','pipe']})
 const session={key,child,directory,output:'',exited:false,touched:Date.now()}; sessions.set(id,session)
 const append=text=>{session.output=(session.output+text).slice(-1024*1024)}
 createInterface({input:child.stdout}).on('line',line=>{try{append(decoder.write(Buffer.from(JSON.parse(line).data,'base64')))}catch{}})
 child.stdin.on('error',error=>{append(error.message);session.exited=true})
 child.stderr.on('data',data=>append(data.toString()))
 child.on('error',error=>{append(error.message);session.exited=true})
 child.on('exit',()=>{append(decoder.end());session.exited=true})
 return {id,directory}
}
export function pollTerminal(id,key) {const s=requireSession(id,key);const output=s.output;s.output='';return {output,exited:s.exited}}
export function writeTerminal(id,key,input,cols,rows) {const s=requireSession(id,key);if(s.exited) throw Object.assign(new Error('Shell exited. Reopen the terminal.'),{status:409});s.child.stdin.write(JSON.stringify(input!==undefined?{input}:{cols,rows})+'\n');return {}}
export function closeTerminal(id,key) {const s=requireSession(id,key);s.child.stdin.end(JSON.stringify({close:true})+'\n');const kill=setTimeout(()=>s.child.kill('SIGKILL'),1500);kill.unref();sessions.delete(id);return {}}
const reap=setInterval(()=>{for(const [id,s] of sessions)if(Date.now()-s.touched>30*60*1000)closeTerminal(id,s.key)},60000);reap.unref()

export function closeOwnerTerminals(key) {for(const [id,s] of sessions)if(s.key===key)closeTerminal(id,key);return {}}

export function runReviewedTerminal(id,key,command) {const s=requireSession(id,key);if(s.exited)throw Error('Shell exited');s.child.stdin.write(JSON.stringify({command})+'\n');return {}}
