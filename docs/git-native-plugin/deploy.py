"""Replace only the dedicated candidate after source verification and idle checks."""
import json, subprocess, os, urllib.request, secrets
from deployment_safety import check_candidate_idle
from pathlib import Path
root=Path(__file__).resolve().parent
verified=json.loads((root/'image-verification.json').read_text())
assert subprocess.check_output(['docker','image','inspect',verified['tag'],'--format','{{.Id}}'],text=True).strip()==verified['imageId']
name='overleaf-deletion-acceptance-candidate-web-1'
info=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
assert info['Config']['Image'] in ['overleaf-agent-acceptance:20261109-without-git','overleaf-agent-acceptance:20261109-native-git-candidate','overleaf-agent-acceptance:20261109-native-git-candidate-r2','overleaf-agent-acceptance:20261109-native-git-candidate-r3','overleaf-agent-acceptance:20261109-native-git-candidate-r4','overleaf-agent-acceptance:20261109-native-git-candidate-r5','overleaf-agent-acceptance:20261109-native-git-candidate-r6','overleaf-agent-acceptance:20261109-native-git-candidate-r7','overleaf-agent-acceptance:20261109-native-git-candidate-r8','overleaf-agent-acceptance:20261109-native-git-candidate-r11','overleaf-agent-acceptance:20261110-native-git-candidate-r12','overleaf-agent-acceptance:20261110-native-git-candidate-r13','overleaf-agent-acceptance:20261110-native-git-candidate-r14','overleaf-agent-acceptance:20261110-native-git-candidate-r15','overleaf-agent-acceptance:20261110-native-git-candidate-r17','overleaf-agent-acceptance:20261110-native-git-candidate-r18','overleaf-agent-acceptance:20261110-native-git-candidate-r19','overleaf-agent-acceptance:20261110-native-git-candidate-r21','overleaf-agent-acceptance:20261110-native-git-candidate-r22','overleaf-agent-acceptance:20261110-native-git-candidate-r23','overleaf-agent-acceptance:20261110-native-git-candidate-r24','overleaf-agent-acceptance:20261110-native-git-candidate-r25','overleaf-agent-acceptance:20261110-native-git-candidate-r26','overleaf-agent-acceptance:20261110-native-git-candidate-r27','overleaf-agent-acceptance:20261110-native-git-candidate-r28','overleaf-agent-acceptance:20261110-native-git-candidate-r29','overleaf-agent-acceptance:20261110-native-git-candidate-r30','overleaf-agent-acceptance:20261110-native-git-candidate-r31','overleaf-agent-acceptance:20261110-native-git-candidate-r32','overleaf-agent-acceptance:20261110-native-git-candidate-r33','overleaf-agent-acceptance:20261110-native-git-candidate-r34','overleaf-agent-acceptance:20261110-native-git-candidate-r35','overleaf-agent-acceptance:20261110-native-git-candidate-r36','overleaf-agent-acceptance:20261110-native-git-candidate-r36-final','overleaf-agent-acceptance:20261110-native-git-candidate-r37','overleaf-agent-acceptance:20261111-native-git-candidate-r38-final','overleaf-agent-acceptance:20261111-native-git-candidate-r39','overleaf-agent-acceptance:20261111-native-git-candidate-r39-final','overleaf-agent-acceptance:20261111-native-git-candidate-r40','overleaf-agent-acceptance:20261111-native-git-candidate-r41','overleaf-agent-acceptance:20261111-native-git-candidate-r42','overleaf-agent-acceptance:20261111-native-git-candidate-r43','overleaf-agent-acceptance:20261111-native-git-candidate-r44','overleaf-agent-acceptance:20261111-native-git-candidate-r46','overleaf-agent-acceptance:20261111-native-git-candidate-r47','overleaf-agent-acceptance:20261111-native-git-candidate-r48','overleaf-agent-acceptance:20261111-native-git-candidate-r49']
values=dict(x.split('=',1) for x in info['Config']['Env'])
assert values['OVERLEAF_SITE_URL']=='http://127.0.0.1:18081'
assert values['OVERLEAF_MONGO_URL'].endswith('/prism_reviewed_deletion')
health=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:47291/agent/health',headers={'X-Agent-Token':values['OVERLEAF_AGENT_TOKEN']}),timeout=5))
assert health['concurrency']['running']==0,'Assistant task still running; defer candidate replacement'
assert subprocess.run(['docker','exec',name,'pgrep','-f','venue-deep-refresh.mjs'],capture_output=True).returncode==1
key=Path.home()/'.local/share/overleaf-acceptance/native-git-credential.key'
try:
 fd=os.open(key,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(secrets.token_hex(32))
except FileExistsError: pass
assert key.stat().st_mode & 0o077==0
secret=key.read_text().strip()
assert len(secret)>=32
# Keep the active cookie signing secret across container replacement.
# The image otherwise generates a new CRYPTO_RANDOM on each recreation.
session_secret=values.get('OVERLEAF_SESSION_SECRET') or subprocess.check_output(
 ['docker','exec',name,'cat','/etc/container_environment/CRYPTO_RANDOM'],text=True).strip()
assert session_secret and len(session_secret)>=32
keys=['OVERLEAF_AGENT_TOKEN','WRITING_ASSIST_ZOTERO_ENCRYPTION_KEY']
env={**os.environ,**{k:values[k] for k in keys},'OVERLEAF_NATIVE_GIT_CREDENTIAL_KEY':secret,'NATIVE_GIT_IMAGE':verified['tag'],'OVERLEAF_SESSION_SECRET':session_secret}
check_candidate_idle()
subprocess.run(['python3',str(root/'start-terminal-runner.py')],check=True)
env['OVERLEAF_TERMINAL_RUNNER_TOKEN']=(Path.home()/'.local/share/overleaf-acceptance/native-terminal-runner.key').read_text().strip()
subprocess.run(['docker','compose','-p','overleaf-deletion-acceptance','-f',str(root/'runtime.compose.yml'),'up','-d','--no-build','--pull','never','candidate-web'],env=env,check=True)
(root/'deployment.json').write_text(json.dumps({'previousImage':info['Config']['Image'],'image':verified['tag'],'url':'http://127.0.0.1:18081','browserUntouched':True,'volumesPreserved':True},indent=2)+'\n')
