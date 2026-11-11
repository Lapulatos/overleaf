# Evidence notes

- Scope: user requests Git usability/completeness audit, comparing Venues. No product edits or remote writes.
- Source: GitSync frontend/backend, router, controller, snapshot preparation, local changes, push/recovery/conflict UI, timers, history rendering and repository reader.
- Browser: loopback 18081 existing project, fresh context, all non-GET GitSync requests blocked. Screenshots contain Git panel only. No credential values written to outputs.
- Existing frontend tests: 83 passing; original log /tmp/git-review-frontend.log.
- Selected backend tests: 5 passing; original log /tmp/git-review-backend.log.
- Selection reproduction: 1 passing; demonstrates current failure rather than correct intended behavior. Initial attempt lacked pushEnabled in the mock and could not find the checkbox; corrected mock and reran. Initial shell attempt used wrong cwd and produced no file; corrected.
- No performance measurement or actual remote mutation in this audit.
- Old memory used only to maintain evidence boundaries. Its disabled-feature snapshot is stale and was not reused as a current claim.

Re-run frontend suite from services/web:
`NODE_ENV=test TZ=GMT npx mocha --timeout 15000 --exit --require test/frontend/bootstrap.js 'test/frontend/features/git-sync/*.test.tsx'`

Re-run defect reproduction from services/web:
`NODE_ENV=test TZ=GMT npx mocha --timeout 15000 --exit --require test/frontend/bootstrap.js ../../docs/git-review/selection-reproduction.cjs`

Re-run backend fixtures from repository root:
`node --test services/web/test/agent/git-push-preparation.test.mjs services/web/test/agent/git-guarded-push.test.mjs services/web/test/agent/git-branch-switch.test.mjs services/web/test/agent/git-branch-merge.test.mjs`
