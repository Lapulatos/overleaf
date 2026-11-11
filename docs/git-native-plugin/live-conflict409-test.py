"""Live conflict resolution in dedicated fixture branches only."""
from pathlib import Path
helpers = Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(', 1)[0]
helpers = helpers.replace('native-git-live-branch-progress.json', 'native-git-r14b-live-conflict-progress.json')
exec(compile(helpers, __file__, 'exec'))
base = step('read conflict base', lambda: command(command='amendDetails'))['result']['head']
original = step('read original content', lambda: document()['text'])
step('create conflict target', lambda: command(command='createBranch', name='acceptance-r14b-conflict-target', **{'from':base}))
step('checkout conflict target', lambda: command(command='checkout', name='acceptance-r14b-conflict-target'))
ours = '% TARGET r14b replaces first line\n' + '\n'.join(original.split('\n')[1:])
step('edit target', lambda: document(ours))
step('stage target', lambda: command(command='stage', paths=['main.tex']))
target = step('commit target', lambda: command(command='commit', message='Fixture target title'))['graph'][0]['hash']
step('create conflict source', lambda: command(command='createBranch', name='acceptance-r14b-conflict-source', **{'from':base}))
step('checkout conflict source', lambda: command(command='checkout', name='acceptance-r14b-conflict-source'))
theirs = '% SOURCE r14b replaces first line\n' + '\n'.join(original.split('\n')[1:])
step('edit source', lambda: document(theirs))
step('stage source', lambda: command(command='stage', paths=['main.tex']))
source = step('commit source', lambda: command(command='commit', message='Fixture source title'))['graph'][0]['hash']
step('return to conflict target', lambda: command(command='checkout', name='acceptance-r14b-conflict-target'))
def merge():
    try:
        command(command='merge', ref='acceptance-r14b-conflict-source', expectedBranch='acceptance-r14b-conflict-target')
    except RuntimeError as error:
        assert str(error).startswith('409 ') and 'GIT_CONFLICT' in str(error), 'Conflict must return actionable JSON 409'
        print('EXPECTED_CONFLICT_RESPONSE '+str(error)[:200])
        return {'response': str(error)[:200]}
    raise AssertionError('Expected native conflict')
step('merge conflicting branches', merge)
conflict = step('inspect conflict', lambda: request(prefix))
assert conflict['status']['operation']=='merge' and conflict['status']['conflicted']==['main.tex']
markers = step('read editor conflict markers', lambda: document()['text'])
assert '<<<<<<<' in markers and '% TARGET r14b' in markers and '% SOURCE r14b' in markers
details = step('read native conflict versions', lambda: command(command='conflictDetails', path='main.tex'))['result']
assert details['versions']['current']['text']==ours
assert details['versions']['incoming']['text']==theirs
resolved = step('choose incoming version', lambda: command(command='resolveConflict', path='main.tex', fingerprint=details['fingerprint'], choice='incoming'))
assert not resolved['status']['conflicted']
step('verify resolved editor content', lambda: same(theirs))
result = step('continue merge', lambda: command(command='continueOperation', operation='merge', action='continue'))
assert not result['status']['operation'] and not result['status']['files']
assert set(result['graph'][0]['parents'])=={target,source}
step('verify final editor content', lambda: same(theirs))
print('PASS native conflict markers, exact index versions, incoming resolution and two-parent merge')
