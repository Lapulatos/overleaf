"""Real configured provider acceptance on synthetic fixture content only."""
from pathlib import Path
helpers = Path(__file__).with_name('live-branch-test.py').read_text().split('original=step(', 1)[0]
exec(compile(helpers, __file__, 'exec'))
status = request(prefix)['status']
assert status['branch'] == 'acceptance-r13-reset' and not status['files'], 'Fixture must be clean before model acceptance'
original = document()['text']
staged = original + '\n\\newcommand{\\GitFixtureTitle}{Native Git integration checks}\n'
try:
    document(staged)
    command(command='stage', paths=['main.tex'])
    document(staged + '% Unstaged fixture note: revise bibliography later\n')
    result = command(command='generateMessage')['result']
    assert isinstance(result, str) and result.strip() and len(result) <= 300 and '\n' not in result
    print('LIVE_AI_SUBJECT ' + result)
finally:
    command(command='unstage', paths=['main.tex'])
    document(original)
    assert not request(prefix)['status']['files'], 'Fixture cleanup did not restore clean state'
    print('PASS fixture restored without commit or push')
