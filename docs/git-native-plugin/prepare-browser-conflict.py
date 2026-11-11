"""Live conflict resolution in dedicated fixture branches only."""
from pathlib import Path
helpers = Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(', 1)[0]
helpers = helpers.replace('native-git-live-branch-progress.json', 'native-git-r18ui-live-conflict-progress.json')
exec(compile(helpers, __file__, 'exec'))
base = step('read conflict base', lambda: command(command='amendDetails'))['result']['head']
original = step('read original content', lambda: document()['text'])
step('create conflict target', lambda: command(command='createBranch', name='acceptance-r18ui-conflict-target', **{'from':base}))
step('checkout conflict target', lambda: command(command='checkout', name='acceptance-r18ui-conflict-target'))
ours = '% TARGET r18ui replaces first line\n' + '\n'.join(original.split('\n')[1:])
step('edit target', lambda: document(ours))
step('stage target', lambda: command(command='stage', paths=['main.tex']))
target = step('commit target', lambda: command(command='commit', message='Fixture target title'))['graph'][0]['hash']
step('create conflict source', lambda: command(command='createBranch', name='acceptance-r18ui-conflict-source', **{'from':base}))
step('checkout conflict source', lambda: command(command='checkout', name='acceptance-r18ui-conflict-source'))
theirs = '% SOURCE r18ui replaces first line\n' + '\n'.join(original.split('\n')[1:])
step('edit source', lambda: document(theirs))
step('stage source', lambda: command(command='stage', paths=['main.tex']))
source = step('commit source', lambda: command(command='commit', message='Fixture source title'))['graph'][0]['hash']
step('return to conflict target', lambda: command(command='checkout', name='acceptance-r18ui-conflict-target'))
print('READY browser conflict source and target; native merge not started')
