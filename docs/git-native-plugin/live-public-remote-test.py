"""Deployed HTTPS clone/fetch using a public repository and isolated project."""
from pathlib import Path
helpers = Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(', 1)[0]
helpers = helpers.replace('native-git-live-branch-progress.json', 'native-git-unused-helper-progress.json')
exec(compile(helpers, __file__, 'exec'))
statePath = ctx['private']/'native-git-public-remote-acceptance.json'
name = 'Native Git public remote acceptance 20261110'
if statePath.exists():
    state=json.loads(statePath.read_text())
else:
    created=request('/project/new', {'projectName':name,'template':'blank'})
    state={'projectId':created['project_id'],'steps':{}}
    statePath.write_text(json.dumps(state));statePath.chmod(0o600)
project=state['projectId'];prefix='/project/'+project+'/native-git'
progress=state;recordPath=statePath
script=script.replace('Native Git isolated acceptance 20261109',name)
original=step('capture original document',lambda:document()['text'])
url='https://github.com/octocat/Hello-World.git'
connected=step('connect public HTTPS remote',lambda:command(command='connect',url=url))
assert connected['connected'] and connected['branches'] and connected['graph']
assert any(b['remote'] for b in connected['branches'])
step('verify connect preserves manuscript',lambda:same(original))
fetched=step('fetch public HTTPS remote',lambda:command(command='fetch',remote='origin'))
assert fetched['branches'] and fetched['graph']
step('verify fetch preserves manuscript',lambda:same(original))
pulled=step('pull public remote already current',lambda:command(command='pull',remote='origin',branch=connected['status']['branch']))
step('verify no-op pull preserves manuscript',lambda:same(original))
print('PASS deployed public HTTPS clone/fetch/no-op pull and preserved original editor contents')
