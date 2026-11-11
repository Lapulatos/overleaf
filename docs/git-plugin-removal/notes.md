# Git plugin removal — 2026-11-09

Removed the custom Git plugin only. No replacement Git implementation added.

- Removed 180 Git-specific source/test files; exact paths in deleted-files.json.
- Changed shared integrations/tests in changed-files.json. Paper Assistant deletion safeguards retained.
- 165 protected plugin files checked: 161 byte-identical; 4 WritingAssist shared deletion files had only Git integration removed.
- Archived and removed 22 old Git-only build source directories; other build context contents retained.
- Preserved real repository storage, credentials, manuscript data, source workspace .git, and browser windows/tabs.
- Retained the one-line persisted-tab migration so browsers previously on the removed tab return to the file tree.
- Retained generic completed legacy receipt handling; unfinished legacy deletions cannot resume through Paper Assistant.

## Verification

- Backend agent tests excluding skill-plugins: 392 passed. Legacy receipt test additionally passed (19 teardown tests).
- Document updater: 552 passed.
- Project history: 39 passed.
- Plugin frontend: 227 passed, 8 failed in unchanged submission planner/recommendation pages. Do not claim full frontend regression success.
- Standalone skill-plugins test needs Mongo configuration and failed to initialize; unrelated files not changed to bypass it.
- Production webpack build succeeded with asset-size warnings.
- Image source hashes verified for 183 files. Removed implementation paths absent.
- Candidate deployed at http://127.0.0.1:18081, image overleaf-agent-acceptance:20261109-without-git.
- Login HTTP 200; document-updater status HTTP 200; removed Git write endpoint HTTP 404.
- Other running instances untouched. Browser validation not performed because the dedicated test browser was unavailable.

## Backups

See archive-manifest.json, old-build-copies.json and /Users/sujie/.local/share/overleaf-acceptance/archives/git-plugin-removal-shared-tests.tar.gz.
