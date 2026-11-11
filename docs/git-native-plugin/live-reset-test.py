"""Exercise native reset modes through live API and document service on fixture only."""
from pathlib import Path
helpers = Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(', 1)[0]
helpers = helpers.replace('native-git-live-branch-progress.json', 'native-git-r13-live-reset-progress.json')
exec(compile(helpers, __file__, 'exec'))
step('create reset fixture branch', lambda: command(command='createBranch', name='acceptance-r13-reset'))
step('checkout reset fixture branch', lambda: command(command='checkout', name='acceptance-r13-reset'))
original = step('read reset baseline', lambda: document()['text'])
baseline = step('read baseline commit', lambda: command(command='amendDetails'))['result']['head']
changed = original + '\n% r13 committed change\n'
step('edit next commit', lambda: document(changed))
step('stage next commit', lambda: command(command='stage', paths=['main.tex']))
step('commit next version', lambda: command(command='commit', message='Fixture reset source'))
staged = changed + '% r13 staged work\n'
step('edit staged work', lambda: document(staged))
step('stage work', lambda: command(command='stage', paths=['main.tex']))
working = staged + '% r13 unstaged work\n'
step('edit unstaged work', lambda: document(working))
preview = step('preview soft reset', lambda: command(command='resetDetails', ref=baseline))['result']
soft = step('soft reset', lambda: command(command='reset', ref=preview['target'], mode='soft', fingerprint=preview['fingerprint']))
step('verify soft editor unchanged', lambda: same(working))
assert any(f['path']=='main.tex' and f['index']=='M' for f in soft['status']['files'])
preview = step('preview mixed reset', lambda: command(command='resetDetails', ref=baseline))['result']
mixed = step('mixed reset', lambda: command(command='reset', ref=preview['target'], mode='mixed', fingerprint=preview['fingerprint']))
step('verify mixed editor unchanged', lambda: same(working))
assert any(f['path']=='main.tex' and f['index']==' ' and f['workingTree']=='M' for f in mixed['status']['files'])
preview = step('preview hard reset', lambda: command(command='resetDetails', ref=baseline))['result']
hard = step('hard reset fixture only', lambda: command(command='reset', ref=preview['target'], mode='hard', fingerprint=preview['fingerprint']))
step('verify hard editor restored', lambda: same(original))
assert hard['status']['files']==[]
assert next(b for b in hard['branches'] if b['name']=='acceptance-r13-reset')['commit']==baseline
print('PASS live soft/mixed/hard reset and exact editor contents')
