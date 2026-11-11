"""Authenticated deployed API -> native Git HTTPS -> editor byte acceptance.
Only writes a named isolated project and /tmp/native-git-deployed-https-r21.
Start deployed-https-fixture.mjs inside the candidate container first.
"""
from pathlib import Path
import contextlib, io
helpers=Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(',1)[0]
with contextlib.redirect_stdout(io.StringIO()):
 exec(compile(helpers,__file__,'exec'))
container='overleaf-deletion-acceptance-candidate-web-1'
def shell(*args):
 if len(args)>2 and args[0]=='git' and args[1]=='-C': args=('git','-c','safe.directory='+args[2],*args[1:])
 return subprocess.check_output(['docker','exec',container,*args],text=True).strip()
ready=json.loads(shell('cat','/tmp/native-git-deployed-https-r21/ready.json'))
url=ready['url'];root=ready['root']
assert url.startswith('https://localhost:') and root=='/tmp/native-git-deployed-https-r21'
name='Native Git authenticated remote acceptance r21'
statePath=ctx['private']/'native-git-authenticated-remote-r21.json'
if statePath.exists(): state=json.loads(statePath.read_text())
else:
 state={'projectId':request('/project/new',{'projectName':name,'template':'blank'})['project_id'],'steps':{}}
 statePath.write_text(json.dumps(state));statePath.chmod(0o600)
project=state['projectId'];prefix='/project/'+project+'/native-git'
script=script.replace('Native Git isolated acceptance 20261109',name)
progress=state;recordPath=statePath
step('initialize isolated repository',lambda:request(prefix+'/initialize',{'branch':'main'}))
original=step('read isolated document',lambda:document()['text'])
step('stage initial file',lambda:command(command='stage',paths=['main.tex']))
initial=step('commit initial file',lambda:command(command='commit',message='Authenticated remote fixture initial'))
repo='/var/lib/overleaf/native-git/'+project+'/repository'
# Trust only this fixture certificate, only for this isolated repository.
shell('git','-C',repo,'config','http.sslCAInfo',ready['cert'])
step('add isolated remote',lambda:command(command='addRemote',name='origin',url=url))
if 'unauthenticated push refused' not in progress['steps']:
 try:command(command='push',remote='origin',branch='main',publish=True)
 except RuntimeError:progress['steps']['unauthenticated push refused']=True;save();print('PASS unauthenticated push refused')
 else:raise AssertionError('Unauthenticated write unexpectedly succeeded')
step('save fixture credential',lambda:command(command='saveCredential',remote='origin',username='alice',token='fixture-token'))
credential=step('credential status excludes token',lambda:command(command='credentialStatus',remote='origin'))
assert credential['result']['configured'] and 'token' not in credential['result']
pushed=step('publish main via deployed API',lambda:command(command='push',remote='origin',branch='main',publish=True))
head=shell('git','-C',repo,'rev-parse','HEAD')
assert shell('git','-C',root+'/remote.git','rev-parse','refs/heads/main')==head
assert 'fixture-token' not in shell('git','-C',repo,'config','--local','--list')
step('push preserves manuscript',lambda:same(original))
# Independent remote author changes the real file, not merely commit metadata.
if 'independent remote update' not in progress['steps']:
 clone=root+'/author'
 shell('git','clone',root+'/remote.git',clone)
 shell('git','-C',clone,'checkout','main')
 shell('git','-C',clone,'config','user.name','Remote Fixture Author')
 shell('git','-C',clone,'config','user.email','remote@example.test')
 text='% Incoming authenticated remote content\n'+original
 subprocess.run(['docker','exec','-i',container,'tee',clone+'/main.tex'],input=text,text=True,stdout=subprocess.DEVNULL,check=True)
 shell('git','-C',clone,'add','main.tex');shell('git','-C',clone,'commit','-m','Remote file content update')
 shell('git','-C',clone,'push','origin','main')
 progress['steps']['independent remote update']={'head':shell('git','-C',clone,'rev-parse','HEAD'),'text':text};save()
remote=progress['steps']['independent remote update']
step('fetch updated remote via deployed API',lambda:command(command='fetch',remote='origin'))
step('fetch does not alter editor',lambda:same(original))
pulled=step('pull remote update via deployed API',lambda:command(command='pull',remote='origin',branch='main'))
assert shell('git','-C',repo,'rev-parse','HEAD')==remote['head']
assert any(c['hash']==remote['head'] and c['subject']=='Remote file content update' for c in pulled['graph'])
step('pull writes exact remote editor bytes',lambda:same(remote['text']))
assert not pulled['status']['files']
step('remove fixture credential',lambda:command(command='removeCredential',remote='origin'))
assert not command(command='credentialStatus',remote='origin')['result']['configured']
print('PASS deployed authenticated publish/fetch/pull, exact native ref and editor bytes, clean status, credential removal')
