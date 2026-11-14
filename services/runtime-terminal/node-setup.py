import json,sys,os,subprocess,shutil,platform,uuid,hashlib,shlex,signal,time
from pathlib import Path

def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,timeout=35,**kw)
def main():
 r=json.load(sys.stdin);action=r['action'];base=Path.home()/'.local/share/overleaf-terminals'
 if sys.version_info<(3,8):return {'error':'Python 3.8 or newer is required.'}
 if action=='setup':
  if not shutil.which('tmux'):return {'error':'Install tmux on the node first.'}
  base.mkdir(parents=True,exist_ok=True,mode=0o700)
  for name in ['session.py','files.py','monitor.py']:
   dest=base/name;temp=base/(name+'.new');temp.write_text(r['files'][name]);temp.chmod(0o600);temp.replace(dest)
 if action=='capabilities':
  info={};images=[]
  try:
   info=json.loads(run(['docker','info','--format','{{json .}}']).stdout)
   images=[line for line in run(['docker','image','ls','--format','{{.Repository}}:{{.Tag}}']).stdout.splitlines() if '<none>' not in line][:100]
  except (OSError,ValueError):pass
  gpu_count=0
  try:gpu_count=len(run(['nvidia-smi','--query-gpu=index','--format=csv,noheader']).stdout.splitlines())
  except OSError:pass
  return {'docker':bool(info),'cpuLimit':bool(info.get('CpuCfsQuota')),'memoryLimit':bool(info.get('MemoryLimit')),'gpuRuntime':'nvidia' in info.get('Runtimes',{}),'gpuCount':gpu_count,'images':images}
 if action in ('external-start','external-stop'):
  port=int(r['coordinatorPort'])
  if port not in (18081,18082):return {'error':'Unsupported existing Runner service.'}
  unit='overleaf-runner-'+str(port)+'.service'
  operation='start' if action=='external-start' else 'stop'
  result=run(['systemctl','--user',operation,unit])
  if result.returncode:return {'error':'Existing Runner service could not '+operation+'.'}
  return {'runnerStarted':action=='external-start','stopped':action=='external-stop'}
 if action in ('sample','setup'):
  sys.path.insert(0,str(base));from monitor import collect
  return {'home':str(Path.home()),'identity':{'hostname':platform.node()[:100],'platform':sys.platform,'arch':platform.machine()},'resources':collect(),'runnerInstalled':bool(shutil.which('gitlab-runner'))}
 id=str(uuid.UUID(r['id']));root=Path.home()/'.local/share/overleaf-runner-nodes'/id;tmux=['tmux','-L','overleaf-runners','-f','/dev/null']
 def runner_pids():
  found=[]
  for line in run(['ps','-eo','pid,args']).stdout.splitlines()[1:]:
   try:
    pid,command=line.strip().split(None,1);argv=shlex.split(command)
    if Path(argv[0]).name=='gitlab-runner' and '--config' in argv and argv[argv.index('--config')+1]==str(root/'config.toml'):found.append(int(pid))
   except (ValueError,IndexError):pass
  return found
 if action=='stop-runner':
  for pid in runner_pids():
   try:os.kill(pid,signal.SIGQUIT)
   except ProcessLookupError:pass
  for _ in range(40):
   if not runner_pids():break
   time.sleep(.2)
  if runner_pids():return {'error':'Runner is still stopping. Retry shortly.'}
  run(tmux+['kill-session','-t',id]);return {'stopped':True}
 if action=='runner':
  if not shutil.which('gitlab-runner'):return {'error':'Install the official GitLab Runner on the node, then retry.'}
  root.mkdir(parents=True,exist_ok=True,mode=0o700);cfg=root/'config.toml';url='http://127.0.0.1:'+str(int(r['port']))
  identity=root/'identity.json';signature=hashlib.sha256((r['token']+url).encode()).hexdigest()
  if cfg.exists() and (not identity.exists() or json.loads(identity.read_text()).get('signature')!=signature):cfg.replace(root/'config.toml.previous')
  if not cfg.exists():
   env={**os.environ,'CI_SERVER_URL':url,'CI_SERVER_TOKEN':r['token'],'RUNNER_NAME':r['name'],'RUNNER_EXECUTOR':'shell'}
   result=run(['gitlab-runner','register','--non-interactive','--shell','bash','--config',str(cfg)],env=env)
   if result.returncode:return {'error':'Runner registration through SSH failed. Check coordinator connectivity and Runner version.'}
   cfg.chmod(0o600);identity.write_text(json.dumps({'signature':signature}));identity.chmod(0o600)
  text=cfg.read_text()
  text=text.replace('shell = "sh"','shell = "bash"')
  if 'shell = ' not in text:text=text.replace('executor = "shell"','executor = "shell"\n  shell = "bash"')
  cfg.write_text(text);cfg.chmod(0o600)
  home=root/'home';home.mkdir(exist_ok=True,mode=0o700)
  bindir=root/'bin';bindir.mkdir(exist_ok=True,mode=0o700);bash=bindir/'bash'
  bash.write_text('#!/bin/sh\nunset BASH_ENV ENV\nif [ "$1" = "--login" ] || [ "$1" = "-l" ]; then shift; fi\nexec /bin/bash --noprofile --norc "$@"\n');bash.chmod(0o700)
  if runner_pids():return {'runnerStarted':True}
  run(tmux+['kill-session','-t',id])
  if run(tmux+['has-session','-t',id]).returncode:
   result=run(tmux+['new-session','-d','-s',id,'env','HOME='+str(home),'PATH='+str(bindir)+':'+os.environ.get('PATH','/usr/bin:/bin'),'gitlab-runner','run','--config',str(cfg),'--working-directory',str(root)])
   if result.returncode:return {'error':'Could not start the dedicated Runner.'}
  return {'runnerStarted':True}
 return {'error':'Unsupported SSH setup action.'}
try:print(json.dumps(main()))
except Exception:print(json.dumps({'error':'SSH setup or resource sampling failed.'}))
