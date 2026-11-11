"""Flatten only a temporary container; preserve image runtime metadata."""
import json, subprocess
source='overleaf-agent-acceptance:20261109-without-git'
target='overleaf-agent-acceptance:20261109-native-git-base'
info=json.loads(subprocess.check_output(['docker','image','inspect',source]))[0]
cfg=info['Config']; changes=[]
for value in cfg.get('Env') or []:
 key, value=value.split('=',1); changes += ['--change', 'ENV '+key+'='+json.dumps(value)]
for key in ['Entrypoint','Cmd']:
 if cfg.get(key): changes += ['--change',key.upper()+' '+json.dumps(cfg[key])]
for key in ['WorkingDir','User','StopSignal']:
 if cfg.get(key): changes += ['--change',{'WorkingDir':'WORKDIR','User':'USER','StopSignal':'STOPSIGNAL'}[key]+' '+cfg[key]]
for port in cfg.get('ExposedPorts') or {}: changes += ['--change','EXPOSE '+port]
if cfg.get('Volumes'): changes += ['--change','VOLUME '+json.dumps(list(cfg['Volumes']))]
for key,value in (cfg.get('Labels') or {}).items(): changes += ['--change','LABEL '+key+'='+json.dumps(value)]
if cfg.get('Healthcheck'): raise RuntimeError('Explicit healthcheck metadata conversion required')
container=subprocess.check_output(['docker','create','--platform','linux/amd64','--entrypoint','/bin/true',source],text=True).strip()
try:
 export=subprocess.Popen(['docker','export',container],stdout=subprocess.PIPE)
 result=subprocess.run(['docker','import','--platform','linux/amd64',*changes,'-',target],stdin=export.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 export.stdout.close(); code=export.wait()
 if code or result.returncode: raise RuntimeError('Flatten failed: '+result.stderr.decode())
 print('Flattened base image created: '+target)
finally:
 subprocess.run(['docker','rm','-v',container],check=True,stdout=subprocess.DEVNULL)
