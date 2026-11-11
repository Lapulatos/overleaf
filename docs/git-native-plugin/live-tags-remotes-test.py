"""Tag checkout and remote removal acceptance in isolated project only."""
from pathlib import Path
helpers = Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(', 1)[0]
helpers = helpers.replace('native-git-live-branch-progress.json', 'native-git-r15-live-tags-remotes-progress.json')
exec(compile(helpers, __file__, 'exec'))
initial = step('capture starting state', lambda: request(prefix))
assert not initial['status']['files']
branch = initial['status']['branch']
head = step('capture starting head', lambda: command(command='amendDetails'))['result']['head']
old = next(commit for commit in initial['graph'] if commit['hash']==head)['parents'][0]
original = step('capture original document', lambda: document()['text'])
oldText = step('read tagged version', lambda: command(command='show', ref=old, path='main.tex'))['result']
name = 'acceptance-r15-release'
step('create old version tag', lambda: command(command='createTag', name=name, ref=old))
step('create same-name branch at new head', lambda: command(command='createBranch', name=name, **{'from':head}))
snapshot = step('inspect tag metadata', lambda: request(prefix))
tag = next(tag for tag in snapshot['tags'] if tag['name']==name)
assert tag['commit']==old and tag['author'] and tag['date'] and tag['subject']
assert next(b for b in snapshot['branches'] if b['name']==name)['commit']==head
checked = step('checkout qualified tag', lambda: command(command='checkoutDetached', ref=tag['ref']))
assert checked['status']['detached']
step('verify tagged document bytes', lambda: same(oldText))
step('return to starting branch', lambda: command(command='checkout', name=branch))
step('verify branch document bytes', lambda: same(original))
url = 'https://example.invalid/isolated-native-git-test.git'
step('add configuration-only test remote', lambda: command(command='addRemote', name='acceptance-r15', url=url))
step('remove confirmed test remote', lambda: command(command='removeRemote', name='acceptance-r15', expectedUrl=url))
remotes = step('verify removed remote', lambda: command(command='remotes'))['result']
assert all(remote['name']!='acceptance-r15' for remote in remotes)
assert step('verify local head after removal', lambda: command(command='amendDetails'))['result']['head']==head
step('verify local document after removal', lambda: same(original))
step('delete fixture tag', lambda: command(command='deleteTag', name=name))
step('delete unused same-name branch', lambda: command(command='deleteBranch', name=name))
print('PASS qualified tag checkout and remote removal preserve local branch and editor contents; no network requests or pushes')
