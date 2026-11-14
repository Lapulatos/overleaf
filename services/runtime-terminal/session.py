"""Session lifecycle glue. tmux owns the PTY, shell, screen and persistence."""
import sys,json,uuid,subprocess,os,re,time
from files import operate
from pathlib import Path
ROOT=Path.home()/'.local/share/overleaf-terminals'
TMUX=['tmux','-L','overleaf-terminals','-f','/dev/null']
def valid(value):
 if str(uuid.UUID(value))!=value:raise ValueError('Invalid identity')
 return value
def call(*args,check=True):return subprocess.run(TMUX+list(args),capture_output=True,text=True,check=check)
def save(path,data):
 temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data)+"\n");temp.chmod(0o600);temp.replace(path)
def status(folder):
 meta=json.loads((folder/'session.json').read_text());r=call('display-message','-p','-t',meta['id'],'#{pane_dead}|#{pane_pid}|#{pane_current_path}',check=False)
 if meta.get('removed'):return None
 if r.returncode==0:
  dead,pid,cwd=r.stdout.strip().split('|',2);meta.update(state='ended' if dead=='1' else 'running',pid=int(pid),directory=cwd)
 elif meta.get('state')!='stopped':meta['state']='ended'
 return meta
def history(folder,id):
 r=call('capture-pane','-p','-e','-J','-S','-20000','-t',id,check=False)
 return r.stdout[-2_000_000:] if r.returncode==0 else ((folder/'history.txt').read_text() if (folder/'history.txt').exists() else '')
def main():
 action=sys.argv[1];node=valid(sys.argv[2]);base=ROOT/node
 if action=='list':
  rows=[]
  if base.exists():
   for p in base.glob('*/session.json'):
    try:
     item=status(p.parent)
     if item:rows.append(item)
    except (ValueError,OSError,subprocess.SubprocessError):pass
  return {'sessions':rows}
 id=valid(sys.argv[3]);folder=base/id;meta=folder/'session.json'
 if action=='create':
  if meta.exists():return status(folder)
  folder.mkdir(parents=True,mode=0o700,exist_ok=True);(folder/'work').mkdir(exist_ok=True);(folder/'home').mkdir(exist_ok=True)
  call('new-session','-d','-s',id,'-x','100','-y','24','-c',str(folder/'work'),'-e',f'HOME={folder / "home"}','-e','PS1=\\n\\[\\e[32m\\]\\u@\\h\\[\\e[0m\\]:\\[\\e[34m\\]\\W\\[\\e[0m\\]\\$ ','/bin/bash --noprofile --norc')
  call('set-option','-t',id,'remain-on-exit','on');call('set-option','-t',id,'history-limit','20000');call('set-option','-t',id,'status','off');call('set-option','-t',id,'mouse','on')
  data={'id':id,'state':'running','directory':str(folder/'work')};save(meta,data);return status(folder)
 if not meta.exists():raise ValueError('Session not found')
 if action=='agent-command':
  command=json.load(sys.stdin).get('command')
  if not isinstance(command,str) or not command.strip() or len(command)>16000 or '\x00' in command or '\r' in command:raise ValueError('Invalid command')
  foreground=call('display-message','-p','-t',id,'#{pane_current_command}').stdout.strip()
  screen=call('capture-pane','-p','-J','-t',id).stdout.rstrip('\n')
  if foreground not in ('bash','sh','zsh') or not re.search(r'[$#] $',screen):raise ValueError('Terminal busy or unfinished input')
  call('send-keys','-t',id,'-l','--',command);call('send-keys','-t',id,'Enter')
  return {'commandSent':True}
 if action=='files':return operate(folder/'work',json.load(sys.stdin))
 if action=='status':return status(folder)
 if action=='history':return {'output':history(folder,id),'state':status(folder)['state']}
 if action in ['stop','remove']:
  (folder/'history.txt').write_text(history(folder,id));call('kill-session','-t',id,check=False)
  data=json.loads(meta.read_text());data['state']='stopped'
  if action=='remove':data['removed']=True
  save(meta,data);return {'state':'stopped','removed':action=='remove'}
 raise ValueError('Unsupported action')
if __name__=='__main__':
 try:print(json.dumps(main()))
 except Exception:print(json.dumps({'error':'Remote session operation failed'}));sys.exit(1)
