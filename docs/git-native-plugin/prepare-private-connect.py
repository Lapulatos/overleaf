"""Prepare a localhost authenticated clone fixture in the candidate only."""
from pathlib import Path
import contextlib, io
helpers=Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(',1)[0]
with contextlib.redirect_stdout(io.StringIO()): exec(compile(helpers,__file__,'exec'))
container='overleaf-deletion-acceptance-candidate-web-1'
ready=json.loads(subprocess.check_output(['docker','exec',container,'cat','/tmp/native-git-deployed-https-r21/ready.json'],text=True))
url=ready['url'];assert url.startswith('https://localhost:')
# Exact fixture URL trust only. Cleanup must remove this key, never disable TLS.
trustKey='http.'+url+'.sslCAInfo'
subprocess.run(['docker','exec',container,'git','config','--system',trustKey,ready['cert']],check=True)
seed="""const fs=require('fs'),{execFileSync:run}=require('child_process');const p='/tmp/native-git-deployed-https-r21/seed';if(!fs.existsSync(p)){run('git',['init','--initial-branch=main',p]);run('git',['-C',p,'config','user.name','Private Fixture Author']);run('git',['-C',p,'config','user.email','fixture@example.test']);fs.writeFileSync(p+'/README','Private clone fixture\\n');run('git',['-C',p,'add','README']);run('git',['-C',p,'commit','-m','Private authenticated clone fixture']);run('git',['-C',p,'push','/tmp/native-git-deployed-https-r21/remote.git','main']);}"""
subprocess.run(['docker','exec','-u','www-data',container,'node','-e',seed],check=True,capture_output=True)
statePath=ctx['private']/'native-git-private-connect-r28.json'
state=json.loads(statePath.read_text()) if statePath.exists() else {'projectId':request('/project/new',{'projectName':'Native Git private connect acceptance r28','template':'blank'})['project_id']}
state.update(url=url,trustKey=trustKey)
statePath.write_text(json.dumps(state));statePath.chmod(0o600)
print(json.dumps(state))
