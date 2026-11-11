import subprocess,json,os,pathlib,secrets
pidfile=pathlib.Path('/tmp/native-git-terminal-runner.pid')
if pidfile.exists():
 try:
  pid=int(pidfile.read_text())
  command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()
  if 'services/agent/src/repository-terminal-runner.mjs' in command:
   print('Terminal runner already running');raise SystemExit(0)
 except (subprocess.CalledProcessError,ValueError): pass
info=json.loads(subprocess.check_output(['docker','inspect','overleaf-deletion-acceptance-candidate-web-1']))[0]
values=dict(v.split('=',1) for v in info['Config']['Env'])
key=pathlib.Path.home()/'.local/share/overleaf-acceptance/native-terminal-runner.key'
key.parent.mkdir(parents=True,exist_ok=True)
try:
 fd=os.open(key,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(secrets.token_hex(32))
except FileExistsError:pass
assert key.stat().st_mode & 0o077 == 0
env={**os.environ,'OVERLEAF_TERMINAL_RUNNER_TOKEN':key.read_text().strip()}
log=open('/tmp/native-git-terminal-runner.log','a')
p=subprocess.Popen(['node','services/agent/src/repository-terminal-runner.mjs'],cwd=str(pathlib.Path(__file__).resolve().parents[2]),env=env,stdout=log,stderr=log,start_new_session=True)
pathlib.Path('/tmp/native-git-terminal-runner.pid').write_text(str(p.pid))
print('Started isolated terminal runner PID',p.pid)
