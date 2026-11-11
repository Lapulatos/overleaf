"""Prepare conflicting operations in a named isolated project, never user projects."""
from pathlib import Path
import contextlib, io, sys
helpers=Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(',1)[0]
with contextlib.redirect_stdout(io.StringIO()):
 exec(compile(helpers,__file__,'exec'))
name='Native Git operation recovery acceptance r27'
recordPath=ctx['private']/'native-git-operation-recovery-r27.json'
if recordPath.exists(): progress=json.loads(recordPath.read_text())
else:
 progress={'projectId':request('/project/new',{'projectName':name,'template':'blank'})['project_id'],'steps':{}}
 save()
project=progress['projectId'];prefix='/project/'+project+'/native-git'
script=script.replace('Native Git isolated acceptance 20261109',name)
print('PROJECT '+project,flush=True)
if '--create-only' in sys.argv: sys.exit(0)
assert request(prefix)['connected'] is not False, 'Initialize fixture through browser first'
original=step('read original',lambda:document()['text'])
step('stage baseline',lambda:command(command='stage',paths=['main.tex']))
step('commit baseline',lambda:command(command='commit',message='Operation recovery baseline'))
base=step('base head',lambda:command(command='amendDetails'))['result']['head']
step('create source',lambda:command(command='createBranch',name='source',**{'from':base}))
step('checkout source',lambda:command(command='checkout',name='source'))
sourceText='% SOURCE recovery\n'+'\n'.join(original.split('\n')[1:])
step('edit source',lambda:document(sourceText))
step('stage source',lambda:command(command='stage',paths=['main.tex']))
step('commit source',lambda:command(command='commit',message='Source conflicting first line'))
source=step('source head',lambda:command(command='amendDetails'))['result']['head']
step('create target',lambda:command(command='createBranch',name='target',**{'from':base}))
step('checkout target',lambda:command(command='checkout',name='target'))
targetText='% TARGET recovery\n'+'\n'.join(original.split('\n')[1:])
step('edit target',lambda:document(targetText))
step('stage target',lambda:command(command='stage',paths=['main.tex']))
step('commit target',lambda:command(command='commit',message='Target conflicting first line'))
target=step('target head',lambda:command(command='amendDetails'))['result']['head']
for branch in ['rebase-continue','rebase-abort','rebase-skip','cherry-continue','cherry-abort','cherry-skip']:
 step('create '+branch,lambda branch=branch:command(command='createBranch',name=branch,**{'from':target}))
step('create revert-target',lambda:command(command='createBranch',name='revert-target',**{'from':source}))
step('checkout revert-target',lambda:command(command='checkout',name='revert-target'))
step('edit revert-target',lambda:document(targetText))
step('stage revert-target',lambda:command(command='stage',paths=['main.tex']))
step('commit revert-target',lambda:command(command='commit',message='Later line blocks source revert'))
revert=step('revert target head',lambda:command(command='amendDetails'))['result']['head']
for branch in ['revert-continue','revert-abort','revert-skip']:
 step('create '+branch,lambda branch=branch:command(command='createBranch',name=branch,**{'from':revert}))
step('checkout first recovery',lambda:command(command='checkout',name='rebase-continue'))
progress.update(base=base,source=source,target=target,revert=revert,sourceText=sourceText,targetText=targetText)
save();print('READY conflicting native branches; no operation started')
