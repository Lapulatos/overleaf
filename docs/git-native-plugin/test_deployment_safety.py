import unittest
from deployment_safety import assert_idle

class DeploymentSafetyTests(unittest.TestCase):
    def redis(self, locks=(), editors=()):
        def call(*args):
            if args[0] == '--scan':
                pattern = args[2]
                if pattern == 'clients_in_project:*': return '\n'.join(editors)
                return '\n'.join(k for k in locks if k.startswith(pattern[:-1]))
            if args[0] == 'EXISTS': return '1' if args[1] in locks else '0'
            if args[0] == 'SCARD': return str(editors[args[1]])
            raise AssertionError(args)
        return call

    def test_idle_candidate(self):
        assert_idle(self.redis())

    def test_connected_editor(self):
        with self.assertRaisesRegex(RuntimeError, 'editor is connected'):
            assert_idle(self.redis(editors={'clients_in_project:p': 1}))

    def test_each_write_lock_blocks_restart(self):
        for key in ('lock:web:nativeGitProject:p', 'lock:web:sequentialProjectStructureUpdateLock:p', 'native-git:project-write:p'):
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, 'write operation'):
                assert_idle(self.redis(locks=(key,)))

    def test_authorized_restart_allows_editors_but_not_active_writes(self):
        assert_idle(self.redis(editors={'clients_in_project:p': 1}), allow_connected_editors=True)
        with self.assertRaisesRegex(RuntimeError, 'write operation'):
            assert_idle(self.redis(locks=('native-git:project-write:p',), editors={'clients_in_project:p': 1}), allow_connected_editors=True)

    def test_empty_editor_set_is_safe(self):
        assert_idle(self.redis(editors={'clients_in_project:p': 0}))

if __name__ == '__main__':
    unittest.main()
