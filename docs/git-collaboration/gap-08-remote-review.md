# G08 shared remote management permission

Completed bounded check, 2026-11-13. Added missing changeRemote to owner-only command capabilities. Existing runtime rechecks the capability after lock waits.

Changed source: services/web/app/src/Features/NativeGit/CommandCapabilities.mjs. Changed test: services/web/test/agent/native-git-command-capabilities.test.mjs.

Validation: 7 focused tests passed (gap-08-remote-capabilities.log). Real runtime refused Editor changeRemote with 403 and byte-identical repository config (gap-08-remote-runtime.log). Deployed backend module only to isolated18082 and restarted its web/API services.

Original Chrome owner opened Graph repository settings, Edit, Save remote with existing URLs; edit form closed successfully with unchanged addresses. Original Firefox Editor opened same settings and attempted Save remote: visible owner-only refusal, unchanged URLs. Evidence: gap-08-remote-owner-editor-final.png. Earlier gap-08-remote-owner-editor.png did not capture the refusal and is not the acceptance image.

No fetch, push, external remote modification, formal paper modification, or other instance deployment performed for this item.

## removeRemote dual-browser check
Firefox Editor clicked Remove then Remove remote for existing test binding and received the owner-only refusal. Chrome owner created a disposable g08-remove-fixture address (no network operation), removed it using the reviewed UI, and read back remotes: only original g07-webhook remains. Evidence: gap-08-remove-owner-editor.png and gap-08-remove-result.json. Original g07-webhook and its fetched refs were preserved; no restore was needed because the owner removal used a disposable binding.
