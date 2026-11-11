"""Live native stash/index recovery and guarded worktree cleanup on fixture only."""
from pathlib import Path
helpers = Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(', 1)[0]
helpers = helpers.replace('native-git-live-branch-progress.json', 'native-git-r15-stash-worktree-progress.json')
exec(compile(helpers, __file__, 'exec'))
start = step('capture initial state', lambda: request(prefix))
assert not start['status']['files']
branch = start['status']['branch']
original = step('capture initial document', lambda: document()['text'])
staged = original + '\n% fixture staged stash content\n'
working = staged + '% fixture unstaged stash content\n'
step('write staged content', lambda: document(staged))
step('stage content', lambda: command(command='stage', paths=['main.tex']))
step('write unstaged content', lambda: document(working))
stashed = step('stash unfinished edits', lambda: command(command='stash', message='Isolated stash recovery acceptance'))
assert not stashed['status']['files']
step('verify stash cleans editor', lambda: same(original))
entry = step('read native stash', lambda: command(command='stashes'))['result'][0]
preview = step('preview stash bytes', lambda: command(command='stashDiff', index=0, expectedHash=entry['hash']))['result']
assert 'fixture staged stash content' in preview and 'fixture unstaged stash content' in preview
restored = step('pop stash preserving index', lambda: command(command='applyStash', index=0, expectedHash=entry['hash'], pop=True))
step('verify restored editor', lambda: same(working))
assert any(f['path']=='main.tex' and f['index']=='M' and f['workingTree']=='M' for f in restored['status']['files'])
indexDiff = step('verify restored staged diff', lambda: command(command='fileDiff', path='main.tex', staged=True))['result']
assert 'fixture staged stash content' in indexDiff and 'fixture unstaged stash content' not in indexDiff
step('unstage fixture content', lambda: command(command='unstage', paths=['main.tex']))
step('restore baseline document', lambda: document(original))
name = 'acceptance-worktree-cleanup'
step('create disposable branch', lambda: command(command='createBranch', name=name))
step('open disposable worktree', lambda: command(command='checkout', name=name))
step('leave worktree dirty', lambda: document(original+'\n% unfinished worktree content\n'))
step('switch away from dirty worktree', lambda: command(command='checkout', name=branch))
view = next(w for w in step('inspect dirty worktree', lambda: command(command='worktrees'))['result'] if w['branch']==name)
assert view['cleanupBlocked'] and view['changedFiles']
def reject_dirty():
    try: command(command='cleanWorktree', id=view['id'], expectedHead=view['head'])
    except RuntimeError as error:
        assert str(error).startswith('409 ')
        return {'rejected':True}
    raise AssertionError('Dirty worktree unexpectedly removed')
step('refuse dirty cleanup', reject_dirty)
step('reopen dirty worktree', lambda: command(command='checkout', name=name))
step('verify unfinished worktree bytes', lambda: same(original+'\n% unfinished worktree content\n'))
step('restore disposable bytes', lambda: document(original))
step('return to original branch', lambda: command(command='checkout', name=branch))
view = next(w for w in step('inspect clean worktree', lambda: command(command='worktrees'))['result'] if w['branch']==name)
assert not view['cleanupBlocked']
cleaned = step('remove clean inactive worktree', lambda: command(command='cleanWorktree', id=view['id'], expectedHead=view['head']))
assert any(b['name']==name for b in cleaned['branches'])
step('verify active editor unchanged', lambda: same(original))
step('delete disposable branch ref', lambda: command(command='deleteBranch', name=name))
assert not request(prefix)['status']['files']
print('PASS live stash restores staged/unstaged bytes; worktree cleanup refuses edits and retains branch refs')
