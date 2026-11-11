"""Amend acceptance on the existing isolated fixture, never a user project."""
from pathlib import Path

helpers = Path(__file__).with_name('live-branch-test.py').read_text().split("original=step(", 1)[0]
helpers = helpers.replace('native-git-live-branch-progress.json', 'native-git-r12-live-amend-progress.json')
exec(compile(helpers, __file__, 'exec'))
step('create amend fixture branch', lambda: command(command='createBranch', name='acceptance-r12-amend'))
step('checkout amend fixture branch', lambda: command(command='checkout', name='acceptance-r12-amend'))
original = step('read amend baseline', lambda: document()['text'])
committed = original + '\n% r12 ordinary commit\n'
step('edit initial commit', lambda: document(committed))
step('stage initial commit', lambda: command(command='stage', paths=['main.tex']))
step('make initial commit', lambda: command(command='commit', message='Fixture before amend'))
staged = committed + '% r12 staged amendment\n'
step('edit staged amendment', lambda: document(staged))
step('stage amendment', lambda: command(command='stage', paths=['main.tex']))
unstaged = staged + '% r12 unstaged text survives\n'
step('leave unstaged text', lambda: document(unstaged))
details = step('load amendment target', lambda: command(command='amendDetails'))['result']
result = step('amend selected target', lambda: command(command='commit', message='Fixture amended commit\n\nRetain body', amend=True, expectedHead=details['head'], expectedBranch=details['branch']))
assert result['graph'][0]['subject'] == 'Fixture amended commit'
assert result['graph'][0]['hash'] != details['head']
assert any(f['path'] == 'main.tex' and f['workingTree'] == 'M' and f['index'] == ' ' for f in result['status']['files'])
step('verify unstaged editor text survives', lambda: same(unstaged))
head = step('read amended committed file', lambda: command(command='show', ref='HEAD', path='main.tex'))
assert head['result'] == staged
amended_details = step('verify amended full message', lambda: command(command='amendDetails'))['result']
assert amended_details['message'] == 'Fixture amended commit\n\nRetain body'
print('PASS live amend advances graph, replaces selected tip, retains body and unstaged editor text')
