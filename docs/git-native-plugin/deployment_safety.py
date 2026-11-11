"""Conservative candidate restart guard; never interrupt connected editors."""
import subprocess
import os

def assert_idle(redis, allow_connected_editors=False):
    for pattern in ('lock:web:nativeGitProject:*', 'lock:web:sequentialProjectStructureUpdateLock:*', 'native-git:project-write:*'):
        keys = redis('--scan', '--pattern', pattern).splitlines()
        if any(redis('EXISTS', key).strip() == '1' for key in keys):
            raise RuntimeError('Git or project write operation is active; candidate restart deferred')
    if allow_connected_editors:
        return
    for key in redis('--scan', '--pattern', 'clients_in_project:*').splitlines():
        if int(redis('SCARD', key).strip() or '0') > 0:
            raise RuntimeError('An editor is connected; candidate restart deferred to avoid disconnecting the user')

def check_candidate_idle():
    def redis(*args):
        return subprocess.check_output(['docker', 'exec',
            'overleaf-deletion-acceptance-candidate-redis-1', 'redis-cli', '--raw', *args], text=True)
    assert_idle(redis, allow_connected_editors=os.environ.get("NATIVE_GIT_ALLOW_EDITOR_RESTART") == "1")

if __name__ == '__main__':
    check_candidate_idle()
    print('Candidate has no connected editors or active project write locks')
